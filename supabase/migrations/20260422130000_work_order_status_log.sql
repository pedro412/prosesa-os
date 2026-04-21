-- LIT-39 / M4-4 — Append-only status log for work orders + the
-- sanctioned `update_work_order_status(wo, status, note)` RPC.
--
-- Why a separate log table (vs. the generic audit_logs):
--   * audit_logs captures row diffs; the status log also carries a
--     free-text `note` that isn't part of the row. Keeping them
--     separate lets the log be a first-class consumer surface
--     (timeline in the detail page, LIT-42) without joining jsonb.
--   * audit_logs is attached broadly; this log is hot-path (every
--     transition). Separate table keeps the read pattern cheap.
--
-- Why a session-var for the note:
--   Triggers don't receive extra args. The RPC sets the note into a
--   session-local config (set_config(..., true)) before the UPDATE,
--   and the trigger reads it back with current_setting(..., true).
--   This keeps the trigger the SOLE writer of the log (AC requirement)
--   while still letting the sanctioned caller attach an explanation.
--   Ad-hoc UPDATEs that bypass the RPC still get logged — just with
--   note = null, which matches the intent of "no ad-hoc changes
--   without a reason".
--
-- Forward vs. backward:
--   STATUS_ORDER is the canonical 7-stage flow. A transition is
--   backward when array_position(new) < array_position(old). Backward
--   transitions require a non-empty note at the RPC boundary.
--   `en_instalacion` is still on the forward path; skipping it
--   (en_produccion → terminado) is forward, not a skip. `entregado`
--   is reachable but not terminal for the log — reopen is legal as
--   a backward transition.
--
-- No audit.attach on this table: the log IS the audit. Double-logging
-- via audit_logs would be noise.

-- ============================================================================
-- Table
-- ============================================================================
create table public.work_order_status_log (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete restrict,
  old_status text,
  new_status text not null,
  note text,
  changed_by uuid not null references auth.users (id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint work_order_status_log_new_status_check
    check (new_status in (
      'cotizado',
      'anticipo_recibido',
      'en_diseno',
      'en_produccion',
      'en_instalacion',
      'terminado',
      'entregado'
    ))
);

-- Timeline-by-order is the hot read path (detail page).
create index work_order_status_log_wo_idx
  on public.work_order_status_log (work_order_id, changed_at desc);

-- "What did user X change today?" audits.
create index work_order_status_log_actor_idx
  on public.work_order_status_log (changed_by, changed_at desc);

-- ============================================================================
-- Trigger: log every status change
-- ============================================================================
-- Fires AFTER UPDATE when `status` actually changes. SECURITY DEFINER
-- so the INSERT bypasses the table's (missing) INSERT policy — the
-- trigger is the sole sanctioned writer.
--
-- The note is passed through session config. The RPC sets it via
-- set_config('app.wo_status_note', ..., true) with is_local=true so
-- it's auto-cleared at transaction end. Direct UPDATEs outside the
-- RPC land with note = null (the second arg to current_setting makes
-- missing_ok = true so the call doesn't error).
create or replace function public.work_orders_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_note text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_note := nullif(trim(coalesce(current_setting('app.wo_status_note', true), '')), '');

  insert into public.work_order_status_log (
    work_order_id, old_status, new_status, note, changed_by
  )
  values (new.id, old.status, new.status, v_note, v_actor);

  return new;
end;
$$;

create trigger work_orders_log_status_change
after update of status on public.work_orders
for each row
execute function public.work_orders_log_status_change();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.work_order_status_log enable row level security;

-- SELECT: any authenticated caller can read the timeline. Matches the
-- visibility rules on work_orders + sales_notes.
create policy work_order_status_log_select_auth on public.work_order_status_log
for select
to authenticated
using (true);

-- No INSERT/UPDATE/DELETE policies. The trigger is SECURITY DEFINER
-- so it writes around the missing policies. Any direct client attempt
-- to INSERT/UPDATE/DELETE fails by default (RLS denies when no policy
-- matches).

-- ============================================================================
-- update_work_order_status(wo_id, new_status, note) — sanctioned RPC
-- ============================================================================
-- Validates the transition at the boundary:
--   * caller is authenticated
--   * order exists and is not cancelled
--   * new_status is in the allowed enum
--   * if backward (new index < old index), note is required and non-blank
-- Then sets the session var and UPDATEs work_orders; the AFTER trigger
-- does the log insert. The RPC returns the updated row so the client
-- can optimistic-update TanStack caches without a follow-up fetch.
create or replace function public.update_work_order_status(
  p_wo_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_order public.work_orders%rowtype;
  v_status_order constant text[] := array[
    'cotizado',
    'anticipo_recibido',
    'en_diseno',
    'en_produccion',
    'en_instalacion',
    'terminado',
    'entregado'
  ];
  v_old_idx int;
  v_new_idx int;
  v_trimmed_note text;
begin
  if v_caller is null then
    raise exception 'update_work_order_status: not authenticated'
      using errcode = '28000';
  end if;

  select * into v_order from public.work_orders where id = p_wo_id;

  if v_order.id is null then
    raise exception 'update_work_order_status: work order % not found', p_wo_id
      using errcode = '23503';
  end if;

  if v_order.cancelled_at is not null then
    raise exception 'update_work_order_status: la orden está cancelada'
      using errcode = '22023';
  end if;

  v_new_idx := array_position(v_status_order, p_new_status);
  if v_new_idx is null then
    raise exception 'update_work_order_status: invalid status %', p_new_status
      using errcode = '22023';
  end if;

  if v_order.status is not distinct from p_new_status then
    -- No-op: caller's intent already holds. Return the current row
    -- without a write so the log stays clean.
    return v_order;
  end if;

  v_old_idx := array_position(v_status_order, v_order.status);
  v_trimmed_note := nullif(trim(coalesce(p_note, '')), '');

  if v_new_idx < v_old_idx and v_trimmed_note is null then
    raise exception 'update_work_order_status: se requiere un motivo para regresar la orden'
      using errcode = '22023';
  end if;

  -- Stash the note for the AFTER trigger. is_local=true so it
  -- auto-clears at transaction end and can't leak across requests.
  perform set_config('app.wo_status_note', coalesce(v_trimmed_note, ''), true);

  update public.work_orders
     set status = p_new_status,
         -- delivered_at stamps when we cross the final forward edge;
         -- a backward transition OFF entregado clears it so later
         -- forward transitions re-stamp. Keeps the detail page's
         -- "delivered on" readout coherent with the log.
         delivered_at = case
           when p_new_status = 'entregado' then coalesce(delivered_at, now())
           when v_order.status = 'entregado' then null
           else delivered_at
         end
   where id = p_wo_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.update_work_order_status(uuid, text, text) from public;
grant execute on function public.update_work_order_status(uuid, text, text) to authenticated;

-- ============================================================================
-- Sanity
-- ============================================================================
select public.assert_all_tables_have_rls();
