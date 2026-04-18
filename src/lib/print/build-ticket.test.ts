import { describe, expect, it } from 'vitest'

import { buildSalesNoteTicketBytes, buildTestTicketBytes } from './build-ticket'

const COMPANY = {
  razon_social: 'PROSESA DISEÑO Y PUBLICIDAD SA DE CV',
  nombre_comercial: 'Prosesa',
  rfc: 'PDP010203ABC',
  regimen_fiscal: '601 — General de Ley Personas Morales',
  direccion_fiscal: 'Calle Principal 123, Ciudad del Carmen',
  cp_fiscal: '24100',
}

function render(bytes: Uint8Array): string {
  // Plain UTF-8 decode of the payload — control bytes become garbage
  // characters but we only assert on the visible text content. That's
  // the contract that matters; byte-for-byte snapshots break any time
  // a spacing decision changes.
  return new TextDecoder().decode(bytes)
}

describe('buildSalesNoteTicketBytes', () => {
  const base = {
    note: {
      folio: 'A-00042',
      created_at: '2026-04-18T12:00:00Z',
      subtotal: 86.21,
      iva: 13.79,
      total: 100,
      iva_rate_snapshot: 0.16,
    },
    lines: [
      {
        concept: 'Impresión de prueba',
        quantity: 1,
        unit: 'pieza',
        unit_price: 100,
        line_total: 100,
      },
    ],
    payments: [{ method: 'efectivo' as const, card_type: null, amount: 100 }],
    company: COMPANY,
    customer: null,
    logoBytes: null,
    config: { charWidth: 42 as const },
  }

  it('includes the folio, total, and thank-you message', () => {
    const text = render(buildSalesNoteTicketBytes(base))
    expect(text).toContain('A-00042')
    expect(text).toContain('$100.00')
    expect(text).toContain('!Gracias por su compra!') // diacritics stripped
  })

  it('renders razón social with diacritics stripped', () => {
    const text = render(buildSalesNoteTicketBytes(base))
    expect(text).toContain('PROSESA DISENO')
    expect(text).toContain('PDP010203ABC')
  })

  it('falls back to "Público en general" when no customer is attached', () => {
    const text = render(buildSalesNoteTicketBytes(base))
    expect(text).toContain('Publico en general')
  })

  it('uses the attached customer name when present', () => {
    const text = render(
      buildSalesNoteTicketBytes({
        ...base,
        customer: { nombre: 'Juan Pérez' },
      })
    )
    expect(text).toContain('Juan Perez')
  })

  it('labels a tarjeta payment with its card type', () => {
    const text = render(
      buildSalesNoteTicketBytes({
        ...base,
        payments: [{ method: 'tarjeta', card_type: 'credito', amount: 100 }],
      })
    )
    expect(text).toContain('Tarjeta (Credito)')
  })

  it('skips the card-type suffix for efectivo and transferencia', () => {
    const text = render(
      buildSalesNoteTicketBytes({
        ...base,
        payments: [{ method: 'transferencia', card_type: null, amount: 100 }],
      })
    )
    expect(text).toContain('Transferencia')
    expect(text).not.toContain('(Credito)')
    expect(text).not.toContain('(Debito)')
  })

  it('renders subtotal and IVA rows with the snapshot rate', () => {
    const text = render(buildSalesNoteTicketBytes(base))
    expect(text).toContain('Subtotal:')
    expect(text).toContain('IVA (16%):')
    expect(text).toContain('$86.21')
    expect(text).toContain('$13.79')
  })

  it('truncates long concepts to the name column width', () => {
    const longConcept = 'Super duper mega concepto larguísimo que no va a caber nunca'
    const text = render(
      buildSalesNoteTicketBytes({
        ...base,
        lines: [{ ...base.lines[0], concept: longConcept }],
      })
    )
    // charWidth 42 → nameLen 20 → first 20 chars of sanitized concept
    expect(text).toContain('Super duper mega con')
    expect(text).not.toContain('larguisimo')
  })

  it('respects charWidth=32 for a 58mm roll', () => {
    const text = render(
      buildSalesNoteTicketBytes({
        ...base,
        config: { charWidth: 32 },
      })
    )
    // Thirty-two-wide separator row.
    expect(text).toContain('='.repeat(32))
    expect(text).not.toContain('='.repeat(42))
  })
})

describe('buildTestTicketBytes', () => {
  it('produces a ticket with the sample folio and totals', () => {
    const text = render(
      buildTestTicketBytes({
        company: COMPANY,
        config: { charWidth: 42 },
        logoBytes: null,
      })
    )
    expect(text).toContain('PRUEBA-0000')
    expect(text).toContain('$300.00')
  })
})
