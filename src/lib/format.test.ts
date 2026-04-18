import { describe, expect, it } from 'vitest'

import { formatMXN } from './format'

describe('formatMXN', () => {
  it('formats zero with two decimals', () => {
    expect(formatMXN(0)).toBe('$0.00')
  })

  it('formats small positive values', () => {
    expect(formatMXN(1234.5)).toBe('$1,234.50')
  })

  it('renders the es-MX thousands separator on larger values', () => {
    // Exact whitespace can drift across Node/ICU versions; asserting the
    // digit pattern keeps the test portable.
    expect(formatMXN(1234567.89)).toMatch(/^\$1.234.567\.89$/)
  })

  it('collapses non-finite input to zero so NaN never reaches the UI', () => {
    expect(formatMXN(Number.NaN)).toBe('$0.00')
    expect(formatMXN(Number.POSITIVE_INFINITY)).toBe('$0.00')
    expect(formatMXN(Number.NEGATIVE_INFINITY)).toBe('$0.00')
  })

  it('keeps the negative sign on negative values', () => {
    expect(formatMXN(-12.3).startsWith('-')).toBe(true)
  })
})
