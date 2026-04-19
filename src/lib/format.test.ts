import { describe, expect, it } from 'vitest'

import { formatMoneyInput, formatMXN, parseMoneyInput } from './format'

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

describe('formatMoneyInput', () => {
  it('renders zero with two decimals and no currency symbol', () => {
    expect(formatMoneyInput(0)).toBe('0.00')
  })

  it('adds thousands separators', () => {
    expect(formatMoneyInput(2000)).toBe('2,000.00')
    expect(formatMoneyInput(45000)).toBe('45,000.00')
    expect(formatMoneyInput(120000)).toBe('120,000.00')
    expect(formatMoneyInput(1234567.89)).toBe('1,234,567.89')
  })

  it('pads short decimals to two digits', () => {
    expect(formatMoneyInput(1234.5)).toBe('1,234.50')
    expect(formatMoneyInput(1234)).toBe('1,234.00')
  })

  it('collapses non-finite input to 0.00', () => {
    expect(formatMoneyInput(Number.NaN)).toBe('0.00')
    expect(formatMoneyInput(Number.POSITIVE_INFINITY)).toBe('0.00')
  })
})

describe('parseMoneyInput', () => {
  it('parses canonical formatted values', () => {
    expect(parseMoneyInput('2,000.00')).toBe(2000)
    expect(parseMoneyInput('45,000.00')).toBe(45000)
    expect(parseMoneyInput('120,000.00')).toBe(120000)
    expect(parseMoneyInput('1,234,567.89')).toBe(1234567.89)
  })

  it('tolerates missing thousands separators and decimals', () => {
    expect(parseMoneyInput('1234')).toBe(1234)
    expect(parseMoneyInput('1234.5')).toBe(1234.5)
  })

  it('returns 0 for empty or invalid input', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('.')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
  })
})
