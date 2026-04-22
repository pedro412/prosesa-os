import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

// ============================================================================
// Types (LIT-107)
// ============================================================================
//
// Vendedores de campo — business entities, not ProsesaOS users. See
// the migration (supabase/migrations/20260422170000_vendors.sql) for
// schema rationale and RLS shape.

export type Vendor = Database['public']['Tables']['vendors']['Row']
export type VendorUpdate = Database['public']['Tables']['vendors']['Update']
export type NewVendor = Omit<
  Database['public']['Tables']['vendors']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>

export interface ListVendorsOptions {
  // Admin list includes inactive rows (to toggle is_active). POS picker
  // passes false so only active vendors show up.
  includeInactive?: boolean
  search?: string
}

export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (opts: ListVendorsOptions = {}) =>
    [
      ...vendorKeys.lists(),
      {
        includeInactive: opts.includeInactive ?? false,
        search: opts.search?.trim() ?? '',
      },
    ] as const,
  detail: (id: string) => [...vendorKeys.all, 'detail', id] as const,
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[(),]/g, ' ').trim()
}

export async function listVendors(opts: ListVendorsOptions = {}): Promise<Vendor[]> {
  let query = supabase.from('vendors').select('*').order('nombre', { ascending: true })

  if (!opts.includeInactive) {
    query = query.eq('is_active', true)
  }

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      const pattern = `%${sanitized}%`
      query = query.or(`nombre.ilike.${pattern},telefono.ilike.${pattern},email.ilike.${pattern}`)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const { data, error } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createVendor(input: NewVendor): Promise<Vendor> {
  const { data, error } = await supabase.from('vendors').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function updateVendor(id: string, patch: VendorUpdate): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Batch read used by list views that render vendor names alongside
// FK-scoped rows (sales notes). Matches the listCustomersByIds pattern
// — only selects id + nombre so we don't pay for per-vendor detail we
// never show in the list.
export async function listVendorsByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id) => id.length > 0)))
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase.from('vendors').select('id, nombre').in('id', unique)
  if (error) throw error
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.id, row.nombre)
  }
  return map
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function useVendors(opts: ListVendorsOptions = {}) {
  return useQuery({
    queryKey: vendorKeys.list(opts),
    queryFn: () => listVendors(opts),
    staleTime: 60_000,
  })
}

export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: id ? vendorKeys.detail(id) : vendorKeys.all,
    queryFn: () => getVendor(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useVendorsByIds(ids: string[]) {
  const sorted = Array.from(new Set(ids)).sort()
  return useQuery({
    queryKey: [...vendorKeys.all, 'by-ids', sorted] as const,
    queryFn: () => listVendorsByIds(sorted),
    enabled: sorted.length > 0,
    staleTime: 60_000,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createVendor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() })
    },
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VendorUpdate }) => updateVendor(id, patch),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() })
      qc.invalidateQueries({ queryKey: vendorKeys.detail(vars.id) })
    },
  })
}
