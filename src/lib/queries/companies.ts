import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']

export const companyKeys = {
  all: ['companies'] as const,
  lists: () => [...companyKeys.all, 'list'] as const,
  detail: (id: string) => [...companyKeys.all, 'detail', id] as const,
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('nombre_comercial', { ascending: true })

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

export function useCompanies() {
  return useQuery({
    queryKey: companyKeys.lists(),
    queryFn: listCompanies,
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
