// Shared Spanish (Mexico) labels for payment method + card type.
// Lives in a standalone file (not `src/lib/queries/payments.ts`) so the
// thermal-ticket builder can import them without pulling in the
// Supabase client — which would drag the env-validation side-effect
// into vitest's pure-function unit tests.
//
// The label maps are intentionally not a function of any runtime value;
// if they ever need to vary per-company, move them to a DB column.

import type { CardType, PaymentMethod } from './queries/payments'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  credito: 'Crédito',
  debito: 'Débito',
}
