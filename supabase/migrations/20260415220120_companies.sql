-- Companies (razones sociales) for LIT-20.
--
-- Two legal entities back every transactional table (see CLAUDE.md §6).
-- This migration ships the table, settings-bearing columns (IVA config
-- per §8), RLS (all authenticated read, admin write), and attaches the
-- audit trigger. Folio sequences, seed data, and UI land in separate
-- M2 tickets.
--
-- Shape notes:
--   * iva_rate stored as numeric(5,4) — 0.1600 for the Mexican default.
--   * iva_inclusive toggles whether list prices already include IVA.
--     true by default per the SPEC (prices are tax-inclusive but the
--     breakdown is always displayed).
--   * Soft delete via deleted_at; no hard delete policy.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text not null,
  rfc text not null,
  regimen_fiscal text,
  direccion_fiscal text,
  cp_fiscal text,
  logo_url text,
  iva_rate numeric(5, 4) not null default 0.16,
  iva_inclusive boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint companies_iva_rate_check check (iva_rate >= 0 and iva_rate <= 1)
);

-- RFC must be unique among live rows; soft-deleted rows are allowed to
-- collide so an RFC can be re-registered after a tombstone.
create unique index companies_rfc_unique
  on public.companies (rfc)
  where deleted_at is null;

create index companies_is_active_idx
  on public.companies (is_active)
  where deleted_at is null;

create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;

-- Template 1 from supabase/migrations/README.md: admin-only write,
-- all-authenticated read. Soft-deleted rows stay visible to admins so
-- the settings UI can resurrect them later.
create policy companies_select_auth on public.companies
for select
to authenticated
using (deleted_at is null or public.is_admin());

create policy companies_insert_admin on public.companies
for insert
to authenticated
with check (public.is_admin());

create policy companies_update_admin on public.companies
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy: soft-delete via update of deleted_at.

select audit.attach('companies');

select public.assert_all_tables_have_rls();
