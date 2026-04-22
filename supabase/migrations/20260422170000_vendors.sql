-- LIT-107: vendors (vendedores de campo) — attribution target on sales_notes.
--
-- Vendedores are business entities, NOT ProsesaOS users. They're out on
-- the street closing deals informally (WhatsApp / paper) and hand the
-- data to recepción (Gustavo) for capture. They may or may not have an
-- account; `user_id` is the optional future link for when they do.
--
-- Simpler than customers:
--   * No fiscal fields (not invoice targets).
--   * No soft-delete / papelera — `is_active` toggle is enough.
--     Historical notas keep their FK even when a vendor is deactivated.
--   * Admin-only CRUD (settings-data, not transactional).
--   * All authenticated users can SELECT, so the POS picker populates
--     for the `ventas` role (Gustavo) without special grants.

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  is_active boolean not null default true,
  -- Optional link to a profiles row. Future: if a vendedor gets an
  -- account in ProsesaOS, admin sets this FK so reports can join by
  -- login. Today it stays null everywhere.
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint vendors_nombre_not_blank check (length(trim(nombre)) > 0)
);

-- Picker queries filter on is_active and sort by nombre. A partial
-- index on active rows keeps the hot path tight without hurting
-- admin-side lists that include inactive rows.
create index vendors_active_nombre_idx
  on public.vendors (lower(nombre))
  where is_active;

-- ============================================================================
-- Triggers: updated_at + actor stamping
-- ============================================================================
create trigger vendors_set_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at();

create trigger vendors_stamp_actor
before insert or update on public.vendors
for each row
execute function public.stamp_actor_columns();

-- ============================================================================
-- RLS — admin CRUD; ventas (and admin) read
-- ============================================================================
alter table public.vendors enable row level security;

-- SELECT: all authenticated users so Gustavo (`ventas`) can populate
-- the POS picker. No filter on is_active here — the picker component
-- applies it client-side, and admin lists need to show inactive rows
-- to toggle them.
create policy vendors_select_auth on public.vendors
for select
to authenticated
using (true);

create policy vendors_insert_admin on public.vendors
for insert
to authenticated
with check (public.is_admin());

create policy vendors_update_admin on public.vendors
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy. Admins deactivate via UPDATE setting is_active=false.
-- Hard deletion isn't supported because it would cascade
-- `sales_notes.vendor_id` FK to NULL and destroy historical attribution.

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('vendors');

select public.assert_all_tables_have_rls();
