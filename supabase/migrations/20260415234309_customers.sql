-- Customers registry + Público en general sentinel for LIT-24.
--
-- Customers are shared across both razones sociales (see CLAUDE.md §6 —
-- company choice is per-document, customer list is not scoped). Counter
-- sales default to the seeded Público en general row, which carries the
-- Mexican SAT generic RFC XAXX010101000.
--
-- This migration also ships a reusable helper, public.stamp_actor_columns(),
-- so future business tables (sales_notes, work_orders, …) can keep the
-- created_by/updated_by bookkeeping consistent without duplicating trigger
-- code.

-- ============================================================================
-- Reusable helper: stamp created_by/updated_by from auth.uid()
-- ============================================================================
--
-- CLAUDE.md §7 mandates created_by/updated_by on every business table.
-- This trigger fills them from auth.uid() and prevents created_by from
-- ever being rewritten on UPDATE. Attach per table:
--
--   create trigger <table>_stamp_actor
--   before insert or update on public.<table>
--   for each row
--   execute function public.stamp_actor_columns();
--
-- auth.uid() returns null when the migration runs (no JWT context), so
-- seed rows land with created_by = null, updated_by = null. That's
-- intentional — it distinguishes seeded rows from user-created ones.
create or replace function public.stamp_actor_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;  -- never mutate
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ============================================================================
-- customers table
-- ============================================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  razon_social text,
  rfc text,
  regimen_fiscal text,
  cp_fiscal text,
  telefono text,
  email text,
  requiere_factura boolean not null default false,
  notas text,
  is_publico_general boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint customers_nombre_not_blank check (length(trim(nombre)) > 0),
  constraint customers_rfc_length check (rfc is null or length(rfc) between 12 and 13)
);

-- Search indexes. BTREE covers equality + prefix LIKE; full substring
-- search can upgrade to pg_trgm + GIN if volume demands it.
create index customers_rfc_idx
  on public.customers (rfc)
  where deleted_at is null and rfc is not null;
create index customers_telefono_idx
  on public.customers (telefono)
  where deleted_at is null and telefono is not null;
create index customers_nombre_idx
  on public.customers (lower(nombre))
  where deleted_at is null;

-- At most one Público en general sentinel row, ever. The row is
-- protected from deletion by a trigger below, so the deleted_at
-- clause is not needed here — it would let a "resurrected" sentinel
-- slip through, which we explicitly don't want.
create unique index customers_publico_general_unique
  on public.customers (is_publico_general)
  where is_publico_general = true;

-- ============================================================================
-- Triggers: updated_at, actor stamping, sentinel protection
-- ============================================================================
create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create trigger customers_stamp_actor
before insert or update on public.customers
for each row
execute function public.stamp_actor_columns();

-- Sentinel row is SAT-defined reference data. No edits, no deletions,
-- regardless of role. If the row ever needs to change, do it via a
-- migration where auth.uid() is null (the trigger only guards
-- non-migration paths — constraint is on the row, not the caller, so
-- even migration-time UPDATE/DELETE hit the guard). If a future
-- migration legitimately needs to touch the sentinel, drop the
-- trigger temporarily inside the migration.
create or replace function public.prevent_customer_sentinel_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.is_publico_general then
    raise exception
      'The Público en general sentinel is read-only (row %)', old.id
      using errcode = 'feature_not_supported';
  elsif tg_op = 'DELETE' and old.is_publico_general then
    raise exception
      'Cannot delete the Público en general sentinel (row %)', old.id
      using errcode = 'feature_not_supported';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger customers_prevent_sentinel_mutation
before update or delete on public.customers
for each row
execute function public.prevent_customer_sentinel_mutation();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.customers enable row level security;

-- SELECT: authenticated users see live rows. Admins also see soft-deleted
-- rows so they can resurrect or audit.
create policy customers_select_auth on public.customers
for select
to authenticated
using (deleted_at is null or public.is_admin());

-- INSERT: any authenticated user can create a customer. The trigger
-- stamps created_by/updated_by so the payload doesn't need them.
create policy customers_insert_auth on public.customers
for insert
to authenticated
with check (true);

-- UPDATE: authenticated users edit live rows; only admins can set
-- deleted_at (soft-delete) or edit a soft-deleted row. WITH CHECK
-- enforces that the new row state keeps deleted_at null unless the
-- caller is admin — that's the "admin delete" half of the AC.
create policy customers_update_auth on public.customers
for update
to authenticated
using (deleted_at is null or public.is_admin())
with check (deleted_at is null or public.is_admin());

-- No DELETE policy: hard deletes are forbidden. Admin soft-deletes via
-- the UPDATE policy above.

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('customers');

-- ============================================================================
-- Seed: Público en general sentinel
-- ============================================================================
--
-- Counter sales default to this row when no specific customer is
-- attached to a ticket. RFC XAXX010101000 is the SAT "público en
-- general" generic. nombre is stored in Mexican Spanish for the UI.
insert into public.customers (nombre, rfc, is_publico_general, requiere_factura)
values ('Público en general', 'XAXX010101000', true, false);

select public.assert_all_tables_have_rls();
