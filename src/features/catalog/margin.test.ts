import { describe, expect, it } from 'vitest'

import { computeMargin } from './margin'

describe('computeMargin', () => {
  it('returns unknown when cost is null', () => {
    expect(computeMargin(100, null)).toEqual({ pct: null, tone: 'unknown' })
  })

  it('returns unknown when cost is zero (same semantic as null)', () => {
    expect(computeMargin(100, 0)).toEqual({ pct: null, tone: 'unknown' })
  })

  it('returns unknown when price is zero', () => {
    expect(computeMargin(0, 50)).toEqual({ pct: null, tone: 'unknown' })
  })

  it('returns healthy for margin >= 20%', () => {
    expect(computeMargin(100, 50)).toEqual({ pct: 50, tone: 'healthy' })
    expect(computeMargin(100, 80)).toEqual({ pct: 20, tone: 'healthy' })
  })

  it('returns thin for margin 0-19%', () => {
    expect(computeMargin(100, 90)).toEqual({ pct: 10, tone: 'thin' })
    expect(computeMargin(100, 100)).toEqual({ pct: 0, tone: 'thin' })
  })

  it('returns negative when price is below cost', () => {
    expect(computeMargin(50, 100)).toEqual({ pct: -100, tone: 'negative' })
  })

  it('floors toward -infinity for consistent display', () => {
    // (100 - 81) / 100 = 19%, exactly the thin/healthy boundary just
    // under 20.
    expect(computeMargin(100, 81).pct).toBe(19)
    // Fractional margins floor down, never round up.
    expect(computeMargin(100, 59).pct).toBe(41)
  })
})
