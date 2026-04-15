-- Profiles, roles, RLS, and auth.users trigger for LIT-13.
--
-- Design notes (keep in sync with CLAUDE.md §7 and §9):
--   * role is a scalar string so we can extend it (produccion, diseno,
--     instalacion, facturacion, gerencia) without a migration. The CHECK
--     constraint enumerates only the MVP values; relax it when new roles land.
--   * Profile rows are populated exclusively by the handle_new_user trigger
--     on auth.users, so RLS does not grant INSERT to clients.
--   * is_admin() is SECURITY DEFINER to sidestep RLS recursion when policies
--     on profiles need to check the caller's role.

-- Reusable touch-updated-at helper (first migration to need it).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'ventas',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_role_check check (role in ('admin', 'ventas'))
);

create index profiles_role_idx on public.profiles (role) where deleted_at is null;
create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Role helper used by RLS policies on this and later tables.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active
      and p.deleted_at is null
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Auto-create a profile for every new auth user. Email and full_name flow in
-- via raw_user_meta_data (Supabase dashboard invite sets these) and fall back
-- to the auth.users.email column.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data ->> 'email'),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Callers can read their own row.
create policy profiles_select_self on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Admins can read all rows.
create policy profiles_select_admin on public.profiles
for select
to authenticated
using (public.is_admin());

-- Admins can update any row (promote/demote, toggle is_active, soft delete).
create policy profiles_update_admin on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No INSERT or DELETE policies: the trigger owns inserts, and deletes happen
-- through UPDATE deleted_at (covered by the admin update policy).
