-- Catalog (categories + items) for LIT-26.
--
-- Per SPEC §4.2 and CLAUDE.md §6, the catalog is shared across both
-- razones sociales. There is no company_id here — company attribution
-- happens on the consuming sales_note / work_order, not on the catalog
-- entry itself.
--
-- Two tables:
--   catalog_categories — top-level grouping (Lonas, Vinil, …).
--   catalog_items      — products / services priced individually.
--
-- Seeded with the nine categories from SPEC §4.2; items are added by
-- admins via the catalog CRUD UI (LIT-27).
--
-- Search: pg_trgm GIN index over (name || ' ' || coalesce(description, ''))
-- powers the POS lookup ("lon" → "Lona 13oz") via plain ILIKE without
-- needing a tsvector dictionary or query parser. Upgrade to tsvector
-- later if the catalog grows past trigram's comfortable scale.

create extension if not exists pg_trgm;

-- ============================================================================
-- catalog_categories
-- ============================================================================
create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint catalog_categories_name_not_blank check (length(trim(name)) > 0)
);

-- Case-insensitive uniqueness among live rows. "Lonas" and "lonas"
-- collide; soft-deleted rows can collide so a tombstoned category name
-- can be reused.
create unique index catalog_categories_name_unique
  on public.catalog_categories (lower(name))
  where deleted_at is null;

create index catalog_categories_is_active_idx
  on public.catalog_categories (is_active)
  where deleted_at is null;

create trigger catalog_categories_set_updated_at
before update on public.catalog_categories
for each row
execute function public.set_updated_at();

create trigger catalog_categories_stamp_actor
before insert or update on public.catalog_categories
for each row
execute function public.stamp_actor_columns();

-- ============================================================================
-- catalog_items
-- ============================================================================
--
-- unit is a CHECK constraint rather than a Postgres ENUM so adding new
-- units later is a one-line ALTER instead of an enum migration.
-- pricing_mode follows the same shape.
--
-- price defaults to 0 and is non-null. Variable-priced items use the
-- catalog row as a template — the operator types the actual price at
-- sale time per SPEC §4.2.
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid not null references public.catalog_categories (id) on delete restrict,
  unit text not null,
  price numeric(12, 2) not null default 0,
  pricing_mode text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint catalog_items_name_not_blank check (length(trim(name)) > 0),
  constraint catalog_items_unit_check check (unit in ('pieza', 'm2', 'm', 'litro', 'rollo', 'hora')),
  constraint catalog_items_pricing_mode_check check (pricing_mode in ('fixed', 'variable')),
  constraint catalog_items_price_non_negative check (price >= 0)
);

create index catalog_items_category_idx
  on public.catalog_items (category_id)
  where deleted_at is null;

create index catalog_items_is_active_idx
  on public.catalog_items (is_active)
  where deleted_at is null;

-- Trigram GIN over name + description. Powers ILIKE substring search
-- in the POS lookup. The expression is wrapped in coalesce so rows
-- without a description still index cleanly.
create index catalog_items_search_idx
  on public.catalog_items
  using gin ((name || ' ' || coalesce(description, '')) gin_trgm_ops)
  where deleted_at is null;

create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row
execute function public.set_updated_at();

create trigger catalog_items_stamp_actor
before insert or update on public.catalog_items
for each row
execute function public.stamp_actor_columns();

-- ============================================================================
-- RLS — Template 1 (admin-only write, all-authenticated read)
-- ============================================================================
alter table public.catalog_categories enable row level security;

create policy catalog_categories_select_auth on public.catalog_categories
for select
to authenticated
using (deleted_at is null or public.is_admin());

create policy catalog_categories_insert_admin on public.catalog_categories
for insert
to authenticated
with check (public.is_admin());

create policy catalog_categories_update_admin on public.catalog_categories
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy: soft-delete via update of deleted_at.

alter table public.catalog_items enable row level security;

create policy catalog_items_select_auth on public.catalog_items
for select
to authenticated
using (deleted_at is null or public.is_admin());

create policy catalog_items_insert_admin on public.catalog_items
for insert
to authenticated
with check (public.is_admin());

create policy catalog_items_update_admin on public.catalog_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy: soft-delete via update of deleted_at.

-- ============================================================================
-- Audit
-- ============================================================================
select audit.attach('catalog_categories');
select audit.attach('catalog_items');

-- ============================================================================
-- Seed: SPEC §4.2 categories
-- ============================================================================
insert into public.catalog_categories (name) values
  ('Lonas'),
  ('Vinil'),
  ('Papelería'),
  ('Stickers'),
  ('Grabado láser'),
  ('Rotulación'),
  ('Diseño'),
  ('Impresión'),
  ('Estructuras');

select public.assert_all_tables_have_rls();
