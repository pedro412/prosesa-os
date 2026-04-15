-- List every public table that is missing row-level security.
--
-- Triage helper for when `public.assert_all_tables_have_rls()` fails during a
-- migration, or when you want a quick audit of the current schema. Safe to
-- run anywhere: read-only, returns a table.
--
-- Run in the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/scripts/check-rls.sql

select
  t.schemaname,
  t.tablename,
  t.tableowner,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass)) as size,
  (select count(*) from pg_policies p
    where p.schemaname = t.schemaname
      and p.tablename = t.tablename
  ) as policy_count
from pg_tables t
where t.schemaname = 'public'
  and t.rowsecurity = false
order by t.tablename;
