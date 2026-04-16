-- Self-serve full_name edit for LIT-73.
--
-- The profiles table only has profiles_select_self + profiles_update_admin
-- policies (LIT-13). Adding a profiles_update_self policy that whitelisted
-- only full_name would require column-level WITH CHECK gymnastics that
-- Postgres doesn't express cleanly — and any escape hatch there could
-- accidentally let clients UPDATE their own role / is_active /
-- deleted_at, defeating the LIT-65 self-mutation guard.
--
-- Instead this ships the narrowest possible API: a SECURITY DEFINER
-- function that updates only public.profiles.full_name on the row
-- where id = auth.uid(). Same pattern as public.list_admin_profiles.
--
-- The audit trigger attached to profiles in LIT-65 captures the change
-- with the actor = the user themselves.

create or replace function public.update_own_full_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text := trim(coalesce(p_full_name, ''));
begin
  if length(trimmed) < 1 or length(trimmed) > 120 then
    raise exception
      'El nombre debe tener entre 1 y 120 caracteres'
      using errcode = 'invalid_parameter_value';
  end if;

  if auth.uid() is null then
    raise exception
      'Sesión inválida'
      using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set full_name = trimmed
  where id = auth.uid();
end;
$$;

revoke all on function public.update_own_full_name(text) from public;
grant execute on function public.update_own_full_name(text) to authenticated;

select public.assert_all_tables_have_rls();
