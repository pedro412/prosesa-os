import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

// ============================================================================
// Types
// ============================================================================

export type SalesNote = Database['public']['Tables']['sales_notes']['Row']
export type SalesNoteInsert = Database['public']['Tables']['sales_notes']['Insert']
export type SalesNoteUpdate = Database['public']['Tables']['sales_notes']['Update']

export type SalesNoteLine = Database['public']['Tables']['sales_note_lines']['Row']
export type SalesNoteLineInsert = Database['public']['Tables']['sales_note_lines']['Insert']

// Kept in sync with the CHECK constraint on sales_notes.status. Narrowed
// to a literal union so form code and status badges can switch
// exhaustively without casting.
export type SalesNoteStatus = 'pagada' | 'pendiente' | 'abonada' | 'cancelada'

// Same shape for line discount mode (CHECK on sales_note_lines.discount_type).
export type LineDiscountType = 'none' | 'percent' | 'fixed'

// Full note + joined lines + joined payments, shaped the way the detail
// view and thermal-ticket renderer consume them. Payments are imported
// by name from the payments module so the two files share one source of
// truth for the row type.
export interface SalesNoteWithDetails extends SalesNote {
  lines: SalesNoteLine[]
  payments: Database['public']['Tables']['payments']['Row'][]
}

// ============================================================================
// Query options + keys
// ============================================================================

export interface ListSalesNotesOptions {
  companyId?: string
  status?: SalesNoteStatus
  // ISO date strings (YYYY-MM-DD). Inclusive on both ends in the UI,
  // translated to a half-open created_at range at query time.
  from?: string
  to?: string
  // Free-text match against folio or customer display. PostgREST OR
  // filter — wildcards in user input are left in, same as customers.
  search?: string
}

export interface PagedSalesNotesOptions extends ListSalesNotesOptions {
  page?: number
  pageSize?: number
}

export interface PagedSalesNotes {
  rows: SalesNote[]
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 25

export const salesNoteKeys = {
  all: ['sales-notes'] as const,
  lists: () => [...salesNoteKeys.all, 'list'] as const,
  list: (opts: ListSalesNotesOptions = {}) =>
    [
      ...salesNoteKeys.lists(),
      {
        companyId: opts.companyId ?? null,
        status: opts.status ?? null,
        from: opts.from ?? null,
        to: opts.to ?? null,
        search: opts.search?.trim() ?? '',
      },
    ] as const,
  paged: (opts: PagedSalesNotesOptions = {}) =>
    [
      ...salesNoteKeys.lists(),
      'paged',
      {
        companyId: opts.companyId ?? null,
        status: opts.status ?? null,
        from: opts.from ?? null,
        to: opts.to ?? null,
        search: opts.search?.trim() ?? '',
        page: opts.page ?? 0,
        pageSize: opts.pageSize ?? DEFAULT_PAGE_SIZE,
      },
    ] as const,
  detail: (id: string) => [...salesNoteKeys.all, 'detail', id] as const,
}

// ============================================================================
// Readers
// ============================================================================

function sanitizeSearch(raw: string): string {
  // PostgREST's .or() uses commas and parentheses as delimiters; strip
  // them from user input so a customer name with a comma can't break
  // the query. Matches the convention in customers.ts.
  return raw.replace(/[(),]/g, ' ').trim()
}

export async function listSalesNotes(opts: ListSalesNotesOptions = {}): Promise<SalesNote[]> {
  let query = supabase.from('sales_notes').select('*').order('created_at', { ascending: false })

  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.from) query = query.gte('created_at', opts.from)
  if (opts.to) query = query.lte('created_at', opts.to)

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      const pattern = `%${sanitized}%`
      query = query.ilike('folio', pattern)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listSalesNotesPaged(
  opts: PagedSalesNotesOptions = {}
): Promise<PagedSalesNotes> {
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE)
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('sales_notes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.from) query = query.gte('created_at', opts.from)
  if (opts.to) query = query.lte('created_at', opts.to)

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) {
      query = query.ilike('folio', `%${sanitized}%`)
    }
  }

  const { data, error, count } = await query
  if (error) throw error
  return { rows: data ?? [], totalCount: count ?? 0 }
}

export async function getSalesNote(id: string): Promise<SalesNoteWithDetails | null> {
  const { data, error } = await supabase
    .from('sales_notes')
    .select('*, lines:sales_note_lines(*), payments(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  // PostgREST returns the embedded resources on the alias we asked for.
  // Sort lines client-side so callers get a stable display order
  // regardless of PostgREST's implicit ordering.
  const lines = [...data.lines].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  )
  return { ...data, lines }
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function useSalesNotes(opts: ListSalesNotesOptions = {}) {
  return useQuery({
    queryKey: salesNoteKeys.list(opts),
    queryFn: () => listSalesNotes(opts),
    staleTime: 60_000,
  })
}

export function useSalesNotesPaged(opts: PagedSalesNotesOptions = {}) {
  return useQuery({
    queryKey: salesNoteKeys.paged(opts),
    queryFn: () => listSalesNotesPaged(opts),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useSalesNote(id: string | undefined) {
  return useQuery({
    queryKey: id ? salesNoteKeys.detail(id) : salesNoteKeys.all,
    queryFn: () => getSalesNote(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ============================================================================
// Write: createSalesNote (atomic via RPC — LIT-31)
// ============================================================================

// Payload shape for the `public.create_sales_note(payload jsonb)` RPC.
// Mirrors what the server-side PL/pgSQL expects (see migration
// 20260418130000_create_sales_note_rpc.sql). Using a hand-written shape
// instead of the generated jsonb type gives us sharp compile-time
// feedback at every call site.
export interface CreateSalesNoteLineInput {
  catalog_item_id: string | null
  concept: string
  dimensions: string | null
  material: string | null
  unit: string
  quantity: number
  unit_price: number
  discount_type: LineDiscountType
  discount_value: number
}

export interface CreateSalesNoteInput {
  company_id: string
  customer_id: string | null
  notes: string | null
  requires_invoice: boolean
  lines: CreateSalesNoteLineInput[]
}

export interface CreateSalesNoteResult {
  id: string
  folio: string
}

// Wraps the SECURITY DEFINER `create_sales_note` RPC. Inserts the
// header + lines in a single transaction on the server; returns the
// created note's (id, folio) so the UI can toast the new folio or
// navigate to the detail view.
//
// Why an RPC over two PostgREST calls: one network round-trip, DB
// transaction atomicity (no orphaned header if the lines insert
// fails), and a typed return shape without the `folio: string` Insert
// quirk that the BEFORE trigger resolves at write time.
export async function createSalesNote(input: CreateSalesNoteInput): Promise<CreateSalesNoteResult> {
  // RPC args cast: Supabase's generated type for a function with a
  // `jsonb` parameter is `Json`, but our payload is a concrete shape
  // that always round-trips through JSON.stringify cleanly.
  const { data, error } = await supabase.rpc('create_sales_note', {
    payload:
      input as unknown as Database['public']['Functions']['create_sales_note']['Args']['payload'],
  })

  if (error) throw error
  // The PL/pgSQL `returns table(id uuid, folio text)` surfaces to the
  // client as an array with one row.
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object' || !('id' in row) || !('folio' in row)) {
    throw new Error('create_sales_note: unexpected empty response')
  }
  return { id: String(row.id), folio: String(row.folio) }
}

// TanStack Query mutation: invalidates the sales-notes lists on success
// so the history view (once it ships in LIT-35) picks up the new row
// without a manual refetch.
export function useCreateSalesNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSalesNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.lists() })
    },
  })
}
