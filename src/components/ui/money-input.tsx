import * as React from 'react'

import { formatMoneyInput, parseMoneyInput } from '@/lib/format'

import { Input } from './input'

type InheritedInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'inputMode'
>

export interface MoneyInputProps extends InheritedInputProps {
  // Numeric value in MXN. Parent owns the state; MoneyInput handles
  // display formatting. Zero renders as "0.00" — callers wanting an
  // empty-when-zero display should gate the rendered value themselves.
  value: number
  onChange: (value: number) => void
}

// Shared money input. Live-formats with thousands separators as the
// operator types ("2,000.00", "45,000.00") and enforces a 2-decimal
// display on blur. Cursor position is preserved across the commas
// the formatter inserts so typing inside a value doesn't feel jumpy.
//
// Why not <input type="number">: browsers strip non-numeric chars, so
// the formatted comma would never land. We use `type="text"` with
// `inputMode="decimal"` to keep the mobile numeric keyboard.
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, onFocus, onBlur, ...rest },
  forwardedRef
) {
  // `draft` holds the display string while the input is focused. On
  // blur we drop back to null so the formatted `value` prop drives
  // the display — this way a programmatic value change (e.g. the
  // PaymentDialog re-seeding the amount) refreshes the field without
  // fighting the user's edits.
  const [draft, setDraft] = React.useState<string | null>(null)
  const localRef = React.useRef<HTMLInputElement>(null)
  const setRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  const display = draft ?? formatMoneyInput(value)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const cursor = event.target.selectionStart ?? raw.length

    // Strip anything that isn't a digit or a decimal point. The user
    // might also type a comma themselves; we reinsert commas from
    // scratch so the output is canonical.
    const cleaned = raw.replace(/[^\d.]/g, '')
    const firstDot = cleaned.indexOf('.')
    let intPart = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot)
    const decPart =
      firstDot === -1
        ? ''
        : cleaned
            .slice(firstDot + 1)
            .replace(/\./g, '')
            .slice(0, 2)
    // Collapse leading zeros so typing "007" renders as "7". Allow a
    // lone "0" when there is nothing else (e.g. "0.5" being typed).
    if (intPart.length > 1) intPart = intPart.replace(/^0+/, '') || '0'

    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const formatted = firstDot === -1 ? withCommas : `${withCommas}.${decPart}`

    setDraft(formatted)
    onChange(parseMoneyInput(formatted))

    // Preserve cursor by counting digits + decimal dots up to the
    // user's caret in the pre-format value, then finding the same
    // logical offset in the reformatted output. Comma insertions
    // shift the character position by 1 for every 3 digits they
    // straddle; this loop is tolerant of both insertions and deletions.
    const el = localRef.current
    if (el) {
      const digitsBeforeCursor = raw.slice(0, cursor).replace(/[^\d.]/g, '').length
      requestAnimationFrame(() => {
        if (!localRef.current) return
        let pos = 0
        let count = 0
        for (; pos < formatted.length; pos++) {
          if (/[\d.]/.test(formatted[pos])) {
            count++
            if (count === digitsBeforeCursor) {
              pos += 1
              break
            }
          }
        }
        if (count < digitsBeforeCursor) pos = formatted.length
        localRef.current.setSelectionRange(pos, pos)
      })
    }
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    // Seed the draft with whatever the input is currently showing so
    // edits pick up from the formatted string without briefly
    // collapsing the separators.
    setDraft(formatMoneyInput(value))
    // Select-all on focus so the operator can overwrite a prefilled
    // amount (POS total, pre-seeded "0.00") with a single keystroke
    // instead of manually clearing it first. Matches the expected
    // behavior of counter-register software.
    event.target.select()
    onFocus?.(event)
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const parsed = parseMoneyInput(draft ?? '')
    onChange(parsed)
    setDraft(null)
    onBlur?.(event)
  }

  return (
    <Input
      {...rest}
      ref={setRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )
})
