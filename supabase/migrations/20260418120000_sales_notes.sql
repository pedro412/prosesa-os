-- Sales notes (notas de venta) for LIT-28 / M3-1.
--
-- The primary internal receipt per SPEC §4.4. Every counter sale and
-- every project sale produces a sales_note. This migration ships only
-- the header row — lines (LIT-29) and payments (LIT-30) follow in their
-- own migrations.
--
-- Design notes:
--   * Per-company folios are minted via public.next_folio(company_id,
--     'sales_note') from LIT-23. A BEFORE INSERT trigger fills `folio`
--     if the caller didn't supply one, so the POS form doesn't need to
--     orchestrate a separate RPC and the folio-or-row atomicity is
--     enforced at the DB.
--   * IVA rate + inclusive flag are snapshotted at creation so a future
--     admin edit on companies.iva_rate doesn't rewrite historical
--     totals. Math helpers (LIT-32, src/lib/tax.ts) consume these
--     snapshot columns, not the live company values.
--   * work_order_id is nullable and carries no FK yet — work_orders
--     lands in M4 (LIT-41), which adds the FK in its own migration.
--   * status transitions:
--       - initial: 'pendiente' (no payments yet) or 'pagada' (charged
--         in full at creation), set by the caller based on the payment
--         dialog outcome.
--       - 'abonada': partial payments exist but sum < total.
--       - 'cancelada': admin cancellation via UPDATE. Requires
--         cancelled_at + cancellation_reason per CLAUDE.md §8.
--     After M3-3 lands, the payments trigger recomputes the status
--     automatically on every payment insert/update — but non-admin
--     users cannot UPDATE sales_notes directly, so the trigger is the
--     only runtime writer besides INSERT.
--   * RLS: SELECT and INSERT open to authenticated (ventas + admin
--     both need to create sales). UPDATE is admin-only so cancellation
--     and header edits stay governed; the SECURITY DEFINER payments
--     trigger in LIT-30 bypasses this to flip status.

-- ============================================================================
-- sales_notes table
-- ============================================================================
create table public.sales_notes (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  company_id uuid not null references public.companies (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,
  status text not null default 'pendiente',
  subtotal numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  iva_rate_snapshot numeric(5, 4) not null,
  iva_inclusive_snapshot boolean not null,
  requires_invoice boolean not null default false,
  notes text,
  work_order_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint sales_notes_status_check
    check (status in ('pagada', 'pendiente', 'abonada', 'cancelada')),
  constraint sales_notes_amounts_non_negative
    check (subtotal >= 0 and iva >= 0 and total >= 0),
  constraint sales_notes_iva_rate_range
    check (iva_rate_snapshot >= 0 and iva_rate_snapshot <= 1),
  -- cancellation state must be internally consistent: cancelled iff
  -- cancelled_at is set. Reason and actor are NOT required by the
  -- constraint because seed / migration-time corrections may need to
  -- retroactively mark a row cancelled without synthesizing metadata,
  -- but the admin UI will always supply all three.
  constraint sales_notes_cancellation_consistency
    check ((status = 'cancelada') = (cancelled_at is not null))
);

-- Per-company folios are unique. The global `folio` column is also
-- practically unique given company codes don't collide (A-0001 vs
-- B-0001), but the composite constraint is what matches the
-- per-company sequence semantics.
create unique index sales_notes_company_folio_unique
  on public.sales_notes (company_id, folio);

-- Common list-view filters.
create index sales_notes_company_created_idx
  on public.sales_notes (company_id, created_at desc);
create index sales_notes_status_idx
  on public.sales_notes (status)
  where status <> 'pagada';
create index sales_notes_customer_idx
  on public.sales_notes (customer_id)
  where customer_id is not null;

-- ============================================================================
-- Triggers: updated_at, actor stamping, folio assignment
-- ============================================================================
create trigger sales_notes_set_updated_at
before update on public.sales_notes
for each row
execute function public.set_updated_at();

create trigger sales_notes_stamp_actor
before insert or update on public.sales_notes
for each row
execute function public.stamp_actor_columns();

-- Assigns a per-company monotonic folio on INSERT when the caller
-- didn't supply one. Calling `next_folio` from a trigger (rather than
-- an app-layer RPC) guarantees folio + row land in the same
-- transaction and removes one place a POS form could forget to mint
-- it.
create or replace function public.sales_notes_assign_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null or length(trim(new.folio)) = 0 then
    new.folio := public.next_folio(new.company_id, 'sales_note');
  end if;
  return new;
end;
$$;

create trigger sales_notes_assign_folio
before insert on public.sales_notes
for each row
execute function public.sales_notes_assign_folio();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.sales_notes enable row level security;

-- SELECT: sales history is shared across razones sociales (CLAUDE.md §6).
-- Every authenticated user sees every note. Per-company scoping happens
-- at the UI layer via filters, not RLS.
create policy sales_notes_select_auth on public.sales_notes
for select
to authenticated
using (true);

-- INSERT: any authenticated user can create a sale. `company_id` must
-- be attached (per-document choice per CLAUDE.md §6); created_by must
-- match the caller (the stamp_actor trigger will set it — this check
-- is belt-and-suspenders if a client tries to forge it).
create policy sales_notes_insert_auth on public.sales_notes
for insert
to authenticated
with check (
  company_id is not null
  and (created_by is null or created_by = auth.uid())
);

-- UPDATE: admin-only. Covers cancellation and any header edits.
-- Non-admin users never mutate sales_notes directly; status changes
-- driven by payments flow through the SECURITY DEFINER trigger in
-- LIT-30, which bypasses this policy.
create policy sales_notes_update_admin on public.sales_notes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy. Sales notes are never hard-deleted; cancellation
-- is the admin-only "remove" path (CLAUDE.md §4 rule 11).

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('sales_notes');

select public.assert_all_tables_have_rls();
