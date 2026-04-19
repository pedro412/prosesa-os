import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'
import { mxDayStartUtc, mxNextDayStartUtc } from '@/lib/mx-date'

import { supabase } from '../supabase'

import { type CardType, paymentKeys, type PaymentMethod } from './payments'

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
  // YYYY-MM-DD strings representing MX calendar days. Translated at
  // query time to a half-open UTC range on `created_at` so "today"
  // means the operator's wall-clock day, not UTC midnight.
  from?: string
  to?: string
  // Free-text match against folio or customer display. PostgREST OR
  // filter — wildcards in user input are left in, same as customers.
  search?: string
  // LIT-35: payment-method filter. Matches notes that have at least
  // one payment row of this method, via an inner join on `payments`.
  paymentMethod?: PaymentMethod
  // LIT-35: exact customer match. The history UI exposes this as a
  // Cliente combobox instead of cross-table text search.
  customerId?: string
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
        paymentMethod: opts.paymentMethod ?? null,
        customerId: opts.customerId ?? null,
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
        paymentMethod: opts.paymentMethod ?? null,
        customerId: opts.customerId ?? null,
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
  // Inner join on payments when a paymentMethod filter is active so
  // PostgREST returns only notes that have at least one matching
  // payment row. We branch rather than share a variable select
  // string because Supabase's generated types can't narrow a dynamic
  // `select()` argument — two concrete calls keep both paths
  // strongly typed.
  if (opts.paymentMethod) {
    let query = supabase
      .from('sales_notes')
      .select('*, payments!inner(method)')
      .eq('payments.method', opts.paymentMethod)
      .order('created_at', { ascending: false })
    if (opts.companyId) query = query.eq('company_id', opts.companyId)
    if (opts.status) query = query.eq('status', opts.status)
    if (opts.customerId) query = query.eq('customer_id', opts.customerId)
    if (opts.from) query = query.gte('created_at', mxDayStartUtc(opts.from))
    if (opts.to) query = query.lt('created_at', mxNextDayStartUtc(opts.to))
    if (opts.search) {
      const sanitized = sanitizeSearch(opts.search)
      if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
    }
    const { data, error } = await query
    if (error) throw error
    // Drop the embedded payments projection — consumers of this
    // function expect the header-only shape.
    return (data ?? []).map(({ payments: _payments, ...note }) => note)
  }

  let query = supabase.from('sales_notes').select('*').order('created_at', { ascending: false })
  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.customerId) query = query.eq('customer_id', opts.customerId)
  if (opts.from) query = query.gte('created_at', mxDayStartUtc(opts.from))
  if (opts.to) query = query.lt('created_at', mxNextDayStartUtc(opts.to))
  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
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

  // See listSalesNotes for the reason we branch the select. The
  // `count: 'exact'` modifier reports the filtered count either way
  // so pagination math stays correct.
  if (opts.paymentMethod) {
    let query = supabase
      .from('sales_notes')
      .select('*, payments!inner(method)', { count: 'exact' })
      .eq('payments.method', opts.paymentMethod)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (opts.companyId) query = query.eq('company_id', opts.companyId)
    if (opts.status) query = query.eq('status', opts.status)
    if (opts.customerId) query = query.eq('customer_id', opts.customerId)
    if (opts.from) query = query.gte('created_at', mxDayStartUtc(opts.from))
    if (opts.to) query = query.lt('created_at', mxNextDayStartUtc(opts.to))
    if (opts.search) {
      const sanitized = sanitizeSearch(opts.search)
      if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
    }
    const { data, error, count } = await query
    if (error) throw error
    return {
      rows: (data ?? []).map(({ payments: _payments, ...note }) => note),
      totalCount: count ?? 0,
    }
  }

  let query = supabase
    .from('sales_notes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.customerId) query = query.eq('customer_id', opts.customerId)
  if (opts.from) query = query.gte('created_at', mxDayStartUtc(opts.from))
  if (opts.to) query = query.lt('created_at', mxNextDayStartUtc(opts.to))
  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
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

// One payment row the POS captures inline with the note (LIT-33).
// Shape mirrors what the `create_sales_note` RPC validates before
// inserting into `public.payments`: card_type is required when
// method='tarjeta' and must be null otherwise.
export interface CreateSalesNotePaymentInput {
  method: PaymentMethod
  card_type: CardType | null
  amount: number
}

export interface CreateSalesNoteInput {
  company_id: string
  customer_id: string | null
  notes: string | null
  requires_invoice: boolean
  lines: CreateSalesNoteLineInput[]
  // Optional so the LIT-31 call sites that omit payments keep landing
  // the note in status='pendiente'. LIT-33 supplies a non-empty array
  // for counter-mode sales so the note lands 'pagada' atomically.
  payments?: CreateSalesNotePaymentInput[]
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
// without a manual refetch. Also busts any payment list caches so the
// detail view (LIT-35) sees the inline payments from the dialog.
export function useCreateSalesNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSalesNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.lists() })
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}

// ============================================================================
// Write: addPaymentsToNote (LIT-35 "Registrar pago")
// ============================================================================

// Batch-inserts payment rows against an existing note. The payments
// AFTER trigger from M3-3 recomputes sales_notes.status (pendiente /
// abonada / pagada) based on the running sum, so the client never
// writes status itself. Inline `created_by` is omitted — the
// stamp-actor trigger on payments fills it from auth.uid().
export async function addPaymentsToNote(
  salesNoteId: string,
  payments: CreateSalesNotePaymentInput[]
): Promise<void> {
  if (payments.length === 0) return
  const rows = payments.map((payment) => ({
    sales_note_id: salesNoteId,
    method: payment.method,
    card_type: payment.card_type,
    amount: payment.amount,
  }))
  const { error } = await supabase.from('payments').insert(rows)
  if (error) throw error
}

export function useAddPaymentsToNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      salesNoteId,
      payments,
    }: {
      salesNoteId: string
      payments: CreateSalesNotePaymentInput[]
    }) => addPaymentsToNote(salesNoteId, payments),
    onSuccess: (_, { salesNoteId }) => {
      // Detail view pulls the fresh payments + recomputed status; list
      // views show the updated status badge.
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.detail(salesNoteId) })
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.lists() })
      queryClient.invalidateQueries({ queryKey: paymentKeys.byNote(salesNoteId) })
    },
  })
}

// ============================================================================
// Write: cancelSalesNote (LIT-35 "Cancelar nota", admin-only)
// ============================================================================

// Sets status='cancelada' + cancelled_at/by/reason in one UPDATE.
// RLS on sales_notes only grants UPDATE to admins, so a non-admin
// caller sees the operation fail with a PostgREST 403/42501. The UI
// also hides the button for non-admins to avoid round-tripping.
//
// Folio is NOT freed — no DELETE policy exists, and the per-company
// folio sequence keeps climbing. A cancelled note's folio stays
// bound to the note so prior prints remain accountable.
export async function cancelSalesNote(id: string, reason: string): Promise<SalesNote> {
  const trimmed = reason.trim()
  if (trimmed.length === 0) {
    // Defensive — the UI zod schema already blocks this path, but we
    // don't want to write a row that says "cancelled for: ''".
    throw new Error('cancelSalesNote: reason is required')
  }
  const { data, error } = await supabase
    .from('sales_notes')
    .update({
      status: 'cancelada',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: trimmed,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export function useCancelSalesNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelSalesNote(id, reason),
    onSuccess: (note) => {
      queryClient.setQueryData(
        salesNoteKeys.detail(note.id),
        (prev: SalesNoteWithDetails | null) => (prev ? { ...prev, ...note } : prev)
      )
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.lists() })
      queryClient.invalidateQueries({ queryKey: salesNoteKeys.detail(note.id) })
    },
  })
}
