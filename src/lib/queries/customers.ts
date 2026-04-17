import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

// Callers don't set actor/audit columns — the DB stamps them via trigger.
export type NewCustomer = Omit<
  Database['public']['Tables']['customers']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by'
>

export interface ListCustomersOptions {
  // Free-text match against nombre / rfc / telefono (ILIKE substring).
  search?: string
  // Include soft-deleted rows. Admin-only in practice — RLS filters
  // them out for non-admin callers regardless of this flag.
  includeDeleted?: boolean
}

export interface PagedCustomersOptions extends ListCustomersOptions {
  // Zero-indexed page. Defaults to 0.
  page?: number
  // Rows per page. Defaults to 25.
  pageSize?: number
}

export interface PagedCustomers {
  rows: Customer[]
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 25

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
  paged: (opts: PagedCustomersOptions = {}) =>
    [
      ...customerKeys.lists(),
      'paged',
      {
        search: opts.search?.trim() ?? '',
        includeDeleted: opts.includeDeleted ?? false,
        page: opts.page ?? 0,
        pageSize: opts.pageSize ?? DEFAULT_PAGE_SIZE,
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
  let query = supabase.from('customers').select('*').order('nombre', { ascending: true })

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

// Thrown when a create/update would violate a customers unique index.
// The form uses `field` to attach the error inline and fetch the
// conflicting row for the "Ver cliente existente" action.
export class DuplicateCustomerError extends Error {
  constructor(public field: 'telefono' | 'email') {
    super(`duplicate customer.${field}`)
    this.name = 'DuplicateCustomerError'
  }
}

// PostgREST surfaces Postgres 23505 (unique_violation) with the
// constraint name in the error message. Map it back to the field that
// triggered it so the form can render a per-field message.
function translateWriteError(err: { code?: string; message?: string } | null): Error | null {
  if (!err) return null
  if (err.code !== '23505') return err as Error
  const msg = err.message ?? ''
  if (msg.includes('customers_telefono_unique')) return new DuplicateCustomerError('telefono')
  if (msg.includes('customers_email_unique')) return new DuplicateCustomerError('email')
  return err as Error
}

export async function createCustomer(input: NewCustomer): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert(input).select('*').single()

  const translated = translateWriteError(error)
  if (translated) throw translated
  return data as Customer
}

export async function updateCustomer(id: string, patch: CustomerUpdate): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  const translated = translateWriteError(error)
  if (translated) throw translated
  return data as Customer
}

// Lookups used by the "Ver cliente existente" affordance: after a
// 23505 we fetch the colliding row so the form can link to it
// without making the user hunt it down manually.
export async function findCustomerByTelefono(telefono: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('telefono', telefono)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const normalized = email.trim().toLowerCase()
  if (normalized === '') return null
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('email', normalized)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

// Paginated variant for the /clientes list view. Exact count is
// requested so the UI can render "página X de Y". PostgREST's exact
// count is slower than estimated on very large tables, but customer
// volume here is small enough that the accuracy is worth the cost.
export async function listCustomersPaged(
  opts: PagedCustomersOptions = {}
): Promise<PagedCustomers> {
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE)
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(from, to)

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

  const { data, error, count } = await query
  if (error) throw error
  return { rows: data ?? [], totalCount: count ?? 0 }
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

export function useCustomersPaged(opts: PagedCustomersOptions = {}) {
  return useQuery({
    queryKey: customerKeys.paged(opts),
    queryFn: () => listCustomersPaged(opts),
    staleTime: 60_000,
    placeholderData: (prev) => prev, // keep current page visible while the next loads
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
