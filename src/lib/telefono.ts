// Shared MX phone-number input handling. One source of truth so every
// form that captures a teléfono agrees on shape + validation — avoids
// drift between customers, vendors, and any future surface that needs
// the same rule.

// Strip any non-digit and clip to 10. Handles typed digits and the
// "55 (938) 123-4567" paste case in a single code path. Consumers
// wire this to the <Input>'s onChange so state can only hold digits.
export function sanitizeTelefono(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

// MX phone numbers: exactly 10 digits. The sanitizer above guarantees
// only digits reach this, so the regex really enforces length. Export
// as a constant so zod schemas + manual checks share the same source.
export const TELEFONO_REGEX = /^\d{10}$/

// Convenience predicate for surfaces that want a boolean rather than
// a regex hit — keeps callers from importing the regex directly.
export function isValidTelefono(value: string): boolean {
  return TELEFONO_REGEX.test(value)
}
