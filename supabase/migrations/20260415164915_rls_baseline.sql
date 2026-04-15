-- RLS baseline policy kit for LIT-14.
--
-- Establishes two reusable helpers for policy code and an assertion that
-- fails the migration if any table in the public schema ships without RLS
-- enabled. See supabase/migrations/README.md for the policy kit (templates,
-- naming conventions, audit-log enforcement).
--
-- Helpers live in `public` (not `auth`) on purpose: the `auth` schema is
-- managed by Supabase/GoTrue and hand-written objects there risk being
-- clobbered by future platform migrations. public.is_admin() already exists
-- from the profiles migration.

-- Current role for the calling user, or null if no active profile exists.
-- Call sites use this when a policy needs finer-grained dispatch than
-- is_admin() allows (e.g. future ventas-only rules).
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
    and p.deleted_at is null
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

-- Guardrail: fail loudly if any public.* table is missing RLS. Every new
-- table migration should end with `select public.assert_all_tables_have_rls();`
-- (see supabase/migrations/README.md).
--
-- The allowlist lets us exempt deliberately-public artifacts (materialized
-- views surfaced as tables, seed-only lookup tables). Use it sparingly and
-- document the exception in the migration that adds the name.
create or replace function public.assert_all_tables_have_rls(allowlist text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  offenders text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
  into offenders
  from pg_tables
  where schemaname = 'public'
    and rowsecurity = false
    and tablename <> all(allowlist);

  if offenders is not null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = format(
        'RLS baseline violation: the following public tables ship without row level security: %s. '
        'Enable RLS and declare policies in the same migration, then re-run.',
        offenders
      );
  end if;
end
$$;

revoke all on function public.assert_all_tables_have_rls(text[]) from public;

-- Runs against the current schema. Passes today because the only public
-- table is `profiles`, which already has RLS on (per LIT-13).
select public.assert_all_tables_have_rls();
