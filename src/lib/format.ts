// Shared formatting helpers. Single-currency project (CLAUDE.md §4
// rule 9 — MXN only); the formatter is constructed once at module
// scope and reused.

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

// Format a number as Mexican pesos. Non-finite input collapses to
// `$0.00` so a stray NaN from upstream doesn't render "NaN" in the
// UI — the DB would reject such a row anyway; the operator sees
// something numeric and obviously wrong instead.
export function formatMXN(n: number): string {
  if (!Number.isFinite(n)) return mxnFormatter.format(0)
  return mxnFormatter.format(n)
}

// Thousands-separator formatter used by MoneyInput. Same shape as
// formatMXN minus the currency symbol: "2,000.00", "45,000.00". Locked
// to en-US so the separator + decimal characters (`,` and `.`) stay
// deterministic across node/browser locales; Mexican formatting
// happens to use the same characters so nothing changes for the
// operator.
const moneyInputFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoneyInput(n: number): string {
  if (!Number.isFinite(n)) return moneyInputFormatter.format(0)
  return moneyInputFormatter.format(n)
}

// Parses a user-edited money string back to a number. Accepts any
// mix of digits, commas, and at most one decimal dot. Empty / invalid
// input collapses to 0 — matches the `parseNumber` convention used
// across the POS code so downstream math helpers don't see NaN.
export function parseMoneyInput(raw: string): number {
  if (typeof raw !== 'string') return 0
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}
