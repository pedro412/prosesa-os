// IVA (Mexican value-added tax) math for LIT-32 / M3-5.
//
// The POS form, the detail/history views, and the thermal ticket all
// need to show Subtotal, IVA (rate%), and Total on separate lines,
// computed from a set of line items and a company's IVA configuration.
// The rules (per CLAUDE.md §8 and the LIT-32 AC) are:
//
//   * IVA is tax-inclusive by default (`company.iva_inclusive = true`):
//     the per-line unit price already contains IVA. We back-calculate
//     `subtotal = total / (1 + rate)` and `iva = total - subtotal`.
//   * IVA is tax-exclusive when `company.iva_inclusive = false`: the
//     unit price is pre-tax. `subtotal = sum(line_total)`,
//     `iva = subtotal * rate`, `total = subtotal + iva`.
//   * The IVA rate is stored as a 0..1 fraction on `companies.iva_rate`
//     (0.16 for the Mexican default). The UI renders it as a percentage
//     for display.
//   * Rounding: every currency-denominated value is rounded to 2
//     decimals using half-away-from-zero — the same direction Postgres
//     `round(numeric, int)` uses, so app-side math stays in lock-step
//     with the DB-side assertion trigger on `sales_note_lines` and the
//     NUMERIC(12,2) storage on totals. Half-to-even would diverge from
//     Postgres's default for numeric and produce false assertion
//     failures.
//
// All helpers are pure. Keeping them free of React / Supabase coupling
// is what lets them be unit-testable (LIT-32 AC) and reusable across
// the POS form (LIT-31), thermal ticket (LIT-34), and history view
// (LIT-35).

export type LineDiscountType = 'none' | 'percent' | 'fixed'

export interface LineInput {
  quantity: number
  unitPrice: number
  discountType: LineDiscountType
  discountValue: number
}

export interface ComputedLine {
  gross: number
  discount: number
  lineTotal: number
}

export interface TotalsInput {
  lines: Array<Pick<LineInput, 'quantity' | 'unitPrice' | 'discountType' | 'discountValue'>>
  ivaRate: number
  ivaInclusive: boolean
}

export interface Totals {
  subtotal: number
  iva: number
  total: number
}

// Round a money value to 2 decimal places using half-away-from-zero.
//
// Matches Postgres `round(numeric, 2)` so the app-computed line_total
// written into `sales_note_lines.line_total` matches what the BEFORE
// trigger recomputes at the DB (`20260418120100_sales_note_lines.sql`),
// keeping us clear of the ±0.01 tolerance window the trigger uses as a
// safety net.
//
// Implementation note: the binary-float representation of `1.005` is
// actually `1.00499999999999989...`, so `1.005 * 100 === 100.4999…9`
// and a naive `Math.round(… * 100)` would yield `1.00` instead of the
// `1.01` Postgres (and every human) expects. `Number.EPSILON` is too
// small to close the gap once multiplied up to magnitude 100, so we
// normalize the scaled value with `toFixed(10)` before rounding —
// that collapses the trailing binary noise without introducing a
// magic magnitude-dependent epsilon.
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n === 0) return 0
  const sign = n < 0 ? -1 : 1
  const scaled = Number((Math.abs(n) * 100).toFixed(10))
  return (sign * Math.round(scaled)) / 100
}

// Compute the gross, discount, and final line_total for a single row.
// Mirrors the Postgres expression in
// `public.sales_note_lines_assert_line_total` so what the app writes
// matches what the DB recomputes on INSERT/UPDATE.
//
// Invariants:
//   * gross        = round2(quantity * unitPrice)
//   * discount     = round2(gross * value/100)   if percent
//                   = round2(discountValue)      if fixed
//                   = 0                          if none
//   * lineTotal    = max(round2(gross - discount), 0)
//
// The `max(..., 0)` clamp lets a fixed-amount discount larger than
// gross resolve to zero instead of a negative line_total — the DB CHECK
// constraint `line_total >= 0` enforces the same floor.
export function computeLine(input: LineInput): ComputedLine {
  const gross = roundMoney(input.quantity * input.unitPrice)

  let discount = 0
  if (input.discountType === 'percent') {
    discount = roundMoney(gross * (input.discountValue / 100))
  } else if (input.discountType === 'fixed') {
    discount = roundMoney(input.discountValue)
  }

  const lineTotal = Math.max(roundMoney(gross - discount), 0)
  return { gross, discount, lineTotal }
}

// Convenience wrapper for the common case: callers that only want the
// final line_total to write into the DB.
export function computeLineTotal(input: LineInput): number {
  return computeLine(input).lineTotal
}

// Compute Subtotal / IVA / Total for a whole note from its lines plus
// the active company's IVA configuration.
//
// The `total` is always `lineSum` — that's the amount the customer
// pays. What shifts between inclusive and exclusive mode is how
// subtotal and iva are derived from it:
//
//   * Inclusive: line_totals already contain IVA.
//     total    = sum(line_totals)
//     subtotal = round2(total / (1 + rate))
//     iva      = round2(total - subtotal)       // preserves subtotal + iva === total
//
//   * Exclusive: line_totals are pre-tax.
//     subtotal = sum(line_totals)
//     iva      = round2(subtotal * rate)
//     total    = round2(subtotal + iva)
//
// In both modes the final `subtotal + iva === total` identity holds
// exactly after rounding, which is what the printed ticket needs. We
// compute `iva` as `total - subtotal` in inclusive mode (rather than
// `subtotal * rate`) specifically to keep that identity — deriving it
// from the rate can drop a cent on awkward totals.
export function computeTotals({ lines, ivaRate, ivaInclusive }: TotalsInput): Totals {
  const lineSum = roundMoney(
    lines.reduce(
      (acc, line) =>
        acc +
        computeLineTotal({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountType: line.discountType,
          discountValue: line.discountValue,
        }),
      0
    )
  )

  if (ivaInclusive) {
    const subtotal = roundMoney(lineSum / (1 + ivaRate))
    const iva = roundMoney(lineSum - subtotal)
    return { subtotal, iva, total: lineSum }
  }

  const subtotal = lineSum
  const iva = roundMoney(subtotal * ivaRate)
  const total = roundMoney(subtotal + iva)
  return { subtotal, iva, total }
}

// Format a 0..1 IVA rate as a human-readable percentage string for the
// totals panel. Avoids rendering "16.00 %" when 16 % is enough; the
// company form already rounds to 4 decimals so this handles the common
// shapes without a locale library.
//
// Examples: 0.16 → "16", 0.08 → "8", 0.085 → "8.5", 0 → "0".
export function formatIvaRate(rate: number): string {
  const pct = rate * 100
  // Drop trailing zeros but keep meaningful decimals (8.5 → "8.5").
  return Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(4)))
}
