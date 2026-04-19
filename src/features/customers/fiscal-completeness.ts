// Pure "is this customer ready to be invoiced" check. Shared across:
//
//   * POS fiscal warning banner (LIT-89) — when `requires_invoice` is
//     on and the attached customer isn't invoice-ready, the banner
//     nudges the operator with "Completar datos fiscales" and tells
//     them which specific fields are missing.
//   * Dana's invoice-tracking workbench (LIT-90) — the
//     "Marcar como facturada" button is disabled unless the customer
//     hits `complete`.
//
// The rule set matches the SAT CFDI 4.0 minimum data a Contpaqi
// operator needs to issue an invoice: RFC + razón social + régimen
// fiscal + CP fiscal + dirección fiscal + uso CFDI. `nombre` and
// `telefono` are not fiscal fields — they're always present and
// don't affect billability.
//
// Completeness is deliberately a *read-time* concern: the DB allows
// partial customers (walk-in with phone only) and the form doesn't
// require these fields on save. That way a clerk can still capture a
// customer mid-conversation and the data gets filled in later.

import type { Customer } from '@/lib/queries/customers'

export type CustomerFiscalStatus = 'no-customer' | 'complete' | 'incomplete'

export type FiscalField =
  | 'rfc'
  | 'razon_social'
  | 'regimen_fiscal'
  | 'cp_fiscal'
  | 'direccion_fiscal'
  | 'uso_cfdi'

export interface FiscalCompleteness {
  status: CustomerFiscalStatus
  missing: readonly FiscalField[]
}

const REQUIRED_FIELDS: readonly FiscalField[] = [
  'rfc',
  'razon_social',
  'regimen_fiscal',
  'cp_fiscal',
  'direccion_fiscal',
  'uso_cfdi',
]

export function customerFiscalStatus(customer: Customer | null | undefined): FiscalCompleteness {
  if (!customer) return { status: 'no-customer', missing: [] }
  const missing = REQUIRED_FIELDS.filter((field) => !hasValue(customer[field]))
  return missing.length === 0
    ? { status: 'complete', missing: [] }
    : { status: 'incomplete', missing }
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}
