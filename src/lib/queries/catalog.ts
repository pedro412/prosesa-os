import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

// ============================================================================
// Categories
// ============================================================================

export type CatalogCategory = Database['public']['Tables']['catalog_categories']['Row']
export type CatalogCategoryUpdate = Database['public']['Tables']['catalog_categories']['Update']

export type NewCatalogCategory = Omit<
  Database['public']['Tables']['catalog_categories']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by'
>

export interface ListCategoriesOptions {
  includeInactive?: boolean
  includeDeleted?: boolean
}

export const categoryKeys = {
  all: ['catalog-categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (opts: ListCategoriesOptions = {}) =>
    [
      ...categoryKeys.lists(),
      {
        includeInactive: opts.includeInactive ?? false,
        includeDeleted: opts.includeDeleted ?? false,
      },
    ] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
}

export async function listCategories(opts: ListCategoriesOptions = {}): Promise<CatalogCategory[]> {
  let query = supabase.from('catalog_categories').select('*').order('name', { ascending: true })

  if (!opts.includeDeleted) {
    query = query.is('deleted_at', null)
  }
  if (!opts.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCategory(id: string): Promise<CatalogCategory | null> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createCategory(input: NewCatalogCategory): Promise<CatalogCategory> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .insert(input)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateCategory(
  id: string,
  patch: CatalogCategoryUpdate
): Promise<CatalogCategory> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

// Soft-delete only. RLS requires admin.
export async function softDeleteCategory(id: string): Promise<CatalogCategory> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

// ============================================================================
// Items
// ============================================================================

export type CatalogItem = Database['public']['Tables']['catalog_items']['Row']
export type CatalogItemUpdate = Database['public']['Tables']['catalog_items']['Update']

export type NewCatalogItem = Omit<
  Database['public']['Tables']['catalog_items']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by'
>

export type CatalogUnit = 'pieza' | 'm2' | 'm' | 'litro' | 'rollo' | 'hora'
export type CatalogPricingMode = 'fixed' | 'variable'

export const CATALOG_UNITS: readonly CatalogUnit[] = [
  'pieza',
  'm2',
  'm',
  'litro',
  'rollo',
  'hora',
] as const

export const CATALOG_PRICING_MODES: readonly CatalogPricingMode[] = ['fixed', 'variable'] as const

export interface ListItemsOptions {
  // Free-text match against name + description (ILIKE substring,
  // backed by the pg_trgm GIN index).
  search?: string
  categoryId?: string
  pricingMode?: CatalogPricingMode
  includeInactive?: boolean
  includeDeleted?: boolean
}

export interface PagedItemsOptions extends ListItemsOptions {
  page?: number
  pageSize?: number
}

export interface PagedItems {
  rows: CatalogItem[]
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 25

export const itemKeys = {
  all: ['catalog-items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (opts: ListItemsOptions = {}) =>
    [
      ...itemKeys.lists(),
      {
        search: opts.search?.trim() ?? '',
        categoryId: opts.categoryId ?? null,
        pricingMode: opts.pricingMode ?? null,
        includeInactive: opts.includeInactive ?? false,
        includeDeleted: opts.includeDeleted ?? false,
      },
    ] as const,
  paged: (opts: PagedItemsOptions = {}) =>
    [
      ...itemKeys.lists(),
      'paged',
      {
        search: opts.search?.trim() ?? '',
        categoryId: opts.categoryId ?? null,
        pricingMode: opts.pricingMode ?? null,
        includeInactive: opts.includeInactive ?? false,
        includeDeleted: opts.includeDeleted ?? false,
        page: opts.page ?? 0,
        pageSize: opts.pageSize ?? DEFAULT_PAGE_SIZE,
      },
    ] as const,
  detail: (id: string) => [...itemKeys.all, 'detail', id] as const,
}

// PostgREST .or() uses comma + parentheses as delimiters. Strip them
// from user input so an item name with a comma can't break the query.
// Wildcards % and _ stay — power users can opt in.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[(),]/g, ' ').trim()
}

export async function listItems(opts: ListItemsOptions = {}): Promise<CatalogItem[]> {
  let query = supabase.from('catalog_items').select('*').order('name', { ascending: true })

  if (!opts.includeDeleted) query = query.is('deleted_at', null)
  if (!opts.includeInactive) query = query.eq('is_active', true)
  if (opts.categoryId) query = query.eq('category_id', opts.categoryId)
  if (opts.pricingMode) query = query.eq('pricing_mode', opts.pricingMode)

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      const pattern = `%${sanitized}%`
      query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listItemsPaged(opts: PagedItemsOptions = {}): Promise<PagedItems> {
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE)
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('catalog_items')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  if (!opts.includeDeleted) query = query.is('deleted_at', null)
  if (!opts.includeInactive) query = query.eq('is_active', true)
  if (opts.categoryId) query = query.eq('category_id', opts.categoryId)
  if (opts.pricingMode) query = query.eq('pricing_mode', opts.pricingMode)

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      const pattern = `%${sanitized}%`
      query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`)
    }
  }

  const { data, error, count } = await query
  if (error) throw error
  return { rows: data ?? [], totalCount: count ?? 0 }
}

export async function getItem(id: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createItem(input: NewCatalogItem): Promise<CatalogItem> {
  const { data, error } = await supabase.from('catalog_items').insert(input).select('*').single()

  if (error) throw error
  return data
}

export async function updateItem(id: string, patch: CatalogItemUpdate): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function softDeleteItem(id: string): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
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

export function useCategories(opts: ListCategoriesOptions = {}) {
  return useQuery({
    queryKey: categoryKeys.list(opts),
    queryFn: () => listCategories(opts),
    staleTime: 60_000,
  })
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: id ? categoryKeys.detail(id) : categoryKeys.all,
    queryFn: () => getCategory(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: (category) => {
      queryClient.setQueryData(categoryKeys.detail(category.id), category)
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CatalogCategoryUpdate }) =>
      updateCategory(id, patch),
    onSuccess: (category) => {
      queryClient.setQueryData(categoryKeys.detail(category.id), category)
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
    },
  })
}

export function useSoftDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: softDeleteCategory,
    onSuccess: (category) => {
      queryClient.setQueryData(categoryKeys.detail(category.id), category)
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
      // Items reference categories — invalidate item lists too so any
      // category-name join in the UI picks up the change.
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() })
    },
  })
}

export function useItems(opts: ListItemsOptions = {}) {
  return useQuery({
    queryKey: itemKeys.list(opts),
    queryFn: () => listItems(opts),
    staleTime: 60_000,
  })
}

export function useItemsPaged(opts: PagedItemsOptions = {}) {
  return useQuery({
    queryKey: itemKeys.paged(opts),
    queryFn: () => listItemsPaged(opts),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: id ? itemKeys.detail(id) : itemKeys.all,
    queryFn: () => getItem(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createItem,
    onSuccess: (item) => {
      queryClient.setQueryData(itemKeys.detail(item.id), item)
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CatalogItemUpdate }) => updateItem(id, patch),
    onSuccess: (item) => {
      queryClient.setQueryData(itemKeys.detail(item.id), item)
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() })
    },
  })
}

export function useSoftDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: softDeleteItem,
    onSuccess: (item) => {
      queryClient.setQueryData(itemKeys.detail(item.id), item)
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() })
    },
  })
}
