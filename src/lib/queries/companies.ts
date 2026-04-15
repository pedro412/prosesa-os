import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']

export interface ListCompaniesOptions {
  // Defaults to false — the selector at sale/quotation time only wants
  // live, active rows. The admin settings page flips this on so it can
  // surface (and reactivate) companies that were turned off.
  includeInactive?: boolean
}

export const companyKeys = {
  all: ['companies'] as const,
  lists: () => [...companyKeys.all, 'list'] as const,
  list: (opts: ListCompaniesOptions = {}) =>
    [...companyKeys.lists(), { includeInactive: opts.includeInactive ?? false }] as const,
  detail: (id: string) => [...companyKeys.all, 'detail', id] as const,
}

export async function listCompanies(opts: ListCompaniesOptions = {}): Promise<Company[]> {
  let query = supabase
    .from('companies')
    .select('*')
    .is('deleted_at', null)
    .order('nombre_comercial', { ascending: true })

  if (!opts.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data
}

// Partial patch; the caller picks which fields to update. Returns the
// updated row so consumers can refresh cache without a second round trip.
export async function updateCompany(id: string, patch: CompanyUpdate): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export function useCompanies(opts: ListCompaniesOptions = {}) {
  return useQuery({
    queryKey: companyKeys.list(opts),
    queryFn: () => listCompanies(opts),
    staleTime: 5 * 60_000,
  })
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: id ? companyKeys.detail(id) : companyKeys.all,
    queryFn: () => getCompany(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CompanyUpdate }) => updateCompany(id, patch),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(company.id), company)
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() })
    },
  })
}
