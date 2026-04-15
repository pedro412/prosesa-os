-- Bug report capture for LIT-16. Ships early (per CLAUDE.md §15) so Karina
-- can file issues from the first staging drop.
--
-- Shape:
--   description      — what the user is reporting (required)
--   url              — window.location.href at submit time
--   user_id          — set server-side from auth.uid() (can't be spoofed)
--   user_role        — set server-side from public.current_role()
--   user_agent       — navigator.userAgent, sent by the client
--   screenshot_url   — storage path inside the bug-screenshots bucket
--                      (NOT a signed URL; admin UI signs on demand)
--
-- RLS: authenticated users INSERT; admin SELECT. No UPDATE/DELETE —
-- reports are append-only; if a duplicate is needed, re-file.
--
-- Audit: not attached. Bug reports are already a self-contained log;
-- auditing their inserts would double the noise without value.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  url text,
  user_id uuid references auth.users (id) on delete set null,
  user_role text,
  user_agent text,
  screenshot_url text,
  created_at timestamptz not null default now()
);

create index bug_reports_created_at_idx on public.bug_reports (created_at desc);
create index bug_reports_user_idx
  on public.bug_reports (user_id, created_at desc)
  where user_id is not null;

-- Server-side stamping of identity. Even if a client tries to send a
-- different user_id / user_role, this trigger overwrites both fields
-- with the authoritative values before the row lands. Keeps admins'
-- triage data trustworthy.
create or replace function public.bug_reports_stamp_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.user_role := public.current_role();
  return new;
end
$$;

create trigger bug_reports_stamp_identity_trigger
before insert on public.bug_reports
for each row
execute function public.bug_reports_stamp_identity();

alter table public.bug_reports enable row level security;

-- Any logged-in user can file a report. The trigger above guarantees
-- the row is stamped with their own user_id.
create policy bug_reports_insert_auth on public.bug_reports
for insert
to authenticated
with check (true);

-- Admins review the queue.
create policy bug_reports_select_admin on public.bug_reports
for select
to authenticated
using (public.is_admin());

-- Append-only per the policy kit (audit-style lock).
revoke update, delete on public.bug_reports from authenticated, service_role;

-- Storage bucket for optional manual screenshots. Private: admin reads
-- only via signed URLs.
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', false)
on conflict (id) do nothing;

-- Authenticated users can upload into their own folder
-- (bug-screenshots/<uid>/...). Prevents writing over someone else's path.
create policy bug_screenshots_insert_auth on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bug-screenshots'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins read everything in the bucket (to triage and display).
create policy bug_screenshots_select_admin on storage.objects
for select
to authenticated
using (
  bucket_id = 'bug-screenshots'
  and public.is_admin()
);

-- No UPDATE or DELETE policies: screenshots are immutable evidence.

select public.assert_all_tables_have_rls();
