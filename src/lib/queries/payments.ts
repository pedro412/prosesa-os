import { useQuery } from '@tanstack/react-query'

import type { Database } from '@/types/database'

import { supabase } from '../supabase'

// ============================================================================
// Types
// ============================================================================

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type PaymentUpdate = Database['public']['Tables']['payments']['Update']

// Kept in sync with the CHECK constraint on payments.method. Narrowed
// to a literal union so the method picker and corte de caja breakdown
// can switch exhaustively without casting.
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta'

// Kept in sync with payments_card_type_check (LIT-33). Only populated
// when method='tarjeta'; null for efectivo / transferencia. Carried
// into corte de caja so bookkeeping can split crédito vs débito.
export type CardType = 'credito' | 'debito'

// Spanish labels live in `@/lib/payment-labels` so the thermal-ticket
// builder (pure, no Supabase dep) can import them without pulling in
// the env-validated Supabase client. Re-export here so POS code that
// already imports from `@/lib/queries/payments` keeps working.
export { CARD_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '../payment-labels'

// ============================================================================
// Query keys
// ============================================================================

export const paymentKeys = {
  all: ['payments'] as const,
  byNote: (salesNoteId: string) => [...paymentKeys.all, 'by-note', salesNoteId] as const,
}

// ============================================================================
// Readers
// ============================================================================

export async function listPaymentsByNote(salesNoteId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('sales_note_id', salesNoteId)
    .order('paid_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

// ============================================================================
// TanStack Query hooks
// ============================================================================

export function usePaymentsByNote(salesNoteId: string | undefined) {
  return useQuery({
    queryKey: salesNoteId ? paymentKeys.byNote(salesNoteId) : paymentKeys.all,
    queryFn: () => listPaymentsByNote(salesNoteId as string),
    enabled: !!salesNoteId,
    staleTime: 30_000,
  })
}
