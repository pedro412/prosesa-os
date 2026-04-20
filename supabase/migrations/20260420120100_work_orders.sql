-- work_orders schema for LIT-38 / M4-3.
--
-- Tracks custom jobs spawned from a sales_note per SPEC §4.5. A
-- single nota can own 0..N orders (M4 pre-planning 2026-04-20);
-- the line → order link lives on `sales_note_lines.work_order_id`
-- (added in the follow-up migration).
--
-- Design notes:
--   * Folios are DERIVED from the parent nota: `<nota_folio>-<NN>`
--     (e.g., A-0120 → A-0120-01, A-0120-02). Gaps from cancelled
--     orders are meaningful audit trail. A BEFORE INSERT trigger
--     mints the folio via generate_work_order_folio() if the caller
--     didn't supply one — same pattern as sales_notes_assign_folio.
--   * Soft-cancel fields (cancelled_at / cancelled_by /
--     cancellation_reason) match the sales_notes naming convention.
--     Admin-only mutation is enforced by the work_orders_enforce_
--     admin_cancel trigger, NOT by a split RLS policy — keeps the
--     ventas status-advance path simple.
--   * Cancellation and delivery are mutually exclusive: an order
--     reaches 'entregado' OR it gets cancelled, never both. A CHECK
--     enforces this invariant so neither the UI nor a trigger alone
--     has to keep it true.
--   * customer_id is nullable — walk-in projects are legal (same
--     rule as sales_notes / CLAUDE.md §7).
--   * company_id is denormalized from the parent nota. The nota is
--     the source of truth; carrying it here lets list-view filters
--     (M4-6) and RLS expressions stay a single row without a join.

-- ============================================================================
-- Derived folio function
-- ============================================================================
-- Mints the next per-nota order suffix: <nota folio>-NN.
--
-- Race safety: pg_advisory_xact_lock serializes concurrent callers
-- for the same parent until commit. Count-based suffix avoids adding
-- a dedicated counter table; N orders per nota is single-digit at
-- our scale so the scan is trivial.
--
-- Suffix padding: FM00 → 2-digit zero-padded (01, 02, ... 99). No
-- overflow guard — if a single nota ever spawns 100 orders something
-- is deeply wrong and we want to see the failure.
create or replace function public.generate_work_order_folio(
  p_sales_note_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota_folio text;
  v_next_suffix int;
begin
  select folio
    into v_nota_folio
  from public.sales_notes
  where id = p_sales_note_id;

  if v_nota_folio is null then
    raise exception 'generate_work_order_folio: sales note % not found', p_sales_note_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Hash the composite key to an int for the advisory lock namespace.
  -- Held to transaction end, so the count-then-insert below is
  -- race-free without a dedicated counter row.
  perform pg_advisory_xact_lock(
    hashtext('work_order_folio:' || p_sales_note_id::text)
  );

  select count(*) + 1
    into v_next_suffix
  from public.work_orders
  where sales_note_id = p_sales_note_id;

  return v_nota_folio || '-' || to_char(v_next_suffix, 'FM00');
end
$$;

revoke all on function public.generate_work_order_folio(uuid) from public;
grant execute on function public.generate_work_order_folio(uuid) to authenticated;

-- ============================================================================
-- work_orders table
-- ============================================================================
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  sales_note_id uuid not null references public.sales_notes (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,
  status text not null default 'cotizado',
  priority text not null default 'normal',
  description text,
  promised_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint work_orders_status_check
    check (status in (
      'cotizado',
      'anticipo_recibido',
      'en_diseno',
      'en_produccion',
      'en_instalacion',
      'terminado',
      'entregado'
    )),
  constraint work_orders_priority_check
    check (priority in ('normal', 'urgente')),
  -- Delivery and cancellation are mutually exclusive terminal
  -- conditions. An order is either delivered OR cancelled, never
  -- both. Pre-terminal stages may coexist with cancelled_at = null.
  constraint work_orders_entregado_not_cancelled
    check (not (status = 'entregado' and cancelled_at is not null))
);

-- Folios are globally unique (derived from per-company unique nota
-- folios, so no collision is possible).
create unique index work_orders_folio_unique
  on public.work_orders (folio);

-- Listing a nota's orders in creation order.
create index work_orders_sales_note_idx
  on public.work_orders (sales_note_id, folio);

-- Common list-view filters (M4-6).
create index work_orders_company_created_idx
  on public.work_orders (company_id, created_at desc);
create index work_orders_status_idx
  on public.work_orders (status)
  where status <> 'entregado';
create index work_orders_customer_idx
  on public.work_orders (customer_id)
  where customer_id is not null;
create index work_orders_cancelled_idx
  on public.work_orders (cancelled_at)
  where cancelled_at is not null;

-- ============================================================================
-- Triggers: updated_at, actor stamping, folio assignment, admin cancel gate
-- ============================================================================
create trigger work_orders_set_updated_at
before update on public.work_orders
for each row
execute function public.set_updated_at();

create trigger work_orders_stamp_actor
before insert or update on public.work_orders
for each row
execute function public.stamp_actor_columns();

-- Assigns a derived folio on INSERT when the caller didn't supply
-- one. Matches the sales_notes_assign_folio pattern so the happy
-- path is just `insert ... default folio`.
create or replace function public.work_orders_assign_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null or length(trim(new.folio)) = 0 then
    new.folio := public.generate_work_order_folio(new.sales_note_id);
  end if;
  return new;
end;
$$;

create trigger work_orders_assign_folio
before insert on public.work_orders
for each row
execute function public.work_orders_assign_folio();

-- Admin-only gate for cancellation. UPDATE stays open to authenticated
-- so ventas can advance the status through the 7 stages, but toggling
-- any of the three cancellation columns requires admin. On INSERT,
-- cancellation columns must all be null — an order is born uncancelled.
create or replace function public.work_orders_enforce_admin_cancel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.cancelled_at is not null
       or new.cancelled_by is not null
       or new.cancellation_reason is not null then
      raise exception 'work_orders: cannot create a work order in cancelled state'
        using errcode = 'check_violation';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.cancelled_at is distinct from old.cancelled_at
        or new.cancelled_by is distinct from old.cancelled_by
        or new.cancellation_reason is distinct from old.cancellation_reason)
       and not public.is_admin() then
      raise exception 'work_orders: only admins can modify cancellation fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger work_orders_enforce_admin_cancel
before insert or update on public.work_orders
for each row
execute function public.work_orders_enforce_admin_cancel();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.work_orders enable row level security;

-- SELECT: shared across razones sociales (CLAUDE.md §6). Per-company
-- scoping is a UI-layer filter, not an RLS concern.
create policy work_orders_select_auth on public.work_orders
for select
to authenticated
using (true);

-- INSERT: any authenticated caller, attaching to a non-cancelled
-- parent nota. created_by check matches the pattern on sales_notes.
create policy work_orders_insert_auth on public.work_orders
for insert
to authenticated
with check (
  company_id is not null
  and (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and s.status <> 'cancelada'
  )
);

-- UPDATE: authenticated when the parent nota is still live. Admins
-- bypass the parent-cancelled gate (matches sales_note_lines). The
-- cancellation-field gate is enforced by the trigger above, not here.
create policy work_orders_update_auth on public.work_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
);

-- No DELETE policy. Work orders are never hard-deleted; cancellation
-- is the admin-only "remove" path (CLAUDE.md §4 rule 11).

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('work_orders');

select public.assert_all_tables_have_rls();
