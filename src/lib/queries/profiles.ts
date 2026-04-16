import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  // Cast narrows role from string → ProfileRole; CHECK constraint on the DB
  // guarantees the value is within the union.
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

// Calls the SECURITY DEFINER function shipped in LIT-73 — the narrowest
// API for self-edit (only full_name, only on the caller's own row).
// Validation lives in the function; the client-side mutation just
// surfaces the result.
export async function updateOwnFullName(name: string): Promise<void> {
  const { error } = await supabase.rpc('update_own_full_name', { p_full_name: name })
  if (error) throw error
}

export function useUpdateOwnFullName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateOwnFullName,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.current() })
      // Admin user list also shows full_name — keep it in sync without
      // forcing the user to refresh /settings/users.
      qc.invalidateQueries({ queryKey: ['admin-profiles'] })
    },
  })
}
