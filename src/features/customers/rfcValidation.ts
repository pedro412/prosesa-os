// SAT RFC format:
//   Moral (legal entity): 3 letters + 6 digits + 3 alphanumerics = 12 chars
//   Physical person:      4 letters + 6 digits + 3 alphanumerics = 13 chars
// Uppercase-only; `Ñ` and `&` are allowed in the leading letters block.
//
// Validation is shape-only — we don't check that the 6-digit block is a
// valid YYMMDD date, and we don't verify the 3-char homoclave checksum.
// Those are both beyond what the UI should block on at data entry.

const RFC_PATTERN = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/

export function isValidRfc(value: string): boolean {
  return RFC_PATTERN.test(value)
}

// Normalizes a user-typed RFC: trims, uppercases, strips whitespace.
// Does NOT validate — pair with isValidRfc() when needed.
export function normalizeRfc(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}
