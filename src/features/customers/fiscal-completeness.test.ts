import { describe, expect, it } from 'vitest'

import type { Customer } from '@/lib/queries/customers'

import { customerFiscalStatus } from './fiscal-completeness'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  const base = {
    id: 'cu-1',
    nombre: 'Cliente de Prueba',
    razon_social: 'Cliente de Prueba S.A. de C.V.',
    rfc: 'XEXX010101000',
    regimen_fiscal: '601',
    cp_fiscal: '24140',
    direccion_fiscal: 'Calle Falsa 123, Col. Centro, Ciudad del Carmen',
    uso_cfdi: 'G03',
    telefono: '9381234567',
    email: null,
    notas: null,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
    deleted_at: null,
    created_by: null,
    updated_by: null,
    ...overrides,
  }
  return base as unknown as Customer
}

describe('customerFiscalStatus', () => {
  it('returns no-customer for null / undefined', () => {
    expect(customerFiscalStatus(null)).toEqual({ status: 'no-customer', missing: [] })
    expect(customerFiscalStatus(undefined)).toEqual({ status: 'no-customer', missing: [] })
  })

  it('returns complete when all six fiscal fields are populated', () => {
    const result = customerFiscalStatus(makeCustomer())
    expect(result.status).toBe('complete')
    expect(result.missing).toEqual([])
  })

  it('flags a single missing field', () => {
    const result = customerFiscalStatus(makeCustomer({ uso_cfdi: null }))
    expect(result.status).toBe('incomplete')
    expect(result.missing).toEqual(['uso_cfdi'])
  })

  it('flags multiple missing fields in declaration order', () => {
    const result = customerFiscalStatus(
      makeCustomer({ razon_social: null, direccion_fiscal: null, uso_cfdi: null })
    )
    expect(result.status).toBe('incomplete')
    expect(result.missing).toEqual(['razon_social', 'direccion_fiscal', 'uso_cfdi'])
  })

  it('treats whitespace-only strings as missing', () => {
    const result = customerFiscalStatus(
      makeCustomer({ direccion_fiscal: '   \n ', razon_social: '' })
    )
    expect(result.status).toBe('incomplete')
    expect(result.missing).toContain('direccion_fiscal')
    expect(result.missing).toContain('razon_social')
  })

  it('flags all six when a walk-in has only nombre + telefono', () => {
    const result = customerFiscalStatus(
      makeCustomer({
        razon_social: null,
        rfc: null,
        regimen_fiscal: null,
        cp_fiscal: null,
        direccion_fiscal: null,
        uso_cfdi: null,
      })
    )
    expect(result.status).toBe('incomplete')
    expect(result.missing).toEqual([
      'rfc',
      'razon_social',
      'regimen_fiscal',
      'cp_fiscal',
      'direccion_fiscal',
      'uso_cfdi',
    ])
  })

  it('does not count email / notas as fiscal fields', () => {
    // Non-fiscal fields (email, notas) don't affect billability. Nombre
    // and telefono are required DB-side (LIT-80) so they can't be null;
    // they also aren't in REQUIRED_FIELDS.
    const result = customerFiscalStatus(makeCustomer({ email: null, notas: null }))
    expect(result.status).toBe('complete')
  })
})
