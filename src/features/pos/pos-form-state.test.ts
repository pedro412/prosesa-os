import { describe, expect, it } from 'vitest'

import type { CatalogItem } from '@/lib/queries/catalog'

import {
  canSubmit,
  createEmptyOrder,
  initialPosFormState,
  isDraftEmpty,
  isLineValid,
  orphanOrders,
  posFormReducer,
  sanitizeDraft,
  toCreateSalesNotePayload,
} from './pos-form-state'

// Minimal CatalogItem builder — the reducer only reads name, unit,
// price, pricing_mode and id, so we don't need to match the full DB
// type. `as unknown as CatalogItem` keeps the cast honest.
function makeItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  const base = {
    id: 'item-1',
    name: 'Lona 13oz',
    description: null,
    category_id: 'cat-1',
    unit: 'm2',
    price: 150,
    pricing_mode: 'fixed',
    is_active: true,
    created_at: '2026-04-18T00:00:00Z',
    updated_at: '2026-04-18T00:00:00Z',
    deleted_at: null,
    created_by: null,
    updated_by: null,
    ...overrides,
  }
  return base as unknown as CatalogItem
}

describe('posFormReducer — scalar fields', () => {
  it('setCompany updates only companyId', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' })
    expect(s.companyId).toBe('co-a')
    expect(s.lines).toEqual([])
  })

  it('setCustomer accepts null to clear', () => {
    const seeded = posFormReducer(initialPosFormState(), {
      type: 'setCustomer',
      customerId: 'cu-1',
    })
    const cleared = posFormReducer(seeded, { type: 'setCustomer', customerId: null })
    expect(cleared.customerId).toBeNull()
  })

  it('setRequiresInvoice toggles the flag', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'setRequiresInvoice',
      requiresInvoice: true,
    })
    expect(s.requiresInvoice).toBe(true)
  })
})

describe('posFormReducer — addCatalogLine', () => {
  it('appends a fixed-price item with catalog price pre-filled', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem({ id: 'lona', name: 'Lona 13oz', unit: 'm2', price: 150 }),
    })
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0]).toMatchObject({
      catalogItemId: 'lona',
      concept: 'Lona 13oz',
      unit: 'm2',
      quantity: 1,
      unitPrice: 150,
      discountType: 'none',
    })
    expect(s.lines[0].id).toBeTruthy()
  })

  it('starts a variable-price item at 0 so the operator must type a price', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem({
        id: 'var',
        pricing_mode: 'variable',
        price: 999, // ignored for variable items
      }),
    })
    expect(s.lines[0].unitPrice).toBe(0)
  })

  it('preserves insertion order across multiple adds', () => {
    const a = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem({ id: 'a', name: 'A' }),
    })
    const b = posFormReducer(a, {
      type: 'addCatalogLine',
      item: makeItem({ id: 'b', name: 'B' }),
    })
    expect(b.lines.map((l) => l.concept)).toEqual(['A', 'B'])
  })
})

describe('posFormReducer — addFreeFormLine', () => {
  it('accepts minimal free-form input and fills defaults', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addFreeFormLine',
      line: { concept: 'Rótulo especial', unit: 'pieza', quantity: 1, unitPrice: 500 },
    })
    expect(s.lines[0]).toMatchObject({
      catalogItemId: null,
      concept: 'Rótulo especial',
      dimensions: '',
      material: '',
      discountType: 'none',
      discountValue: 0,
    })
  })

  it('carries dimensions, material, and discount when provided', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addFreeFormLine',
      line: {
        concept: 'Vinil',
        dimensions: '1x2m',
        material: 'Vinil transparente',
        unit: 'm2',
        quantity: 2,
        unitPrice: 150,
        discountType: 'percent',
        discountValue: 10,
      },
    })
    expect(s.lines[0].dimensions).toBe('1x2m')
    expect(s.lines[0].material).toBe('Vinil transparente')
    expect(s.lines[0].discountType).toBe('percent')
    expect(s.lines[0].discountValue).toBe(10)
  })
})

describe('posFormReducer — updateLine + removeLine', () => {
  it('patches only the targeted line', () => {
    const seeded = posFormReducer(
      posFormReducer(initialPosFormState(), {
        type: 'addCatalogLine',
        item: makeItem({ id: 'a', name: 'A' }),
      }),
      { type: 'addCatalogLine', item: makeItem({ id: 'b', name: 'B' }) }
    )
    const targetId = seeded.lines[1].id
    const patched = posFormReducer(seeded, {
      type: 'updateLine',
      id: targetId,
      patch: { quantity: 5, unitPrice: 99 },
    })
    expect(patched.lines[0].quantity).toBe(1)
    expect(patched.lines[1].quantity).toBe(5)
    expect(patched.lines[1].unitPrice).toBe(99)
  })

  it('removes the targeted line and leaves the others intact', () => {
    const seeded = posFormReducer(
      posFormReducer(
        posFormReducer(initialPosFormState(), {
          type: 'addCatalogLine',
          item: makeItem({ id: 'a', name: 'A' }),
        }),
        { type: 'addCatalogLine', item: makeItem({ id: 'b', name: 'B' }) }
      ),
      { type: 'addCatalogLine', item: makeItem({ id: 'c', name: 'C' }) }
    )
    const middleId = seeded.lines[1].id
    const after = posFormReducer(seeded, { type: 'removeLine', id: middleId })
    expect(after.lines.map((l) => l.concept)).toEqual(['A', 'C'])
  })
})

describe('posFormReducer — reset', () => {
  it('keeps the company but clears lines, customer, notes, flag', () => {
    const seeded = posFormReducer(
      posFormReducer(
        posFormReducer(
          posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' }),
          { type: 'setCustomer', customerId: 'cu-1' }
        ),
        { type: 'setNotes', notes: 'frágil' }
      ),
      { type: 'addCatalogLine', item: makeItem() }
    )
    const after = posFormReducer(seeded, { type: 'reset' })
    expect(after.companyId).toBe('co-a')
    expect(after.customerId).toBeNull()
    expect(after.notes).toBe('')
    expect(after.lines).toEqual([])
  })
})

describe('isLineValid', () => {
  const validLine = {
    id: 'x',
    catalogItemId: null,
    concept: 'Producto',
    dimensions: '',
    material: '',
    unit: 'pieza',
    quantity: 1,
    unitPrice: 100,
    discountType: 'none' as const,
    discountValue: 0,
    orderClientId: null,
  }

  it('accepts a well-formed line', () => {
    expect(isLineValid(validLine)).toBe(true)
  })

  it('rejects zero or negative quantity', () => {
    expect(isLineValid({ ...validLine, quantity: 0 })).toBe(false)
    expect(isLineValid({ ...validLine, quantity: -1 })).toBe(false)
  })

  it('rejects negative unit price but allows zero (variable catalog item mid-edit fails canSubmit but a 0-priced freebie is valid if intentional)', () => {
    expect(isLineValid({ ...validLine, unitPrice: -1 })).toBe(false)
    expect(isLineValid({ ...validLine, unitPrice: 0 })).toBe(true)
  })

  it('rejects percent discounts above 100', () => {
    expect(isLineValid({ ...validLine, discountType: 'percent', discountValue: 150 })).toBe(false)
    expect(isLineValid({ ...validLine, discountType: 'percent', discountValue: 100 })).toBe(true)
  })

  it('rejects blank concepts', () => {
    expect(isLineValid({ ...validLine, concept: '   ' })).toBe(false)
  })
})

describe('canSubmit', () => {
  const item = makeItem({ id: 'a', name: 'A', price: 100 })

  it('is false with no company', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'addCatalogLine', item })
    expect(canSubmit(s)).toBe(false)
  })

  it('is false with no lines', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-a',
    })
    expect(canSubmit(s)).toBe(false)
  })

  it('is true once company + a valid line exist', () => {
    const s = posFormReducer(
      posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' }),
      { type: 'addCatalogLine', item }
    )
    expect(canSubmit(s)).toBe(true)
  })

  it('is false if any line is invalid (percent discount > 100)', () => {
    const seeded = posFormReducer(
      posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' }),
      { type: 'addCatalogLine', item }
    )
    const lineId = seeded.lines[0].id
    const broken = posFormReducer(seeded, {
      type: 'updateLine',
      id: lineId,
      patch: { discountType: 'percent', discountValue: 150 },
    })
    expect(canSubmit(broken)).toBe(false)
  })

  it('is false when a work order is declared but has zero lines (LIT-105)', () => {
    // Counter line + orphan order → RPC would have silently dropped the
    // order pre-fix. Gate now refuses the submit until the operator
    // assigns a line or deletes the order.
    const order = createEmptyOrder()
    const withCompany = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-a',
    })
    const withLine = posFormReducer(withCompany, { type: 'addCatalogLine', item })
    const withOrphan = posFormReducer(withLine, { type: 'addOrder', order })
    expect(canSubmit(withOrphan)).toBe(false)
  })

  it('is true once a line is assigned into the previously-orphan order', () => {
    const order = createEmptyOrder()
    const withCompany = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-a',
    })
    // Customer required because an order is referenced (LIT-37 rule).
    const withCustomer = posFormReducer(withCompany, {
      type: 'setCustomer',
      customerId: 'cu-1',
    })
    const withLine = posFormReducer(withCustomer, { type: 'addCatalogLine', item })
    const withOrphan = posFormReducer(withLine, { type: 'addOrder', order })
    const lineId = withOrphan.lines[0].id
    const assigned = posFormReducer(withOrphan, {
      type: 'setLineOrder',
      id: lineId,
      orderClientId: order.clientId,
    })
    expect(canSubmit(assigned)).toBe(true)
  })
})

describe('orphanOrders (LIT-105)', () => {
  const item = makeItem({ id: 'a', name: 'A', price: 100 })

  it('returns [] when state has no declared orders', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' })
    expect(orphanOrders(s)).toEqual([])
  })

  it('returns [] when every declared order has at least one referencing line', () => {
    const order = createEmptyOrder()
    const withCompany = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-a',
    })
    const withLine = posFormReducer(withCompany, { type: 'addCatalogLine', item })
    const withOrder = posFormReducer(withLine, { type: 'addOrder', order })
    const lineId = withOrder.lines[0].id
    const assigned = posFormReducer(withOrder, {
      type: 'setLineOrder',
      id: lineId,
      orderClientId: order.clientId,
    })
    expect(orphanOrders(assigned)).toEqual([])
  })

  it('returns only the orders with zero referencing lines', () => {
    const orderA = createEmptyOrder()
    const orderB = createEmptyOrder()
    const withCompany = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-a',
    })
    const withLine = posFormReducer(withCompany, { type: 'addCatalogLine', item })
    const withOrderA = posFormReducer(withLine, { type: 'addOrder', order: orderA })
    const withOrderB = posFormReducer(withOrderA, { type: 'addOrder', order: orderB })
    const lineId = withOrderB.lines[0].id
    const assignedToA = posFormReducer(withOrderB, {
      type: 'setLineOrder',
      id: lineId,
      orderClientId: orderA.clientId,
    })
    const orphans = orphanOrders(assignedToA)
    expect(orphans).toHaveLength(1)
    expect(orphans[0].clientId).toBe(orderB.clientId)
  })
})

describe('isDraftEmpty', () => {
  it('is true for a fresh form', () => {
    expect(isDraftEmpty(initialPosFormState())).toBe(true)
  })

  it('is true when only companyId is set — post-Cobrar reset shape', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' })
    expect(isDraftEmpty(s)).toBe(true)
  })

  it('is false with a customer attached', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setCustomer', customerId: 'cu-1' })
    expect(isDraftEmpty(s)).toBe(false)
  })

  it('is false with non-whitespace notes', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setNotes', notes: 'apartado' })
    expect(isDraftEmpty(s)).toBe(false)
  })

  it('treats whitespace-only notes as empty', () => {
    const s = posFormReducer(initialPosFormState(), { type: 'setNotes', notes: '   \n' })
    expect(isDraftEmpty(s)).toBe(true)
  })

  it('is false with requiresInvoice toggled on', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'setRequiresInvoice',
      requiresInvoice: true,
    })
    expect(isDraftEmpty(s)).toBe(false)
  })

  it('is false with at least one line', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem(),
    })
    expect(isDraftEmpty(s)).toBe(false)
  })
})

describe('sanitizeDraft', () => {
  function seedFullDraft() {
    let s = posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' })
    s = posFormReducer(s, { type: 'setCustomer', customerId: 'cu-1' })
    s = posFormReducer(s, { type: 'setNotes', notes: 'frágil' })
    s = posFormReducer(s, {
      type: 'addCatalogLine',
      item: makeItem({ id: 'item-1', name: 'Lona' }),
    })
    s = posFormReducer(s, {
      type: 'addFreeFormLine',
      line: { concept: 'Rotulación', unit: 'pieza', quantity: 1, unitPrice: 300 },
    })
    return s
  }

  it('passes through when every reference still resolves', () => {
    const state = seedFullDraft()
    const ctx = {
      activeCompanyIds: new Set(['co-a', 'co-b']),
      activeCatalogItemIds: new Set(['item-1']),
      customerValid: true,
    }
    const result = sanitizeDraft(state, ctx)
    expect(result.drifted).toBe(false)
    expect(result.state.companyId).toBe('co-a')
    expect(result.state.customerId).toBe('cu-1')
    expect(result.state.lines[0].catalogItemId).toBe('item-1')
  })

  it('nulls a deactivated company and flags drift', () => {
    const state = posFormReducer(initialPosFormState(), {
      type: 'setCompany',
      companyId: 'co-gone',
    })
    const result = sanitizeDraft(state, {
      activeCompanyIds: new Set(['co-a']),
      activeCatalogItemIds: new Set(),
      customerValid: true,
    })
    expect(result.drifted).toBe(true)
    expect(result.state.companyId).toBeNull()
  })

  it('nulls a deleted customer and flags drift', () => {
    const state = posFormReducer(initialPosFormState(), {
      type: 'setCustomer',
      customerId: 'cu-gone',
    })
    const result = sanitizeDraft(state, {
      activeCompanyIds: new Set(),
      activeCatalogItemIds: new Set(),
      customerValid: false,
    })
    expect(result.drifted).toBe(true)
    expect(result.state.customerId).toBeNull()
  })

  it('nulls a deleted catalog item on a line but keeps the concept/price snapshot', () => {
    const state = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem({ id: 'item-gone', name: 'Lona descontinuada', price: 200 }),
    })
    const result = sanitizeDraft(state, {
      activeCompanyIds: new Set(),
      activeCatalogItemIds: new Set(),
      customerValid: true,
    })
    expect(result.drifted).toBe(true)
    expect(result.state.lines).toHaveLength(1)
    expect(result.state.lines[0].catalogItemId).toBeNull()
    expect(result.state.lines[0].concept).toBe('Lona descontinuada')
    expect(result.state.lines[0].unitPrice).toBe(200)
  })

  it('leaves free-form lines (null catalogItemId) untouched', () => {
    const state = posFormReducer(initialPosFormState(), {
      type: 'addFreeFormLine',
      line: { concept: 'Servicio', unit: 'pieza', quantity: 1, unitPrice: 50 },
    })
    const result = sanitizeDraft(state, {
      activeCompanyIds: new Set(),
      activeCatalogItemIds: new Set(),
      customerValid: true,
    })
    expect(result.drifted).toBe(false)
    expect(result.state.lines[0]).toEqual(state.lines[0])
  })

  it('reports drift across multiple concurrent issues in a single pass', () => {
    const state = seedFullDraft()
    const result = sanitizeDraft(state, {
      activeCompanyIds: new Set(), // company gone
      activeCatalogItemIds: new Set(), // catalog item gone
      customerValid: false, // customer gone
    })
    expect(result.drifted).toBe(true)
    expect(result.state.companyId).toBeNull()
    expect(result.state.customerId).toBeNull()
    expect(result.state.lines[0].catalogItemId).toBeNull()
    expect(result.state.lines[0].concept).toBe('Lona') // snapshot preserved
    expect(result.state.lines[1].catalogItemId).toBeNull() // free-form already null
  })
})

describe('toCreateSalesNotePayload', () => {
  it('throws when companyId is missing (defensive guard)', () => {
    const s = posFormReducer(initialPosFormState(), {
      type: 'addCatalogLine',
      item: makeItem(),
    })
    expect(() => toCreateSalesNotePayload(s)).toThrow(/companyId is required/)
  })

  it('projects to the RPC shape with nullable blanks collapsed', () => {
    const seeded = posFormReducer(
      posFormReducer(
        posFormReducer(initialPosFormState(), { type: 'setCompany', companyId: 'co-a' }),
        { type: 'setNotes', notes: '   ' }
      ),
      {
        type: 'addFreeFormLine',
        line: {
          concept: '  Vinil  ',
          dimensions: '1x2m',
          material: '',
          unit: 'm2',
          quantity: 2,
          unitPrice: 150,
        },
      }
    )
    const payload = toCreateSalesNotePayload(seeded)
    expect(payload).toEqual({
      company_id: 'co-a',
      customer_id: null,
      notes: null,
      requires_invoice: false,
      lines: [
        {
          catalog_item_id: null,
          concept: 'Vinil',
          dimensions: '1x2m',
          material: null,
          unit: 'm2',
          quantity: 2,
          unit_price: 150,
          discount_type: 'none',
          discount_value: 0,
          work_order_client_id: null,
        },
      ],
      work_orders: [],
    })
  })
})
