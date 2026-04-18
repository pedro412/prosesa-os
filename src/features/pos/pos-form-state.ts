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
import type { LineDiscountType } from '@/lib/tax'

// Client-only id for stable React keys on dynamically added lines.
// Not persisted — the DB assigns its own uuid on insert.
function randomLineId(): string {
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
}

export interface PosFormState {
  companyId: string | null
  customerId: string | null
  notes: string
  requiresInvoice: boolean
  lines: PosLine[]
}

export function initialPosFormState(): PosFormState {
  return {
    companyId: null,
    customerId: null,
    notes: '',
    requiresInvoice: false,
    lines: [],
  }
}

// ============================================================================
// Action types
// ============================================================================

export type PosFormAction =
  | { type: 'setCompany'; companyId: string | null }
  | { type: 'setCustomer'; customerId: string | null }
  | { type: 'setNotes'; notes: string }
  | { type: 'setRequiresInvoice'; requiresInvoice: boolean }
  | { type: 'addCatalogLine'; item: CatalogItem }
  | { type: 'addFreeFormLine'; line: NewFreeFormLine }
  | { type: 'updateLine'; id: string; patch: Partial<PosLine> }
  | { type: 'removeLine'; id: string }
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
            id: randomLineId(),
            catalogItemId: item.id,
            concept: item.name,
            dimensions: '',
            material: '',
            unit: item.unit,
            quantity: 1,
            unitPrice,
            discountType: 'none',
            discountValue: 0,
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
            id: randomLineId(),
            catalogItemId: null,
            concept: action.line.concept,
            dimensions: action.line.dimensions ?? '',
            material: action.line.material ?? '',
            unit: action.line.unit,
            quantity: action.line.quantity,
            unitPrice: action.line.unitPrice,
            discountType: action.line.discountType ?? 'none',
            discountValue: action.line.discountValue ?? 0,
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
    case 'reset':
      // Keep the selected company — the operator is likely charging
      // the next customer for the same razón social. Everything else
      // resets. Resetting the company too is a one-off click.
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
}

export interface CreateSalesNotePayload {
  company_id: string
  customer_id: string | null
  notes: string | null
  requires_invoice: boolean
  lines: CreateSalesNoteLinePayload[]
}

export function toCreateSalesNotePayload(state: PosFormState): CreateSalesNotePayload {
  if (!state.companyId) {
    // Guard against an impossible call site — the submit button is
    // disabled when companyId is null, so this should never throw in
    // practice. If it does, something upstream skipped a check.
    throw new Error('toCreateSalesNotePayload: companyId is required')
  }
  return {
    company_id: state.companyId,
    customer_id: state.customerId,
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
    })),
  }
}

// True when the form is ready to submit: company picked, at least one
// line, each line has qty > 0 and unit_price >= 0, percent discount
// capped at 100. Mirrors the DB CHECK constraints so the user gets
// local feedback before a failing round trip.
export function canSubmit(state: PosFormState): boolean {
  if (!state.companyId) return false
  if (state.lines.length === 0) return false
  return state.lines.every(isLineValid)
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
