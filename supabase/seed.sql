-- Local development seed.
--
-- Runs after `supabase db reset` against the local Supabase stack. It does
-- NOT run against staging or production — those environments follow the
-- same dashboard-invite + manual-promote flow documented in
-- docs/auth-bootstrap.md.
--
-- Flow for local dev:
--   1. supabase start
--   2. In the local Supabase Studio, invite admin@prosesa.local and set a
--      password (or use `supabase auth admin create-user` via the CLI).
--   3. supabase db reset  →  this file runs and promotes that user to admin.
--
-- If the user has not been created yet, the UPDATE is a no-op and the next
-- reset will pick them up.

update public.profiles
set role = 'admin'
where email = 'admin@prosesa.local'
  and role <> 'admin';
