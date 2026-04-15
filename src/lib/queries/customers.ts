import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

// Callers don't set actor/audit columns or the sentinel flag — the DB
// stamps the first via trigger and guards the second via unique index.
export type NewCustomer = Omit<
  Database['public']['Tables']['customers']['Insert'],
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'is_publico_general'
>

export interface ListCustomersOptions {
  // Free-text match against nombre / rfc / telefono (ILIKE substring).
  search?: string
  // Include soft-deleted rows. Admin-only in practice — RLS filters
  // them out for non-admin callers regardless of this flag.
  includeDeleted?: boolean
}

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (opts: ListCustomersOptions = {}) =>
    [
      ...customerKeys.lists(),
      {
        search: opts.search?.trim() ?? '',
        includeDeleted: opts.includeDeleted ?? false,
      },
    ] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
}

// PostgREST's .or() uses commas and parentheses as delimiters; strip
// them from user input so a customer name with a comma can't break
// the query. Wildcards % and _ are left in — power users can opt in.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[(),]/g, ' ').trim()
}

export async function listCustomers(opts: ListCustomersOptions = {}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('is_publico_general', { ascending: false }) // sentinel always first
    .order('nombre', { ascending: true })

  if (!opts.includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      const pattern = `%${sanitized}%`
      query = query.or(`nombre.ilike.${pattern},rfc.ilike.${pattern},telefono.ilike.${pattern}`)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()

  if (error) throw error
  return data
}

export async function createCustomer(input: NewCustomer): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert(input).select('*').single()

  if (error) throw error
  return data
}

export async function updateCustomer(id: string, patch: CustomerUpdate): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

// Soft-delete only. RLS requires admin to set deleted_at.
export async function softDeleteCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function useCustomers(opts: ListCustomersOptions = {}) {
  return useQuery({
    queryKey: customerKeys.list(opts),
    queryFn: () => listCustomers(opts),
    staleTime: 60_000,
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: id ? customerKeys.detail(id) : customerKeys.all,
    queryFn: () => getCustomer(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer)
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) => updateCustomer(id, patch),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer)
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useSoftDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: softDeleteCustomer,
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer)
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}
