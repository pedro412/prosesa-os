// POS form state + reducer for LIT-31 (M3-4).
//
// Pure functions so the whole lifecycle of a counter sale — company
// picked, lines added / edited / removed, submitted — is unit-testable
// without mounting React. The UI (PosPage.tsx) wraps this with
// `useReducer` and composes the visible components around it.
//
// The reducer intentionally stores UI-level values (all strings for
// editable numeric fields until commit, wider shapes than the DB
// payload needs). A pure `toCreateSalesNotePayload(state)` selector
// projects it down to what the RPC expects at submit time — keeps
// intermediate "typing 1.2" states legal without losing server-side
// validation once the user presses Cobrar.

import type { CatalogItem, CatalogUnit } from '@/lib/queries/catalog'
import type { WorkOrderPriority } from '@/lib/queries/sales-notes'
import type { LineDiscountType } from '@/lib/tax'

// Client-only id for stable React keys on dynamically added lines.
// Not persisted — the DB assigns its own uuid on insert.
function randomId(): string {
  // `crypto.randomUUID` is standard in every browser we target (and in
  // Node for the test runner), so we don't need a nanoid dep.
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

export interface PosLine {
  id: string
  catalogItemId: string | null
  concept: string
  dimensions: string
  material: string
  unit: string
  quantity: number
  // Empty string = operator hasn't typed a price yet (variable-price
  // catalog items). Numeric 0 is a real zero. We store as number and
  // treat NaN / negative as invalid at submit time.
  unitPrice: number
  discountType: LineDiscountType
  discountValue: number
  // LIT-37: null → counter line, non-null → attached to the order with
  // this client id. Labels ("Orden 1", "Orden 2") are derived from the
  // `orders` array position at render time.
  orderClientId: string | null
}

// LIT-37: a work order declared in the draft. The server mints the real
// UUID + derived folio on commit; here we only track enough metadata to
// render it and wire lines to it.
export interface PosOrder {
  clientId: string
  description: string
  priority: WorkOrderPriority
  // ISO string (UTC) when the operator sets a promised delivery, null
  // otherwise. Stored as string so persisted JSON round-trips cleanly.
  promisedAt: string | null
}

export interface PosFormState {
  companyId: string | null
  customerId: string | null
  // LIT-107: vendedor de campo attributed to this sale. Null when
  // Gustavo closed the walk-in himself or simply didn't attribute —
  // display as "Sin vendedor" either way.
  vendorId: string | null
  notes: string
  requiresInvoice: boolean
  lines: PosLine[]
  orders: PosOrder[]
}

export function initialPosFormState(): PosFormState {
  return {
    companyId: null,
    customerId: null,
    vendorId: null,
    notes: '',
    requiresInvoice: false,
    lines: [],
    orders: [],
  }
}

function newOrder(): PosOrder {
  return {
    clientId: `order-${randomId()}`,
    description: '',
    priority: 'normal',
    promisedAt: null,
  }
}

// Exposed so PosPage can pre-mint an order client-side when the first
// line is toggled on (the UI needs the id to wire the line in the same
// update).
export function createEmptyOrder(): PosOrder {
  return newOrder()
}

// ============================================================================
// Action types
// ============================================================================

export type PosFormAction =
  | { type: 'setCompany'; companyId: string | null }
  | { type: 'setCustomer'; customerId: string | null }
  | { type: 'setVendor'; vendorId: string | null }
  | { type: 'setNotes'; notes: string }
  | { type: 'setRequiresInvoice'; requiresInvoice: boolean }
  | { type: 'addCatalogLine'; item: CatalogItem }
  | { type: 'addFreeFormLine'; line: NewFreeFormLine }
  | { type: 'updateLine'; id: string; patch: Partial<PosLine> }
  | { type: 'removeLine'; id: string }
  // LIT-37: work-order management. The UI composes `addOrder` then
  // `setLineOrder` when the first toggle-on fires, so both actions land
  // in one render pass via a thunk-style dispatch pair.
  | { type: 'addOrder'; order: PosOrder }
  | { type: 'removeOrder'; clientId: string }
  | { type: 'updateOrder'; clientId: string; patch: Partial<Omit<PosOrder, 'clientId'>> }
  | { type: 'setLineOrder'; id: string; orderClientId: string | null }
  | { type: 'reset' }

export interface NewFreeFormLine {
  concept: string
  dimensions?: string
  material?: string
  unit: string
  quantity: number
  unitPrice: number
  discountType?: LineDiscountType
  discountValue?: number
}

// ============================================================================
// Reducer
// ============================================================================

export function posFormReducer(state: PosFormState, action: PosFormAction): PosFormState {
  switch (action.type) {
    case 'setCompany':
      return { ...state, companyId: action.companyId }
    case 'setCustomer':
      return { ...state, customerId: action.customerId }
    case 'setVendor':
      return { ...state, vendorId: action.vendorId }
    case 'setNotes':
      return { ...state, notes: action.notes }
    case 'setRequiresInvoice':
      return { ...state, requiresInvoice: action.requiresInvoice }
    case 'addCatalogLine': {
      const { item } = action
      // Variable-priced items land with unitPrice = 0 so the operator
      // has to type a real price before the "Cobrar" button enables.
      // Fixed-priced items carry the catalog price as a default; the
      // operator can still edit it per line (pricing is snapshotted on
      // the line row so catalog edits never rewrite historical notes).
      const unitPrice = item.pricing_mode === 'variable' ? 0 : Number(item.price)
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            id: randomId(),
            catalogItemId: item.id,
            concept: item.name,
            dimensions: '',
            material: '',
            unit: item.unit,
            quantity: 1,
            unitPrice,
            discountType: 'none',
            discountValue: 0,
            orderClientId: null,
          },
        ],
      }
    }
    case 'addFreeFormLine':
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            id: randomId(),
            catalogItemId: null,
            concept: action.line.concept,
            dimensions: action.line.dimensions ?? '',
            material: action.line.material ?? '',
            unit: action.line.unit,
            quantity: action.line.quantity,
            unitPrice: action.line.unitPrice,
            discountType: action.line.discountType ?? 'none',
            discountValue: action.line.discountValue ?? 0,
            orderClientId: null,
          },
        ],
      }
    case 'updateLine':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === action.id ? { ...line, ...action.patch } : line
        ),
      }
    case 'removeLine':
      return { ...state, lines: state.lines.filter((line) => line.id !== action.id) }
    case 'addOrder':
      return { ...state, orders: [...state.orders, action.order] }
    case 'removeOrder':
      // Lines attached to the removed order fall back to Mostrador.
      // Kept as a single reducer step so the UI can't render a frame
      // with an orphan `orderClientId`.
      return {
        ...state,
        orders: state.orders.filter((order) => order.clientId !== action.clientId),
        lines: state.lines.map((line) =>
          line.orderClientId === action.clientId ? { ...line, orderClientId: null } : line
        ),
      }
    case 'updateOrder':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.clientId === action.clientId ? { ...order, ...action.patch } : order
        ),
      }
    case 'setLineOrder':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === action.id ? { ...line, orderClientId: action.orderClientId } : line
        ),
      }
    case 'reset':
      // Keep the selected company — the operator is likely charging
      // the next customer for the same razón social. Everything else
      // (including any in-progress orders) resets.
      return { ...initialPosFormState(), companyId: state.companyId }
  }
}

// ============================================================================
// Selectors / payload projection
// ============================================================================

// Projects the client-side state down to the shape the
// `create_sales_note` RPC expects. Trimmed: empty strings become nulls,
// optional line fields drop when blank.
export interface CreateSalesNoteLinePayload {
  catalog_item_id: string | null
  concept: string
  dimensions: string | null
  material: string | null
  unit: string
  quantity: number
  unit_price: number
  discount_type: LineDiscountType
  discount_value: number
  work_order_client_id: string | null
}

export interface CreateSalesNoteWorkOrderPayload {
  client_id: string
  description: string | null
  priority: WorkOrderPriority
  promised_at: string | null
}

export interface CreateSalesNotePayload {
  company_id: string
  customer_id: string | null
  vendor_id: string | null
  notes: string | null
  requires_invoice: boolean
  lines: CreateSalesNoteLinePayload[]
  work_orders: CreateSalesNoteWorkOrderPayload[]
}

export function toCreateSalesNotePayload(state: PosFormState): CreateSalesNotePayload {
  if (!state.companyId) {
    // Guard against an impossible call site — the submit button is
    // disabled when companyId is null, so this should never throw in
    // practice. If it does, something upstream skipped a check.
    throw new Error('toCreateSalesNotePayload: companyId is required')
  }
  // Drop orders with zero referencing lines client-side. LIT-105:
  // canSubmit is the primary gate for this now (blocks the Cobrar
  // button when any order is orphan), so this filter is defensive
  // belt-and-suspenders — if it ever fires the UI slipped a bug.
  const referencedOrderIds = new Set(
    state.lines.map((line) => line.orderClientId).filter((id): id is string => id !== null)
  )
  return {
    company_id: state.companyId,
    customer_id: state.customerId,
    vendor_id: state.vendorId,
    notes: state.notes.trim() === '' ? null : state.notes.trim(),
    requires_invoice: state.requiresInvoice,
    lines: state.lines.map((line) => ({
      catalog_item_id: line.catalogItemId,
      concept: line.concept.trim(),
      dimensions: line.dimensions.trim() === '' ? null : line.dimensions.trim(),
      material: line.material.trim() === '' ? null : line.material.trim(),
      unit: line.unit,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      discount_type: line.discountType,
      discount_value: line.discountValue,
      work_order_client_id: line.orderClientId,
    })),
    work_orders: state.orders
      .filter((order) => referencedOrderIds.has(order.clientId))
      .map((order) => ({
        client_id: order.clientId,
        description: order.description.trim() === '' ? null : order.description.trim(),
        priority: order.priority,
        promised_at: order.promisedAt,
      })),
  }
}

// True when the form is ready to submit: company picked, at least one
// line, each line has qty > 0 and unit_price >= 0, percent discount
// capped at 100. Mirrors the DB CHECK constraints so the user gets
// local feedback before a failing round trip.
//
// LIT-37: also blocks submit when the nota has at least one referenced
// work order but no customer attached. The shop needs a callable
// contact for production follow-ups; pure counter sales stay
// customer-optional.
//
// LIT-105: blocks submit when any declared order has zero lines
// assigned. Previously the payload projection silently pruned those
// orders, which read to operators as successful creation — the order
// would vanish without a trace. Forcing the operator to either
// assign a line or delete the empty order eliminates that data-loss
// UX.
export function canSubmit(state: PosFormState): boolean {
  if (!state.companyId) return false
  if (state.lines.length === 0) return false
  if (!state.lines.every(isLineValid)) return false
  if (hasReferencedOrder(state) && !state.customerId) return false
  if (orphanOrders(state).length > 0) return false
  return true
}

// True when at least one line is attached to a work order. Used to
// gate customer-required UI affordances (submit disable, inline hint).
export function hasReferencedOrder(state: PosFormState): boolean {
  return state.lines.some((line) => line.orderClientId !== null)
}

// LIT-105: orders the operator declared but never assigned a line to.
// Callers: the submit gate (canSubmit) and the per-card warning in
// WorkOrderPanels. Always reflects the current line → order wiring;
// removing the last line of an order instantly makes it orphan again.
export function orphanOrders(state: PosFormState): PosOrder[] {
  if (state.orders.length === 0) return []
  const referenced = new Set(
    state.lines.map((line) => line.orderClientId).filter((id): id is string => id !== null)
  )
  return state.orders.filter((order) => !referenced.has(order.clientId))
}

export function isLineValid(line: PosLine): boolean {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) return false
  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) return false
  if (!Number.isFinite(line.discountValue) || line.discountValue < 0) return false
  if (line.discountType === 'percent' && line.discountValue > 100) return false
  if (line.concept.trim().length === 0) return false
  return true
}

// Re-exported for convenience so PosPage doesn't need two imports to
// identify the catalog units allowed by the DB CHECK.
export type PosUnit = CatalogUnit

// ============================================================================
// Draft persistence helpers (LIT-87)
// ============================================================================

// A draft is "empty" when it carries no user-meaningful data. Note
// that `companyId` is intentionally excluded: after Cobrar the reducer
// resets everything except the company (pos-form-state.ts `reset`
// case), and we don't want that lingering companyId to keep the draft
// in storage or trigger a "Venta restaurada" toast on the next mount.
// LIT-86's `pos-preferences.lastCompanyId` handles the sticky default
// for the empty-draft case.
export function isDraftEmpty(state: PosFormState): boolean {
  return (
    state.lines.length === 0 &&
    state.customerId === null &&
    state.vendorId === null &&
    state.notes.trim() === '' &&
    state.requiresInvoice === false
  )
}

export interface SanitizeDraftContext {
  // Active company ids (filtered to `is_active` only — we don't want
  // to resurrect a deactivated razón social).
  activeCompanyIds: Set<string>
  // Active catalog item ids. Lines with a stale `catalogItemId` have
  // the FK nulled but keep their concept/price snapshot so the
  // operator's work isn't lost.
  activeCatalogItemIds: Set<string>
  // True unless the persisted `customerId` was looked up and returned
  // no row. Callers pass `true` when `state.customerId` is null or
  // while the fetch is still pending — drop only when we're sure.
  customerValid: boolean
  // LIT-107: active vendor ids. A draft referencing a deactivated
  // vendor gets its vendorId cleared back to null (Sin vendedor).
  activeVendorIds: Set<string>
}

export function sanitizeDraft(
  state: PosFormState,
  ctx: SanitizeDraftContext
): { state: PosFormState; drifted: boolean } {
  let drifted = false

  let companyId = state.companyId
  if (companyId !== null && !ctx.activeCompanyIds.has(companyId)) {
    companyId = null
    drifted = true
  }

  let customerId = state.customerId
  if (customerId !== null && !ctx.customerValid) {
    customerId = null
    drifted = true
  }

  let vendorId = state.vendorId
  if (vendorId !== null && !ctx.activeVendorIds.has(vendorId)) {
    vendorId = null
    drifted = true
  }

  const lines = state.lines.map((line) => {
    if (line.catalogItemId !== null && !ctx.activeCatalogItemIds.has(line.catalogItemId)) {
      drifted = true
      return { ...line, catalogItemId: null }
    }
    return line
  })

  // LIT-37: prune orders that ended up with zero lines after any
  // upstream pruning (e.g., the user deleted the last line of an
  // order in a previous session and we're hydrating the remainder).
  // Also null out orderClientId on any line pointing at an order that
  // no longer exists — defensive against a partial drift in persisted
  // state.
  const orderIds = new Set(state.orders.map((order) => order.clientId))
  const patchedLines = lines.map((line) => {
    if (line.orderClientId !== null && !orderIds.has(line.orderClientId)) {
      drifted = true
      return { ...line, orderClientId: null }
    }
    return line
  })
  const referenced = new Set(
    patchedLines.map((line) => line.orderClientId).filter((id): id is string => id !== null)
  )
  const orders = state.orders.filter((order) => {
    if (!referenced.has(order.clientId)) {
      drifted = true
      return false
    }
    return true
  })

  return {
    state: { ...state, companyId, customerId, vendorId, lines: patchedLines, orders },
    drifted,
  }
}
