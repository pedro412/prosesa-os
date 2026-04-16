import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Profile, ProfileRole } from '@/types/profile'

import { supabase } from '../supabase'
import { profileKeys } from './profiles'

// Row shape returned by the `public.list_admin_profiles` SECURITY DEFINER
// function — Profile + last_sign_in_at + a window total_count for paging.
export interface AdminProfileRow extends Profile {
  last_sign_in_at: string | null
}

export interface PagedAdminProfiles {
  rows: AdminProfileRow[]
  totalCount: number
}

export interface ListAdminProfilesOptions {
  page?: number
  pageSize?: number
  includeDeleted?: boolean
}

const DEFAULT_PAGE_SIZE = 25

export const adminProfileKeys = {
  all: ['admin-profiles'] as const,
  lists: () => [...adminProfileKeys.all, 'list'] as const,
  paged: (opts: ListAdminProfilesOptions = {}) =>
    [
      ...adminProfileKeys.lists(),
      'paged',
      {
        page: opts.page ?? 0,
        pageSize: opts.pageSize ?? DEFAULT_PAGE_SIZE,
        includeDeleted: opts.includeDeleted ?? false,
      },
    ] as const,
}

interface RpcRow {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  last_sign_in_at: string | null
  total_count: string | number
}

export async function listAdminProfiles(
  opts: ListAdminProfilesOptions = {}
): Promise<PagedAdminProfiles> {
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE)

  const { data, error } = await supabase.rpc('list_admin_profiles', {
    p_include_deleted: opts.includeDeleted ?? false,
    p_limit: pageSize,
    p_offset: page * pageSize,
  })

  if (error) throw error
  const rows = (data ?? []) as RpcRow[]

  // total_count is identical on every row (window function); 0 when the
  // page is empty.
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      full_name: r.full_name,
      role: r.role as ProfileRole,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
      last_sign_in_at: r.last_sign_in_at,
    })),
    totalCount,
  }
}

// ============================================================================
// Direct mutations against profiles (admin-only via existing RLS)
// ============================================================================

export async function updateUserRole(id: string, role: ProfileRole) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

export async function updateUserActive(id: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

export async function softDeleteUser(id: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

export async function restoreUser(id: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ deleted_at: null })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

// ============================================================================
// Invite (Edge Function)
// ============================================================================

export type InviteErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_payload'
  | 'invalid_email'
  | 'invalid_role'
  | 'already_invited'
  | 'rate_limited'
  | 'partial_role_update'
  | 'unknown'

export interface InviteUserInput {
  email: string
  full_name?: string | null
  role: ProfileRole
}

export interface InviteUserResult {
  user: { id: string | null; email: string; role: ProfileRole }
}

// Custom error so consumers can branch on .code instead of parsing a
// localized message.
export class InviteUserError extends Error {
  code: InviteErrorCode
  constructor(code: InviteErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'InviteUserError'
  }
}

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const { data, error } = await supabase.functions.invoke<
    InviteUserResult | { error: InviteErrorCode; message: string }
  >('invite-user', { body: input })

  // supabase-js wraps any non-2xx (and 207) into FunctionsHttpError with
  // the JSON body available on the response context. Surface the shape
  // we returned from the function so the caller can map to a toast.
  if (error) {
    // Try to extract the typed error body from the function response.
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      try {
        const text = await ctx.text()
        const parsed = JSON.parse(text) as { error?: InviteErrorCode; message?: string }
        if (parsed?.error) {
          throw new InviteUserError(parsed.error, parsed.message ?? error.message)
        }
      } catch (e) {
        if (e instanceof InviteUserError) throw e
        // fall through to generic
      }
    }
    throw new InviteUserError('unknown', error.message)
  }

  if (data && 'error' in data && data.error) {
    throw new InviteUserError(data.error, data.message)
  }

  return data as InviteUserResult
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function useAdminProfiles(opts: ListAdminProfilesOptions = {}) {
  return useQuery({
    queryKey: adminProfileKeys.paged(opts),
    queryFn: () => listAdminProfiles(opts),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: ProfileRole }) => updateUserRole(id, role),
    onSuccess: (profile) => {
      qc.invalidateQueries({ queryKey: adminProfileKeys.lists() })
      // If the admin updated their own row (somehow — server blocks it but
      // the DB-level guard would have raised), keep the cached current
      // profile in sync.
      qc.invalidateQueries({ queryKey: profileKeys.current() })
      return profile
    },
  })
}

export function useUpdateUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminProfileKeys.lists() })
      qc.invalidateQueries({ queryKey: profileKeys.current() })
    },
  })
}

export function useSoftDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: softDeleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminProfileKeys.lists() })
    },
  })
}

export function useRestoreUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: restoreUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminProfileKeys.lists() })
    },
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminProfileKeys.lists() })
    },
  })
}
