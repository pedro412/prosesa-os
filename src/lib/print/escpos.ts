// ESC/POS byte primitives. Ported from motoisla-platform (where this
// has shipped reliably against a range of cheap 80mm USB thermal
// printers — Epson, Star, Bixolon, POS80, etc.).
//
// Keep this file domain-free: only the constants + low-level helpers
// live here. Sales-note ticket assembly is in `build-ticket.ts`.
//
// Diacritics and other non-ASCII characters are stripped (ñ→n, á→a,
// ¡→!) because the factory default code page on most thermal printers
// is PC437, not UTF-8. For proper Unicode we'd need to select a code
// page via `ESC t n` and map every character — well past MVP scope.

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

// Control sequences. Pre-built so the ticket builder can concatenate
// them without allocating new Uint8Arrays per row.
export const C = {
  INIT: Uint8Array.from([ESC, 0x40]), // Reset printer state
  ALIGN_L: Uint8Array.from([ESC, 0x61, 0x00]),
  ALIGN_C: Uint8Array.from([ESC, 0x61, 0x01]),
  ALIGN_R: Uint8Array.from([ESC, 0x61, 0x02]),
  BOLD_ON: Uint8Array.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Uint8Array.from([ESC, 0x45, 0x00]),
  DBL_ON: Uint8Array.from([GS, 0x21, 0x11]), // double-width + double-height
  DBL_OFF: Uint8Array.from([GS, 0x21, 0x00]),
  // GS V 66 n  → feed n lines + partial cut. n=3 leaves a comfortable
  // gap for the tear-off without advancing too much paper. We also
  // prepend FEED_BEFORE_CUT so the last line isn't flush with the cut.
  CUT: Uint8Array.from([GS, 0x56, 0x42, 0x03]),
} as const

// Extra blank lines before the cut command — without these the final
// line of text sometimes prints too close to the cut and gets nicked.
export const FEED_BEFORE_CUT = Uint8Array.from([LF, LF, LF, LF])

// Strip diacritics + non-printable ASCII so the default code page
// prints clean output. Stray bytes become `?` rather than mojibake.
export function sanitize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritics (é→e)
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/¡/g, '!')
    .replace(/¿/g, '?')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7e]/g, '?')
}

const encoder = new TextEncoder()

export function enc(s: string): Uint8Array {
  return encoder.encode(sanitize(s))
}

// Concatenate many Uint8Arrays without intermediate allocations. Hot
// path — a ticket has 30-60 parts. `Buffer.concat` isn't a thing in
// browsers so this is the cheap equivalent.
export function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// Append LF so the printer advances to the next line.
export function row(s: string): Uint8Array {
  return concat(enc(s), Uint8Array.from([LF]))
}

// Horizontal rule spanning the paper width. `=` for major separators,
// `-` for minor. Caller picks the char + width.
export function hr(width: number, ch = '='): Uint8Array {
  return row(ch.repeat(width))
}

// Center a string within `width` columns. Truncates if too long.
export function centerStr(s: string, width: number): string {
  const safe = sanitize(s)
  const text = safe.length > width ? safe.slice(0, width) : safe
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

// MXN currency: "$1,234.56". The printer is monospace so a dedicated
// formatter (not `Intl.NumberFormat`) keeps column alignment exact —
// Intl inserts locale-dependent whitespace that drifts across Node
// versions and would shift line totals by a column.
export function money(v: number): string {
  const [int, dec] = v.toFixed(2).split('.')
  return '$' + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec
}

export function trunc(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) : s
}
