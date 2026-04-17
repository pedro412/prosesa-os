-- Make customers.telefono required (LIT-80).
--
-- QA (LIT-79 §1/§4) asked us to require a phone number on every
-- customer and constrain it to a 10-digit MX national format. The
-- form enforces the rule in zod, and this migration is the DB-side
-- half of the guarantee.
--
-- Existing rows: the only data so far is a seed batch (all 10-digit
-- phones) plus anything Karina has captured in staging. Any
-- non-compliant row is backfilled with '0000000000' — an obviously
-- placeholder value that shows up in the UI and prompts an update.
-- That's safer than failing the migration, since staging is a
-- shared workspace and Karina is actively testing.
--
-- Production doesn't exist yet (LIT-59), so there's no prod dataset
-- to worry about. When prod is provisioned, the migration runs on an
-- empty table and the backfill is a no-op.

-- Step 1: backfill. Matches rows where telefono is null OR fails the
-- 10-digit-exact pattern (covers legacy test data with dashes, spaces,
-- partial numbers, etc.).
update public.customers
set telefono = '0000000000'
where telefono is null
   or telefono !~ '^\d{10}$';

-- Step 2: lock it in. NOT NULL + CHECK are a belt-and-braces pair —
-- the CHECK alone wouldn't block NULLs, and the NOT NULL alone
-- wouldn't block '123' or '55 5555 5555'.
alter table public.customers
  alter column telefono set not null;

alter table public.customers
  add constraint customers_telefono_10_digits
  check (telefono ~ '^\d{10}$');

select public.assert_all_tables_have_rls();
