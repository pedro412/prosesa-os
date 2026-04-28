// LIT-108: pure margin math shared by the catalog form (Danna's
// pricing view) and — indirectly — the POS under-cost hint.
//
// "Margin" here is the classic retail gross margin: (price − cost) /
// price. We return percent as a signed number so a price below cost
// is negative, which the UI can style destructively.
//
// `cost === null || cost <= 0` → 'unknown'. We treat 0 the same as
// null because the migration's default is 0 and the ticket explicitly
// lets Danna backfill over time. Showing "Margen: 100%" for every
// unpopulated item would be misleading.
//
// `price <= 0` → 'unknown' too. Dividing by zero is undefined, and
// a free item isn't a margin discussion.

export type MarginTone = 'healthy' | 'thin' | 'negative' | 'unknown'

export interface Margin {
  // Signed percentage as an integer (floor toward -inf, matching how
  // the UI rounds for display). null when the inputs don't support a
  // meaningful margin.
  pct: number | null
  tone: MarginTone
}

const THIN_MARGIN_THRESHOLD = 20

export function computeMargin(price: number, cost: number | null | undefined): Margin {
  if (cost == null || cost <= 0) return { pct: null, tone: 'unknown' }
  if (!Number.isFinite(price) || price <= 0) return { pct: null, tone: 'unknown' }

  // Math is done in float; the catalog stores numeric(12,2) but margin
  // is always a display concern, never summed into a money total.
  const pctFloat = ((price - cost) / price) * 100
  const pct = Math.floor(pctFloat)

  if (pct < 0) return { pct, tone: 'negative' }
  if (pct < THIN_MARGIN_THRESHOLD) return { pct, tone: 'thin' }
  return { pct, tone: 'healthy' }
}
