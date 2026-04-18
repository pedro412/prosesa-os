// Sales-note thermal ticket assembly. Consumes primitives from
// `escpos.ts` + pre-rendered raster bytes from `logo.ts` and produces
// the final Uint8Array the WebUSB driver ships to the printer.
//
// All widths are derived from `config.charWidth` (32 for 58mm paper,
// 42 for 80mm) so the same builder works on either roll. Column math
// mirrors motoisla-platform's `buildSaleTicketBytes`:
//   name column = charWidth - 22
//   qty (3) + " P.U. " (8) + " TOTAL " (8) = 22
//
// The builder is pure — no Supabase, no fetch. The caller preloads the
// logo bytes (via `fetchAndDitherLogo`) and passes them in so this
// stays fully synchronous and unit-testable.

import { formatIvaRate } from '@/lib/tax'

import { CARD_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/payment-labels'
import type { CardType, PaymentMethod } from '@/lib/queries/payments'

import { C, centerStr, concat, FEED_BEFORE_CUT, hr, money, row, trunc } from './escpos'

export interface TicketBuildInput {
  note: {
    folio: string
    created_at: string
    subtotal: number
    iva: number
    total: number
    // 0..1 fraction (e.g. 0.16 for 16%). Kept as a snapshot on the
    // note so historical tickets reprint with the rate at-time-of-sale.
    iva_rate_snapshot: number
  }
  lines: Array<{
    concept: string
    quantity: number
    unit: string
    unit_price: number
    line_total: number
  }>
  payments: Array<{
    method: PaymentMethod
    card_type: CardType | null
    amount: number
  }>
  company: {
    razon_social: string
    nombre_comercial: string
    rfc: string
    regimen_fiscal: string | null
    direccion_fiscal: string | null
    cp_fiscal: string | null
  }
  // null → "Público en general" per the POS customer-select default.
  customer: { nombre: string } | null
  // Pre-rendered ESC/POS raster bytes from `fetchAndDitherLogo`. Empty
  // or null falls through to the text-only header.
  logoBytes: Uint8Array | null
  config: TicketConfig
}

export interface TicketConfig {
  charWidth: 32 | 42
  thankYouLine?: string
}

const DEFAULT_THANK_YOU = '¡Gracias por su compra!'

// Fecha format for the ticket body. Mexican convention: dd/mm/yyyy
// hh:mm in 24h. Timezone is explicit so the snapshot prints the same
// way regardless of the workstation locale.
const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

function formatTicketDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

function paymentRowLabel(p: { method: PaymentMethod; card_type: CardType | null }): string {
  const base = PAYMENT_METHOD_LABELS[p.method]
  if (p.method === 'tarjeta' && p.card_type) {
    return `${base} (${CARD_TYPE_LABELS[p.card_type]})`
  }
  return base
}

export function buildSalesNoteTicketBytes(input: TicketBuildInput): Uint8Array {
  const { note, lines, payments, company, customer, logoBytes, config } = input
  const { charWidth } = config
  const thankYou = config.thankYouLine?.trim() || DEFAULT_THANK_YOU
  const nameLen = Math.max(8, charWidth - 22)
  const ratePct = formatIvaRate(note.iva_rate_snapshot)
  const fecha = formatTicketDate(note.created_at)
  const clienteLine = customer?.nombre.trim() || 'Público en general'

  const parts: Uint8Array[] = [C.INIT]

  // ─── Header (logo or text) ──────────────────────────────────────
  if (logoBytes && logoBytes.length > 0) {
    parts.push(logoBytes)
  }

  // Razón social always prints as the document-of-record name, even
  // when the logo is present — the ticket is a fiscal artifact and
  // needs the legal entity spelled out.
  parts.push(C.ALIGN_C, C.BOLD_ON, C.DBL_ON)
  parts.push(row(trunc(company.razon_social, Math.floor(charWidth / 2))))
  parts.push(C.DBL_OFF, C.BOLD_OFF)

  if (company.nombre_comercial && company.nombre_comercial !== company.razon_social) {
    parts.push(row(centerStr(company.nombre_comercial, charWidth)))
  }
  parts.push(row(centerStr(`RFC: ${company.rfc}`, charWidth)))
  if (company.regimen_fiscal) {
    parts.push(row(centerStr(`Régimen: ${company.regimen_fiscal}`, charWidth)))
  }
  if (company.direccion_fiscal) {
    parts.push(row(centerStr(company.direccion_fiscal, charWidth)))
  }
  if (company.cp_fiscal) {
    parts.push(row(centerStr(`CP ${company.cp_fiscal}`, charWidth)))
  }
  parts.push(C.ALIGN_L)

  // ─── Note metadata ──────────────────────────────────────────────
  parts.push(hr(charWidth))
  parts.push(row(`Folio:   ${trunc(note.folio, charWidth - 9)}`))
  parts.push(row(`Fecha:   ${fecha}`))
  parts.push(row(`Cliente: ${trunc(clienteLine, charWidth - 9)}`))

  // ─── Line items ─────────────────────────────────────────────────
  parts.push(hr(charWidth))
  parts.push(row(`${'ARTICULO'.padEnd(nameLen)} CAN    P.U.   TOTAL`))
  parts.push(hr(charWidth, '-'))
  for (const line of lines) {
    const name = trunc(line.concept, nameLen).padEnd(nameLen)
    // Quantity may be fractional (m², metros). One decimal when needed
    // keeps the 3-char column from overflowing for typical values.
    const qtyStr = Number.isInteger(line.quantity)
      ? String(line.quantity)
      : line.quantity.toFixed(1)
    const qty = qtyStr.padStart(3).slice(-3)
    const pu = money(line.unit_price).padStart(8)
    const lt = money(line.line_total).padStart(8)
    parts.push(row(`${name} ${qty} ${pu} ${lt}`))
  }

  // ─── Totals ─────────────────────────────────────────────────────
  parts.push(hr(charWidth, '-'))
  parts.push(row(padRight(`Subtotal:`, money(note.subtotal), charWidth)))
  parts.push(row(padRight(`IVA (${ratePct}%):`, money(note.iva), charWidth)))
  parts.push(C.BOLD_ON)
  parts.push(row(padRight(`TOTAL:`, money(note.total), charWidth)))
  parts.push(C.BOLD_OFF)

  // ─── Payments ───────────────────────────────────────────────────
  parts.push(hr(charWidth))
  for (const p of payments) {
    const label = paymentRowLabel(p)
    const amountStr = money(p.amount)
    // Amount column is fixed at 10 chars so multi-row mixto splits
    // line up cleanly. Label gets what's left.
    const labelWidth = Math.max(1, charWidth - amountStr.length)
    parts.push(
      row(label.padEnd(labelWidth).slice(0, labelWidth) + amountStr.padStart(amountStr.length))
    )
  }

  // ─── Footer ─────────────────────────────────────────────────────
  parts.push(hr(charWidth))
  parts.push(C.ALIGN_C)
  parts.push(row(thankYou))
  parts.push(C.ALIGN_L)
  parts.push(FEED_BEFORE_CUT)
  parts.push(C.CUT)

  return concat(...parts)
}

// Left-label / right-value row, padded to `width`. Truncates the label
// if it's so long the value would get pushed off the paper.
function padRight(label: string, value: string, width: number): string {
  const space = Math.max(1, width - label.length - value.length)
  if (space < 1) {
    // Fallback: truncate label so the value still fits.
    const maxLabelLen = Math.max(0, width - value.length - 1)
    return `${label.slice(0, maxLabelLen)} ${value}`
  }
  return `${label}${' '.repeat(space)}${value}`
}

// Canned sample ticket for the /settings/printer test-print button.
// Stays in sync with the live builder so quirks spot themselves in
// testing, rather than hiding behind a divergent layout.
export function buildTestTicketBytes(params: {
  company: TicketBuildInput['company']
  config: TicketConfig
  logoBytes: Uint8Array | null
}): Uint8Array {
  return buildSalesNoteTicketBytes({
    note: {
      folio: 'PRUEBA-0000',
      created_at: new Date().toISOString(),
      subtotal: 258.62,
      iva: 41.38,
      total: 300,
      iva_rate_snapshot: 0.16,
    },
    lines: [
      {
        concept: 'Impresión de prueba',
        quantity: 1,
        unit: 'pieza',
        unit_price: 150,
        line_total: 150,
      },
      {
        concept: 'Lona ejemplo 1x1m',
        quantity: 1,
        unit: 'm2',
        unit_price: 150,
        line_total: 150,
      },
    ],
    payments: [{ method: 'efectivo', card_type: null, amount: 300 }],
    company: params.company,
    customer: null,
    logoBytes: params.logoBytes,
    config: params.config,
  })
}
