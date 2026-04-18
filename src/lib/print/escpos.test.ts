import { describe, expect, it } from 'vitest'

import { concat, money, sanitize, trunc } from './escpos'

describe('sanitize', () => {
  it('strips Spanish diacritics to plain ASCII', () => {
    expect(sanitize('Impresión a colór')).toBe('Impresion a color')
    expect(sanitize('papelería')).toBe('papeleria')
  })

  it('maps ñ / Ñ to n / N', () => {
    expect(sanitize('Año Niño')).toBe('Ano Nino')
    expect(sanitize('Ñandú')).toBe('Nandu')
  })

  it('unwraps inverted punctuation', () => {
    expect(sanitize('¿Qué?')).toBe('?Que?')
    expect(sanitize('¡Hola!')).toBe('!Hola!')
  })

  it('replaces remaining non-ASCII with ?', () => {
    expect(sanitize('price: €100')).toBe('price: EUR100')
    // CJK characters collapse to `?` so the printer doesn't emit
    // garbage bytes that would misread on the default code page.
    expect(sanitize('你好')).toBe('??')
  })
})

describe('money', () => {
  it('formats integers with two decimals', () => {
    expect(money(0)).toBe('$0.00')
    expect(money(5)).toBe('$5.00')
  })

  it('inserts thousands separators', () => {
    expect(money(1234.5)).toBe('$1,234.50')
    expect(money(1234567.89)).toBe('$1,234,567.89')
  })

  it('handles negative amounts with a leading minus', () => {
    // Not exercised today (refunds are a future flow) but the printer
    // needs something that doesn't crash when we get there.
    expect(money(-50)).toBe('$-50.00')
  })
})

describe('trunc', () => {
  it('leaves shorter strings untouched', () => {
    expect(trunc('abc', 10)).toBe('abc')
  })

  it('cuts at the limit', () => {
    expect(trunc('abcdefghij', 5)).toBe('abcde')
  })
})

describe('concat', () => {
  it('joins Uint8Arrays end-to-end', () => {
    const a = Uint8Array.from([1, 2, 3])
    const b = Uint8Array.from([4, 5])
    const out = concat(a, b)
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5])
  })

  it('handles empty inputs', () => {
    const a = new Uint8Array(0)
    const b = Uint8Array.from([9])
    expect(Array.from(concat(a, b))).toEqual([9])
  })
})
