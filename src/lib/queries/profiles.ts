import { useQuery } from '@tanstack/react-query'

import type { Profile, ProfileRole } from '@/types/profile'

import { supabase } from '../supabase'

export const profileKeys = {
  all: ['profiles'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return (data as Profile | null) ?? null
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: getCurrentProfile,
    staleTime: 60_000,
  })
}

export function hasRole(profile: Pick<Profile, 'role'> | null | undefined, role: ProfileRole) {
  return profile?.role === role
}

export function isAdmin(profile: Pick<Profile, 'role'> | null | undefined) {
  return hasRole(profile, 'admin')
}

export function isVentas(profile: Pick<Profile, 'role'> | null | undefined) {
  return hasRole(profile, 'ventas')
}
