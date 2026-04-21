import { useQuery } from '@tanstack/react-query'

import type { Database } from '@/types/database'
import { mxDayStartUtc, mxNextDayStartUtc } from '@/lib/mx-date'

import { supabase } from '../supabase'

// ============================================================================
// Types
// ============================================================================

export type WorkOrder = Database['public']['Tables']['work_orders']['Row']

// Kept in sync with work_orders.status CHECK constraint (migration
// 20260420120100_work_orders.sql). Literal union so badge + label maps
// can switch exhaustively.
export type WorkOrderStatus =
  | 'cotizado'
  | 'anticipo_recibido'
  | 'en_diseno'
  | 'en_produccion'
  | 'en_instalacion'
  | 'terminado'
  | 'entregado'

export type WorkOrderPriority = 'normal' | 'urgente'

// The shape the list view consumes: base row + joined customer + the
// parent nota's money aggregates. Customer is always non-null on
// work_orders (LIT-37 follow-up), but the FK shape lets PostgREST
// return null if the join misbehaves — we treat it defensively.
export interface WorkOrderListRow extends WorkOrder {
  customer: { id: string; nombre: string } | null
  sales_note: {
    id: string
    folio: string
    total: number
    paid_sum: number
    saldo_pendiente: number | null
    status: string
  } | null
}

// ============================================================================
// Query options + keys
// ============================================================================

// Which date column to filter on when a range is provided. Kept out of
// the URL as a discrete discriminant so the filter UI can swap between
// "created" and "promised" without losing the range values.
export type WorkOrderDateField = 'created' | 'promised'

export interface ListWorkOrdersOptions {
  companyId?: string
  // Multiselect: when empty/undefined, no status filter. Status chips
  // in the UI map directly onto this array.
  statuses?: WorkOrderStatus[]
  priority?: WorkOrderPriority
  customerId?: string
  // YYYY-MM-DD strings representing MX calendar days, translated at
  // query time to a half-open UTC range on the chosen date field.
  dateField?: WorkOrderDateField
  from?: string
  to?: string
  // `promised_at < now()` and status not in (entregado) and not cancelled.
  overdueOnly?: boolean
  // Free-text match on folio. Other text columns aren't worth searching
  // here — customer search lives in the dedicated combobox.
  search?: string
}

export interface PagedWorkOrdersOptions extends ListWorkOrdersOptions {
  page?: number
  pageSize?: number
}

export interface PagedWorkOrders {
  rows: WorkOrderListRow[]
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 25

// The PostgREST select expression used by both list readers. Kept as
// a constant so the two shapes can never drift.
const LIST_SELECT = `
  *,
  customer:customers(id, nombre),
  sales_note:sales_notes(id, folio, total, paid_sum, saldo_pendiente, status)
`

function sanitizeSearch(raw: string): string {
  // Same rule as customers / sales-notes: PostgREST uses commas and
  // parens as delimiters; strip to keep .ilike() safe.
  return raw.replace(/[(),]/g, ' ').trim()
}

// Stable key factory — same convention as salesNoteKeys. The list key
// flattens all filter knobs so TanStack caches per-filter rather than
// collapsing into one bucket.
export const workOrderKeys = {
  all: ['work-orders'] as const,
  lists: () => [...workOrderKeys.all, 'list'] as const,
  list: (opts: ListWorkOrdersOptions = {}) =>
    [
      ...workOrderKeys.lists(),
      {
        companyId: opts.companyId ?? null,
        statuses: opts.statuses?.slice().sort() ?? null,
        priority: opts.priority ?? null,
        customerId: opts.customerId ?? null,
        dateField: opts.dateField ?? null,
        from: opts.from ?? null,
        to: opts.to ?? null,
        overdueOnly: !!opts.overdueOnly,
        search: opts.search?.trim() ?? '',
      },
    ] as const,
  paged: (opts: PagedWorkOrdersOptions = {}) =>
    [
      ...workOrderKeys.lists(),
      'paged',
      {
        companyId: opts.companyId ?? null,
        statuses: opts.statuses?.slice().sort() ?? null,
        priority: opts.priority ?? null,
        customerId: opts.customerId ?? null,
        dateField: opts.dateField ?? null,
        from: opts.from ?? null,
        to: opts.to ?? null,
        overdueOnly: !!opts.overdueOnly,
        search: opts.search?.trim() ?? '',
        page: opts.page ?? 0,
        pageSize: opts.pageSize ?? DEFAULT_PAGE_SIZE,
      },
    ] as const,
  detail: (id: string) => [...workOrderKeys.all, 'detail', id] as const,
}

// ============================================================================
// Readers
// ============================================================================

export async function listWorkOrders(
  opts: ListWorkOrdersOptions = {}
): Promise<WorkOrderListRow[]> {
  let query = supabase
    .from('work_orders')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })

  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.statuses && opts.statuses.length > 0) query = query.in('status', opts.statuses)
  if (opts.priority) query = query.eq('priority', opts.priority)
  if (opts.customerId) query = query.eq('customer_id', opts.customerId)

  const dateColumn = opts.dateField === 'promised' ? 'promised_at' : 'created_at'
  if (opts.from) query = query.gte(dateColumn, mxDayStartUtc(opts.from))
  if (opts.to) query = query.lt(dateColumn, mxNextDayStartUtc(opts.to))

  if (opts.overdueOnly) {
    query = query
      .lt('promised_at', new Date().toISOString())
      .neq('status', 'entregado')
      .is('cancelled_at', null)
  }

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as WorkOrderListRow[]
}

export async function listWorkOrdersPaged(
  opts: PagedWorkOrdersOptions = {}
): Promise<PagedWorkOrders> {
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE)
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('work_orders')
    .select(LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts.companyId) query = query.eq('company_id', opts.companyId)
  if (opts.statuses && opts.statuses.length > 0) query = query.in('status', opts.statuses)
  if (opts.priority) query = query.eq('priority', opts.priority)
  if (opts.customerId) query = query.eq('customer_id', opts.customerId)

  const dateColumn = opts.dateField === 'promised' ? 'promised_at' : 'created_at'
  if (opts.from) query = query.gte(dateColumn, mxDayStartUtc(opts.from))
  if (opts.to) query = query.lt(dateColumn, mxNextDayStartUtc(opts.to))

  if (opts.overdueOnly) {
    query = query
      .lt('promised_at', new Date().toISOString())
      .neq('status', 'entregado')
      .is('cancelled_at', null)
  }

  if (opts.search) {
    const sanitized = sanitizeSearch(opts.search)
    if (sanitized.length > 0) query = query.ilike('folio', `%${sanitized}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return {
    rows: (data ?? []) as unknown as WorkOrderListRow[],
    totalCount: count ?? 0,
  }
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function useWorkOrders(opts: ListWorkOrdersOptions = {}) {
  return useQuery({
    queryKey: workOrderKeys.list(opts),
    queryFn: () => listWorkOrders(opts),
    staleTime: 60_000,
  })
}

export function useWorkOrdersPaged(opts: PagedWorkOrdersOptions = {}) {
  return useQuery({
    queryKey: workOrderKeys.paged(opts),
    queryFn: () => listWorkOrdersPaged(opts),
    staleTime: 60_000,
    // Keeps the previous page visible while fetching the next one —
    // same pattern as useSalesNotesPaged.
    placeholderData: (prev) => prev,
  })
}
