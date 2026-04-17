-- LIT-81: enforce uniqueness on customers.telefono and lower(email).
--
-- Two recepcionistas double-capturing the same cliente is a common
-- path to dirty data; unique indexes in the DB are the source of
-- truth. The form's 23505 → field-error mapping (shipped alongside
-- this migration) is just UX on top.
--
-- Partial indexes (WHERE deleted_at IS NULL): soft-deleted customers
-- shouldn't block recapturing the same phone/email on a fresh row —
-- the point of soft-delete is that the record is archived, not
-- reserved forever.

-- ============================================================================
-- Pre-dedup
-- ============================================================================
-- Any existing duplicates among LIVE rows get their contact info
-- rewritten to unique placeholders so the unique indexes below can be
-- created without failing. Soft-deleted rows are untouched — their
-- data stays as historical truth.
--
-- Telefono placeholder: '999' + 7-digit row counter. Passes LIT-80's
-- 10-digit CHECK, reserved-looking so Karina can spot it as "needs
-- updating" via the UI. Unlikely to collide with real MX phones.
--
-- Email duplicates: the dupes get nulled out. email is nullable, and
-- keeping the primary contact on the oldest row is the safer default
-- than inventing a synthetic address.

with tel_dups as (
  select id,
         row_number() over (partition by telefono order by created_at, id) as rn
  from public.customers
  where deleted_at is null
),
tel_to_fix as (
  select id, row_number() over (order by id) as new_n
  from tel_dups
  where rn > 1
)
update public.customers c
set telefono = '999' || lpad(f.new_n::text, 7, '0')
from tel_to_fix f
where c.id = f.id;

with email_dups as (
  select id,
         row_number() over (partition by lower(email) order by created_at, id) as rn
  from public.customers
  where deleted_at is null
    and email is not null
)
update public.customers c
set email = null
from email_dups d
where c.id = d.id
  and d.rn > 1;

-- ============================================================================
-- Unique partial indexes
-- ============================================================================

create unique index customers_telefono_unique
  on public.customers (telefono)
  where deleted_at is null;

create unique index customers_email_unique
  on public.customers (lower(email))
  where deleted_at is null
    and email is not null;

-- The non-unique telefono btree from 20260415234309_customers.sql is
-- redundant now — the unique index can serve equality lookups just as
-- well. Dropping it keeps the table's index footprint tight.
drop index if exists public.customers_telefono_idx;

select public.assert_all_tables_have_rls();
