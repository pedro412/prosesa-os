import { describe, expect, it } from 'vitest'

import { computeLine, computeLineTotal, computeTotals, formatIvaRate, roundMoney } from './tax'

// The LIT-32 AC asks for edge-case coverage around zero, rounding
// boundaries, and 100% discount. The tests below pin each of those
// plus the inclusive/exclusive parity identity that the printed ticket
// depends on.

describe('roundMoney', () => {
  it('rounds half-away-from-zero to 2 decimals', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(1.015)).toBe(1.02)
    expect(roundMoney(1.004)).toBe(1.0)
    expect(roundMoney(-1.005)).toBe(-1.01)
  })

  it('preserves values already at 2 decimals', () => {
    expect(roundMoney(12.34)).toBe(12.34)
    expect(roundMoney(0)).toBe(0)
  })

  it('is resilient to non-finite input', () => {
    expect(roundMoney(Number.NaN)).toBe(0)
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('computeLine', () => {
  it('returns zeros for a zero-quantity line', () => {
    expect(
      computeLine({ quantity: 0, unitPrice: 100, discountType: 'none', discountValue: 0 })
    ).toEqual({ gross: 0, discount: 0, lineTotal: 0 })
  })

  it('computes gross = qty * unit with no discount', () => {
    expect(
      computeLine({ quantity: 3, unitPrice: 25.5, discountType: 'none', discountValue: 0 })
    ).toEqual({ gross: 76.5, discount: 0, lineTotal: 76.5 })
  })

  it('applies a percent discount', () => {
    expect(
      computeLine({ quantity: 2, unitPrice: 100, discountType: 'percent', discountValue: 10 })
    ).toEqual({ gross: 200, discount: 20, lineTotal: 180 })
  })

  it('zeroes out at 100% percent discount', () => {
    expect(
      computeLine({ quantity: 2, unitPrice: 100, discountType: 'percent', discountValue: 100 })
    ).toEqual({ gross: 200, discount: 200, lineTotal: 0 })
  })

  it('applies a fixed discount', () => {
    expect(
      computeLine({ quantity: 1, unitPrice: 150, discountType: 'fixed', discountValue: 25 })
    ).toEqual({ gross: 150, discount: 25, lineTotal: 125 })
  })

  it('clamps line_total to 0 when a fixed discount exceeds gross', () => {
    // The DB CHECK on `sales_note_lines.line_total >= 0` would reject a
    // negative value; the helper must match that floor so the app never
    // produces a row the DB would refuse.
    expect(
      computeLine({ quantity: 1, unitPrice: 50, discountType: 'fixed', discountValue: 75 })
    ).toEqual({ gross: 50, discount: 75, lineTotal: 0 })
  })

  it('handles rounding at the cent boundary on percent discount', () => {
    // 33.33 * 3 = 99.99; 10% off = 9.999 → rounds to 10.00; net 89.99.
    expect(
      computeLine({ quantity: 3, unitPrice: 33.33, discountType: 'percent', discountValue: 10 })
    ).toEqual({ gross: 99.99, discount: 10, lineTotal: 89.99 })
  })
})

describe('computeLineTotal', () => {
  it('is a thin wrapper around computeLine', () => {
    const total = computeLineTotal({
      quantity: 4,
      unitPrice: 12.5,
      discountType: 'percent',
      discountValue: 50,
    })
    expect(total).toBe(25)
  })
})

describe('computeTotals — inclusive mode', () => {
  const baseLine = { discountType: 'none' as const, discountValue: 0 }

  it('back-calculates subtotal and iva from the line sum', () => {
    // Single line total = 116 at 16% IVA inclusive → subtotal = 100, iva = 16.
    const totals = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 116 }],
      ivaRate: 0.16,
      ivaInclusive: true,
    })
    expect(totals).toEqual({ subtotal: 100, iva: 16, total: 116 })
  })

  it('preserves the subtotal + iva === total identity on awkward totals', () => {
    // Picked because 199.99 / 1.16 produces a non-terminating division
    // that could drop a cent if iva were derived from rate rather than
    // from (total - subtotal).
    const totals = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 199.99 }],
      ivaRate: 0.16,
      ivaInclusive: true,
    })
    expect(totals.subtotal + totals.iva).toBe(totals.total)
  })

  it('handles 0% IVA (total === subtotal, iva === 0)', () => {
    const totals = computeTotals({
      lines: [{ ...baseLine, quantity: 2, unitPrice: 50 }],
      ivaRate: 0,
      ivaInclusive: true,
    })
    expect(totals).toEqual({ subtotal: 100, iva: 0, total: 100 })
  })

  it('returns zeros for an empty line list', () => {
    expect(computeTotals({ lines: [], ivaRate: 0.16, ivaInclusive: true })).toEqual({
      subtotal: 0,
      iva: 0,
      total: 0,
    })
  })
})

describe('computeTotals — exclusive mode', () => {
  const baseLine = { discountType: 'none' as const, discountValue: 0 }

  it('adds IVA on top of the pre-tax line sum', () => {
    const totals = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 100 }],
      ivaRate: 0.16,
      ivaInclusive: false,
    })
    expect(totals).toEqual({ subtotal: 100, iva: 16, total: 116 })
  })

  it('sums multiple lines and then applies IVA once', () => {
    const totals = computeTotals({
      lines: [
        { ...baseLine, quantity: 2, unitPrice: 30 }, // 60
        { ...baseLine, quantity: 1, unitPrice: 40 }, // 40
        { quantity: 1, unitPrice: 100, discountType: 'percent', discountValue: 50 }, // 50
      ],
      ivaRate: 0.16,
      ivaInclusive: false,
    })
    expect(totals.subtotal).toBe(150)
    expect(totals.iva).toBe(24)
    expect(totals.total).toBe(174)
  })

  it('matches inclusive-mode totals when the inclusive price equals exclusive*(1+rate)', () => {
    // Parity: a line priced at 116 inclusive should produce the same
    // breakdown as a line priced at 100 exclusive at 16% — confirms
    // both branches agree on the identity.
    const incl = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 116 }],
      ivaRate: 0.16,
      ivaInclusive: true,
    })
    const excl = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 100 }],
      ivaRate: 0.16,
      ivaInclusive: false,
    })
    expect(incl).toEqual(excl)
  })

  it('handles 0% IVA (iva === 0, total === subtotal)', () => {
    const totals = computeTotals({
      lines: [{ ...baseLine, quantity: 1, unitPrice: 73.25 }],
      ivaRate: 0,
      ivaInclusive: false,
    })
    expect(totals).toEqual({ subtotal: 73.25, iva: 0, total: 73.25 })
  })

  it('returns zeros for a 100% discount line', () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, unitPrice: 500, discountType: 'percent', discountValue: 100 }],
      ivaRate: 0.16,
      ivaInclusive: false,
    })
    expect(totals).toEqual({ subtotal: 0, iva: 0, total: 0 })
  })
})

describe('formatIvaRate', () => {
  it('renders whole percentages without decimals', () => {
    expect(formatIvaRate(0.16)).toBe('16')
    expect(formatIvaRate(0.08)).toBe('8')
    expect(formatIvaRate(0)).toBe('0')
  })

  it('keeps meaningful fractional percentages', () => {
    expect(formatIvaRate(0.085)).toBe('8.5')
  })
})
