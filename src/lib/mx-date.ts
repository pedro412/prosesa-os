// Date helpers scoped to America/Mexico_City. Prosesa's shop is in
// Ciudad del Carmen, Campeche, which does not observe DST and (since
// the 2022 federal reform) neither does the rest of the country
// outside a handful of border municipalities. So the zone is a flat
// UTC-6 year-round — we hard-code it rather than pull a tz library.
//
// `timestamptz` values live in UTC on the server (CLAUDE.md §4 rule
// 10). When the UI asks for "today's sales", it means "today on the
// operator's wall clock", so we translate to the UTC instants
// corresponding to 00:00 and 24:00 Mexico time at query time.

const MX_UTC_OFFSET = '-06:00'

const MX_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Returns YYYY-MM-DD for the MX calendar day containing `date`.
export function mxDayString(date: Date): string {
  return MX_DAY_FORMATTER.format(date)
}

export function todayMX(): string {
  return mxDayString(new Date())
}

export function yesterdayMX(): string {
  // 24h ago in wall clock terms. Safe to subtract 24h worth of ms
  // since MX has no DST; this always lands on the previous
  // calendar day regardless of the hour.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return mxDayString(yesterday)
}

// Start of a MX calendar day as a UTC ISO string — e.g.
// '2026-04-18' → '2026-04-18T06:00:00.000Z' (MX is UTC-6).
export function mxDayStartUtc(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00${MX_UTC_OFFSET}`).toISOString()
}

// Start of the next MX calendar day, for use with a half-open (`.lt`)
// range filter. Using the next-midnight boundary is simpler than
// `23:59:59.999` and avoids edge cases with fractional-second
// timestamps landing just past the cutoff.
export function mxNextDayStartUtc(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00${MX_UTC_OFFSET}`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

// Whether a UTC ISO timestamp falls on today's MX calendar day.
// Used by list views to swap a full date for a "Hoy 14:32" label so
// same-day rows are easy to scan.
export function isTodayMX(iso: string): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return mxDayString(d) === todayMX()
}

export function isYesterdayMX(iso: string): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return mxDayString(d) === yesterdayMX()
}
