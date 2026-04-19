import { useCallback } from 'react'

import type { Company } from '@/lib/queries/companies'
import type { Customer } from '@/lib/queries/customers'
import type { CardType, PaymentMethod } from '@/lib/queries/payments'
import type { SalesNoteWithDetails } from '@/lib/queries/sales-notes'
import { usePrinterStore } from '@/store/printer-store'

import { buildSalesNoteTicketBytes } from './build-ticket'
import { fetchAndDitherLogo } from './logo'
import { printViaUSB } from './usb-printer'

// Shared reprint path for sales-note tickets. Used by the POS auto-print
// effect (post-Cobrar) and the history-view "Imprimir ticket" action
// (LIT-35). Keeps the logo-preload + build + USB-send + printer-store
// status dance in one place so the two surfaces can't drift.
//
// The caller owns error presentation (a toast near the triggering
// button); this hook only updates the global printer-store status.

export interface ReprintTicketInput {
  note: SalesNoteWithDetails
  company: Company
  customer: Customer | null
}

export function useReprintTicket() {
  return useCallback(async ({ note, company, customer }: ReprintTicketInput) => {
    const store = usePrinterStore.getState()
    store.setStatus('printing', null)
    try {
      const logoBytes = company.logo_url ? await fetchAndDitherLogo(company.logo_url) : null
      const bytes = buildSalesNoteTicketBytes({
        note: {
          folio: note.folio,
          created_at: note.created_at,
          subtotal: Number(note.subtotal),
          iva: Number(note.iva),
          total: Number(note.total),
          iva_rate_snapshot: Number(note.iva_rate_snapshot),
        },
        lines: note.lines.map((line) => ({
          concept: line.concept,
          quantity: Number(line.quantity),
          unit: line.unit,
          unit_price: Number(line.unit_price),
          line_total: Number(line.line_total),
        })),
        payments: note.payments.map((payment) => ({
          method: payment.method as PaymentMethod,
          card_type: payment.card_type as CardType | null,
          amount: Number(payment.amount),
        })),
        company: {
          razon_social: company.razon_social,
          nombre_comercial: company.nombre_comercial,
          rfc: company.rfc,
          regimen_fiscal: company.regimen_fiscal,
          direccion_fiscal: company.direccion_fiscal,
          cp_fiscal: company.cp_fiscal,
        },
        customer: customer ? { nombre: customer.nombre } : null,
        logoBytes,
        config: { charWidth: store.charWidth },
      })
      await printViaUSB(bytes)
      store.setStatus('ok', null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      store.setStatus('error', message)
      throw err
    }
  }, [])
}
