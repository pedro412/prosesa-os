-- Idempotently promote a profile to the 'admin' role.
--
-- The user must already exist in auth.users (dashboard invite → password set)
-- so that the handle_new_user trigger has created the matching profile row.
--
-- Run from the Supabase dashboard SQL editor, or via psql with the variable:
--   psql "$DATABASE_URL" -v admin_email="'karina@example.com'" \
--        -f supabase/scripts/promote-admin.sql
--
-- SAFETY: this script is additive (role UPDATE only). It never creates an
-- auth.users row and never grants admin retroactively without the invite
-- flow. It fails loudly if no matching profile exists so a typo in the email
-- cannot silently succeed.

do $$
declare
  target_email text := :admin_email;
  updated_count integer;
begin
  update public.profiles
  set role = 'admin'
  where lower(email) = lower(target_email)
    and deleted_at is null;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    raise exception
      'No active profile found for email %. Invite the user via the Supabase dashboard first, then re-run.',
      target_email;
  end if;

  raise notice 'Promoted % profile(s) with email % to admin.', updated_count, target_email;
end
$$;
