-- Payments for LIT-30 / M3-3.
--
-- Payments are separate rows so `mixto` (cash + transfer, cash + card,
-- …) and staged advance flows (anticipo now, saldo later) share the
-- same primitive — SPEC §4.3. One sales_note can have N payments; the
-- sum of amounts vs sales_notes.total determines the note's status.
--
-- Design notes:
--   * Append-only by design: no UPDATE policy for non-admins, no
--     DELETE policy at all. If a payment was captured incorrectly, the
--     admin records a correcting payment (future refund flow); the
--     original row stays for audit. Today amount > 0 is enforced —
--     refunds / reversals are Phase 2.
--   * No updated_at / updated_by on this table. The ticket spec
--     defines it as a write-once record, and admin UPDATE (RLS allows)
--     is the rare correction path — audit_logs captures any change.
--     A bespoke BEFORE INSERT trigger fills created_by; we don't
--     reuse stamp_actor_columns() because that helper writes
--     updated_by, which doesn't exist here.
--   * A SECURITY DEFINER trigger recomputes sales_notes.status after
--     every mutation. It bypasses the admin-only UPDATE policy on
--     sales_notes (that policy gates header edits; the trigger is the
--     one sanctioned status writer). Cancelled notes are skipped —
--     cancellation freezes the document.
--   * RLS INSERT requires an authenticated caller, a non-cancelled
--     parent, and created_by = auth.uid() (the trigger sets it; the
--     policy belt blocks a forged payload before the trigger runs).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sales_note_id uuid not null references public.sales_notes (id) on delete restrict,
  method text not null,
  amount numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint payments_method_check
    check (method in ('efectivo', 'transferencia', 'tarjeta')),
  constraint payments_amount_positive
    check (amount > 0)
);

create index payments_sales_note_paid_at_idx
  on public.payments (sales_note_id, paid_at desc);
create index payments_method_idx
  on public.payments (method, paid_at desc);

-- ============================================================================
-- Triggers: stamp created_by, recompute parent status
-- ============================================================================
-- Dedicated stamp for this table — stamp_actor_columns() assumes
-- updated_by exists, which is omitted here by design. We only care
-- about created_by on INSERT; UPDATE paths (admin correction) leave
-- the existing created_by intact.
create or replace function public.payments_stamp_created_by()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger payments_stamp_created_by
before insert on public.payments
for each row
execute function public.payments_stamp_created_by();

-- Recomputes sales_notes.status after every payment mutation.
--
-- SECURITY DEFINER so the UPDATE on sales_notes bypasses the
-- admin-only UPDATE policy installed by LIT-28. This is the ONE
-- sanctioned path for a non-admin action to flip a note's status.
--
-- Cancelled notes are skipped — once an admin cancels, later
-- payments (if any slip past the INSERT policy) must not resurrect
-- the note.
create or replace function public.payments_recompute_note_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(new.sales_note_id, old.sales_note_id);
  note_total numeric(12, 2);
  note_status text;
  paid_sum numeric(12, 2);
  next_status text;
begin
  select s.total, s.status
    into note_total, note_status
  from public.sales_notes s
  where s.id = target_id;

  if note_status is null then
    -- Parent disappeared mid-flight (FK is RESTRICT, so this shouldn't
    -- happen — defensive no-op).
    return coalesce(new, old);
  end if;

  if note_status = 'cancelada' then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
    into paid_sum
  from public.payments
  where sales_note_id = target_id;

  if paid_sum = 0 then
    next_status := 'pendiente';
  elsif paid_sum < note_total then
    next_status := 'abonada';
  else
    next_status := 'pagada';
  end if;

  if next_status <> note_status then
    update public.sales_notes
       set status = next_status
     where id = target_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger payments_recompute_note_status
after insert or update or delete on public.payments
for each row
execute function public.payments_recompute_note_status();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.payments enable row level security;

-- SELECT: shared visibility, same as sales_notes.
create policy payments_select_auth on public.payments
for select
to authenticated
using (true);

-- INSERT: any authenticated user capturing a payment against a
-- non-cancelled parent. created_by must match the caller if supplied
-- — the stamp trigger also enforces this, but the policy belt
-- catches a forged payload before the trigger runs.
create policy payments_insert_auth on public.payments
for insert
to authenticated
with check (
  (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and s.status <> 'cancelada'
  )
);

-- UPDATE: admin-only. Correcting a captured payment is a privileged
-- operation; ventas users must insert a compensating row instead.
create policy payments_update_admin on public.payments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy. Payments are append-only (ticket AC).

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('payments');

select public.assert_all_tables_have_rls();
