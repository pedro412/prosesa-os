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
