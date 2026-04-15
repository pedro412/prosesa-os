-- Regression test for LIT-15.
--
-- Verifies that attaching the audit trigger to a table produces exactly one
-- audit_logs entry per INSERT/UPDATE/DELETE. Wrapped in BEGIN/ROLLBACK so
-- nothing persists — safe to run against staging or production at any time.
--
-- Run from the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/scripts/test-audit.sql

begin;

create table public._audit_test (
  id uuid primary key default gen_random_uuid(),
  payload text
);
alter table public._audit_test enable row level security;

select audit.attach('_audit_test');

insert into public._audit_test (payload) values ('hello');
update public._audit_test set payload = 'world';
delete from public._audit_test;

do $$
declare
  n_insert int;
  n_update int;
  n_delete int;
begin
  select count(*) into n_insert
    from public.audit_logs
    where table_name = '_audit_test' and action = 'INSERT';
  select count(*) into n_update
    from public.audit_logs
    where table_name = '_audit_test' and action = 'UPDATE';
  select count(*) into n_delete
    from public.audit_logs
    where table_name = '_audit_test' and action = 'DELETE';

  if n_insert <> 1 then
    raise exception 'audit regression: expected 1 INSERT log, got %', n_insert;
  end if;
  if n_update <> 1 then
    raise exception 'audit regression: expected 1 UPDATE log, got %', n_update;
  end if;
  if n_delete <> 1 then
    raise exception 'audit regression: expected 1 DELETE log, got %', n_delete;
  end if;

  raise notice 'audit regression test passed: 1 INSERT + 1 UPDATE + 1 DELETE recorded.';
end
$$;

rollback;
