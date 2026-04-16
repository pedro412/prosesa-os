-- Admin extras for the in-app user management UI (LIT-65).
--
-- Three concerns, all on public.profiles:
--   1. Attach the audit trigger so role / is_active / deleted_at changes
--      land in audit_logs (CLAUDE.md §7 invariant).
--   2. Self-mutation guard: an admin cannot demote, deactivate, or
--      soft-delete themselves through the app. Migrations bypass via
--      auth.uid() = null.
--   3. Last-admin protection: prevent any UPDATE that would leave the
--      org with zero usable admins (active, non-deleted, role='admin').
--
-- Plus a SECURITY DEFINER list helper that joins profiles with
-- auth.users.last_sign_in_at so the admin UI can show "último acceso"
-- without exposing auth.users to the client.

-- ============================================================================
-- 1. Audit attach
-- ============================================================================
select audit.attach('profiles');

-- ============================================================================
-- 2 + 3. Combined guard trigger
-- ============================================================================
create or replace function public.guard_profile_admin_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins int;
begin
  -- Self-mutation guard. auth.uid() is null at migration time, so seed
  -- migrations and the handle_new_user trigger sail through.
  if old.id = auth.uid() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.deleted_at is distinct from old.deleted_at then
      raise exception
        'No puedes modificar tu propio rol, estado o eliminación desde la app'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Last-admin protection. Only fires when the row WAS a usable admin
  -- and the change WOULD remove that status (demote, deactivate, or
  -- soft-delete). Counts the admins that would remain afterward.
  if old.role = 'admin'
     and old.is_active
     and old.deleted_at is null
     and (
       new.role is distinct from 'admin'
       or new.is_active = false
       or new.deleted_at is not null
     ) then
    select count(*) into remaining_admins
    from public.profiles
    where id != old.id
      and role = 'admin'
      and is_active
      and deleted_at is null;

    if remaining_admins = 0 then
      raise exception
        'No puedes degradar, desactivar ni eliminar al último administrador activo'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_admin_changes
before update on public.profiles
for each row
execute function public.guard_profile_admin_changes();

-- ============================================================================
-- 4. list_admin_profiles — paginated list with last_sign_in_at
-- ============================================================================
--
-- Returns profile rows joined with auth.users.last_sign_in_at, plus a
-- total_count window so the UI can paginate. Gated to admin via an
-- explicit is_admin() check at the top, since SECURITY DEFINER bypasses
-- the profiles RLS policies.
create or replace function public.list_admin_profiles(
  p_include_deleted boolean default false,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Solo administración puede listar usuarios'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with filtered as (
    select p.id, p.email, p.full_name, p.role, p.is_active,
           p.created_at, p.updated_at, p.deleted_at,
           u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p_include_deleted or p.deleted_at is null
  )
  select
    f.id, f.email, f.full_name, f.role, f.is_active,
    f.created_at, f.updated_at, f.deleted_at, f.last_sign_in_at,
    count(*) over () as total_count
  from filtered f
  order by f.email asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_admin_profiles(boolean, int, int) from public;
grant execute on function public.list_admin_profiles(boolean, int, int) to authenticated;

select public.assert_all_tables_have_rls();
