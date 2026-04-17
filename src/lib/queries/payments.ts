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
