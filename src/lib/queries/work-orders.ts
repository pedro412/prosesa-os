import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/types/database'
import { mxDayStartUtc, mxNextDayStartUtc } from '@/lib/mx-date'

import { supabase } from '../supabase'
import { paymentKeys } from './payments'
import { salesNoteKeys } from './sales-notes'

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
  lines: (id: string) => [...workOrderKeys.all, 'detail', id, 'lines'] as const,
  log: (id: string) => [...workOrderKeys.all, 'detail', id, 'log'] as const,
}

// ============================================================================
// Detail shapes
// ============================================================================

export type SalesNoteLine = Database['public']['Tables']['sales_note_lines']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type WorkOrderStatusLog = Database['public']['Tables']['work_order_status_log']['Row']

// Detail-page embed: base row + customer + parent nota + nota's payments.
// Lines are fetched separately because PostgREST can't filter embedded
// children by a column on the same table — we need
// `sales_note_lines.work_order_id = :id`, which is a where-clause, not
// an embed-side hint.
export interface WorkOrderDetail extends WorkOrder {
  customer: { id: string; nombre: string; telefono: string | null } | null
  sales_note: (Database['public']['Tables']['sales_notes']['Row'] & { payments: Payment[] }) | null
}

const DETAIL_SELECT = `
  *,
  customer:customers(id, nombre, telefono),
  sales_note:sales_notes(
    *,
    payments(*)
  )
`

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

// ============================================================================
// Detail readers
// ============================================================================

export async function getWorkOrder(id: string): Promise<WorkOrderDetail | null> {
  const { data, error } = await supabase
    .from('work_orders')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  // Sort payments by paid_at desc client-side — PostgREST doesn't
  // accept an order clause on an embedded resource in this select
  // without restructuring the call.
  const detail = data as unknown as WorkOrderDetail
  if (detail.sales_note?.payments) {
    detail.sales_note.payments = [...detail.sales_note.payments].sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    )
  }
  return detail
}

export async function getWorkOrderLines(workOrderId: string): Promise<SalesNoteLine[]> {
  const { data, error } = await supabase
    .from('sales_note_lines')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getWorkOrderStatusLog(workOrderId: string): Promise<WorkOrderStatusLog[]> {
  const { data, error } = await supabase
    .from('work_order_status_log')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: id ? workOrderKeys.detail(id) : workOrderKeys.all,
    queryFn: () => getWorkOrder(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useWorkOrderLines(id: string | undefined) {
  return useQuery({
    queryKey: id ? workOrderKeys.lines(id) : workOrderKeys.all,
    queryFn: () => getWorkOrderLines(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useWorkOrderStatusLog(id: string | undefined) {
  return useQuery({
    queryKey: id ? workOrderKeys.log(id) : workOrderKeys.all,
    queryFn: () => getWorkOrderStatusLog(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ============================================================================
// Mutations
// ============================================================================

export interface UpdateWorkOrderStatusInput {
  workOrderId: string
  newStatus: WorkOrderStatus
  note: string | null
}

// Wraps the LIT-39 RPC `update_work_order_status(p_wo_id, p_new_status,
// p_note)`. The RPC returns the updated row; we surface it so the
// mutation can optimistically patch the detail cache.
export async function updateWorkOrderStatus(input: UpdateWorkOrderStatusInput): Promise<WorkOrder> {
  const { data, error } = await supabase.rpc('update_work_order_status', {
    p_wo_id: input.workOrderId,
    p_new_status: input.newStatus,
    // Supabase codegen types `p_note` as `string | undefined` (default-
    // valued arg). Translate null → undefined so an omitted note
    // doesn't serialize as a literal 'null' string at the wire level.
    p_note: input.note ?? undefined,
  })
  if (error) throw error
  // `returns public.work_orders` comes back as a single row for Supabase
  // — the client already normalizes; just narrow the type.
  if (!data) throw new Error('update_work_order_status: empty response')
  return data as unknown as WorkOrder
}

export function useUpdateWorkOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateWorkOrderStatus,
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(vars.workOrderId) })
      qc.invalidateQueries({ queryKey: workOrderKeys.log(vars.workOrderId) })
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() })
    },
  })
}

// Inline edit of the freeform description on the detail page. Narrow
// exception to CLAUDE.md §8 structural freeze (matches the LIT-99
// requires_invoice carve-out rationale — operator guidance, not
// monetary / folio / line structure).
export async function updateWorkOrderDescription(
  workOrderId: string,
  description: string | null
): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ description })
    .eq('id', workOrderId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export function useUpdateWorkOrderDescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      workOrderId,
      description,
    }: {
      workOrderId: string
      description: string | null
    }) => updateWorkOrderDescription(workOrderId, description),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(vars.workOrderId) })
    },
  })
}

// Admin-only soft-cancel. RLS UPDATE lets ventas through for status
// advances; the LIT-38 `work_orders_enforce_admin_cancel` trigger
// blocks non-admins from touching cancellation columns. The cancel
// button is also hidden from non-admins in the UI — this is belt +
// suspenders.
export interface CancelWorkOrderInput {
  workOrderId: string
  reason: string
}

export async function cancelWorkOrder(input: CancelWorkOrderInput): Promise<WorkOrder> {
  const trimmed = input.reason.trim()
  if (trimmed.length < 5) {
    throw new Error('cancelWorkOrder: reason must be at least 5 characters')
  }
  const { data: authData } = await supabase.auth.getUser()
  const uid = authData.user?.id ?? null
  const { data, error } = await supabase
    .from('work_orders')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: uid,
      cancellation_reason: trimmed,
    })
    .eq('id', input.workOrderId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export function useCancelWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelWorkOrder,
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(vars.workOrderId) })
      qc.invalidateQueries({ queryKey: workOrderKeys.log(vars.workOrderId) })
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() })
      // A work order's parent nota might flip to 'cancelada' when all
      // its orders are cancelled (CLAUDE.md §8). Invalidate nota caches
      // defensively — cheap and keeps the cross-link UI honest.
      qc.invalidateQueries({ queryKey: salesNoteKeys.all })
      qc.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}
