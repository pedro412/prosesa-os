-- Audit log infrastructure for LIT-15.
--
-- Shape per CLAUDE.md §7:
--   id, table_name, record_id, action, old_data, new_data, user_id, user_role, created_at
--
-- One generic trigger (audit.audit_row) is attached to business tables as
-- they land via audit.attach('table_name'). Append-only: writes come from
-- the SECURITY DEFINER trigger; updates and deletes are forbidden by RLS
-- and by a raw REVOKE (belt + suspenders per the policy kit).
--
-- Invariant: every audited table must have a uuid primary key named `id`.
-- See supabase/migrations/README.md for the convention.

create schema if not exists audit;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  user_id uuid references auth.users (id) on delete set null,
  user_role text,
  created_at timestamptz not null default now()
);

create index audit_logs_table_record_idx
  on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_user_idx
  on public.audit_logs (user_id, created_at desc)
  where user_id is not null;
create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- Admins can read the history.
create policy audit_logs_select_admin on public.audit_logs
for select
to authenticated
using (public.is_admin());

-- No client INSERT policy. The trigger function below runs as SECURITY
-- DEFINER (owned by the migration role, which has BYPASSRLS in Supabase),
-- so it can write without any policy granting INSERT to authenticated.
--
-- Belt and suspenders: if a future policy author accidentally grants
-- UPDATE or DELETE, the base privilege is already revoked.
revoke update, delete on public.audit_logs from authenticated, service_role;

-- Generic row-level audit trigger. Attached to a target table via
-- audit.attach(target_table_name).
create or replace function audit.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, audit
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := public.current_role();
  record_uuid uuid;
  old_json jsonb;
  new_json jsonb;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    record_uuid := (new_json ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);
    record_uuid := (new_json ->> 'id')::uuid;
  elsif tg_op = 'DELETE' then
    old_json := to_jsonb(old);
    record_uuid := (old_json ->> 'id')::uuid;
  end if;

  if record_uuid is null then
    raise exception
      'audit.audit_row: table %.% is missing a uuid id column — audit requires the uuid-pk convention (see supabase/migrations/README.md)',
      tg_table_schema, tg_table_name;
  end if;

  insert into public.audit_logs (
    table_name, record_id, action, old_data, new_data, user_id, user_role
  ) values (
    tg_table_name, record_uuid, tg_op, old_json, new_json, actor_id, actor_role
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

-- Attaches (or re-attaches) the audit trigger to a table in public.
-- Idempotent: drops any existing audit_trigger on the target first.
create or replace function audit.attach(target_table text)
returns void
language plpgsql
security definer
set search_path = public, audit
as $$
begin
  execute format(
    'drop trigger if exists audit_trigger on public.%I',
    target_table
  );
  execute format(
    'create trigger audit_trigger
       after insert or update or delete on public.%I
       for each row execute function audit.audit_row()',
    target_table
  );
end
$$;

revoke all on function audit.attach(text) from public;
-- attach() is a migration-time utility; never granted to authenticated or
-- service_role. Call it from migrations only.

-- Policy kit invariant — passes with the new audit_logs table (RLS on).
select public.assert_all_tables_have_rls();
