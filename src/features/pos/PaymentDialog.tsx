import { type FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMXN } from '@/lib/format'
import type { CardType, PaymentMethod } from '@/lib/queries/payments'
import type { CreateSalesNotePaymentInput } from '@/lib/queries/sales-notes'
import { roundMoney } from '@/lib/tax'
import { cn } from '@/lib/utils'

import { posMessages } from './messages'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Note total in MXN, already rounded. The dialog prefills the first
  // row with this amount and uses it as the sum threshold.
  total: number
  // Mirrors createMutation.isPending — disables the submit button + the
  // inputs so the operator can't double-submit.
  submitting: boolean
  onConfirm: (payments: CreateSalesNotePaymentInput[]) => void
}

interface PaymentRow {
  // Client-only id for stable React keys. Not persisted.
  id: string
  method: PaymentMethod
  cardType: CardType | null
  // Amount as a string while editing. Parsed at validate / submit.
  amount: string
}

type RowErrors = Partial<Record<'amount' | 'cardType', string>>

// Per-row zod schema. Enforces card_type invariant + positive amount so
// we don't send a payload the DB will reject.
const paymentRowSchema = z
  .object({
    method: z.enum(['efectivo', 'transferencia', 'tarjeta']),
    cardType: z.enum(['credito', 'debito']).nullable(),
    amount: z.number().positive(),
  })
  .refine((row) => (row.method === 'tarjeta' ? row.cardType !== null : row.cardType === null), {
    path: ['cardType'],
  })

function newRow(init: Partial<PaymentRow> = {}): PaymentRow {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return {
    id,
    method: 'efectivo',
    cardType: null,
    amount: '',
    ...init,
  }
}

// Dialog that captures one or more payment rows (mixto) and confirms
// the sale. Mirrors the FreeFormLineDialog shape: the inner form lives
// inside `{open && ...}` so it unmounts + resets on close without a
// useEffect.
export function PaymentDialog({
  open,
  onOpenChange,
  total,
  submitting,
  onConfirm,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{posMessages.payments.title}</DialogTitle>
          <DialogDescription>{posMessages.payments.description}</DialogDescription>
        </DialogHeader>
        {open && (
          <PaymentFormInner
            total={total}
            submitting={submitting}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentFormInner({
  total,
  submitting,
  onConfirm,
  onCancel,
}: {
  total: number
  submitting: boolean
  onConfirm: (payments: CreateSalesNotePaymentInput[]) => void
  onCancel: () => void
}) {
  // Seed one `efectivo` row prefilled to the total — the most common
  // counter case is "un pago en efectivo por el monto exacto".
  const [rows, setRows] = useState<PaymentRow[]>(() => [
    newRow({ amount: total > 0 ? total.toFixed(2) : '' }),
  ])
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({})
  const [cashTendered, setCashTendered] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const parsedRows = useMemo(
    () =>
      rows.map((row) => {
        const parsed = Number(row.amount)
        return {
          ...row,
          parsedAmount: Number.isFinite(parsed) ? parsed : Number.NaN,
        }
      }),
    [rows]
  )

  const sum = useMemo(
    () =>
      roundMoney(
        parsedRows.reduce(
          (acc, row) => acc + (Number.isFinite(row.parsedAmount) ? row.parsedAmount : 0),
          0
        )
      ),
    [parsedRows]
  )

  const remaining = roundMoney(total - sum)
  const covered = sum >= total && total > 0
  const rowsShapeValid = parsedRows.every(
    (row) =>
      Number.isFinite(row.parsedAmount) &&
      row.parsedAmount > 0 &&
      (row.method === 'tarjeta' ? row.cardType !== null : row.cardType === null)
  )
  const canSubmit = !submitting && covered && rowsShapeValid

  function updateRow(id: string, patch: Partial<PaymentRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        // Switching method away from tarjeta must clear card_type — the
        // DB CHECK would reject a leftover value and the user would
        // never see the dropdown again to clear it manually.
        if (patch.method !== undefined && next.method !== 'tarjeta') {
          next.cardType = null
        }
        return next
      })
    )
    // Clear the row's inline error the moment the operator touches it.
    setRowErrors((prev) => {
      if (!prev[id]) return prev
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    setSubmitError(null)
  }

  function addRow() {
    setRows((prev) => [...prev, newRow({ amount: remaining > 0 ? remaining.toFixed(2) : '' })])
    setSubmitError(null)
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
    setRowErrors((prev) => {
      if (!prev[id]) return prev
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    setSubmitError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const errors: Record<string, RowErrors> = {}
    const projected: CreateSalesNotePaymentInput[] = []

    for (const row of parsedRows) {
      const parsed = paymentRowSchema.safeParse({
        method: row.method,
        cardType: row.cardType,
        amount: row.parsedAmount,
      })
      if (!parsed.success) {
        const rowErr: RowErrors = {}
        for (const issue of parsed.error.issues) {
          const field = issue.path[0]
          if (field === 'amount') {
            rowErr.amount = posMessages.payments.errors.amountInvalid
          } else if (field === 'cardType') {
            rowErr.cardType = posMessages.payments.errors.cardTypeRequired
          }
        }
        errors[row.id] = rowErr
        continue
      }
      projected.push({
        method: parsed.data.method,
        card_type: parsed.data.cardType,
        amount: roundMoney(parsed.data.amount),
      })
    }

    if (Object.keys(errors).length > 0) {
      setRowErrors(errors)
      return
    }

    if (!covered) {
      setSubmitError(posMessages.payments.errors.totalNotCovered)
      return
    }

    onConfirm(projected)
  }

  // Cash-tendered helper: only surfaces when a single efectivo row is
  // present and covers the total. In a mixto split the operator already
  // typed the cash amount they're applying; change-making is outside
  // this dialog's responsibility in that case.
  const singleEfectivo = rows.length === 1 && rows[0].method === 'efectivo'
  const efectivoRow = singleEfectivo ? parsedRows[0] : null
  const showCashHelper = singleEfectivo && covered
  const tenderedNum = Number(cashTendered)
  const tenderedValid = cashTendered.trim() !== '' && Number.isFinite(tenderedNum)
  const tenderedInsufficient =
    tenderedValid && efectivoRow !== null && tenderedNum < (efectivoRow.parsedAmount || 0)
  const change =
    tenderedValid && efectivoRow !== null && !tenderedInsufficient
      ? roundMoney(tenderedNum - (efectivoRow.parsedAmount || 0))
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="pos-payment-form">
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const err = rowErrors[row.id] ?? {}
          const isTarjeta = row.method === 'tarjeta'
          return (
            <div
              key={row.id}
              className={cn(
                'grid gap-3',
                isTarjeta ? 'sm:grid-cols-[1fr_1fr_1fr_auto]' : 'sm:grid-cols-[1fr_1fr_auto]'
              )}
              data-testid={`pos-payment-row-${row.id}`}
            >
              <div className="space-y-1.5">
                {idx === 0 && (
                  <Label htmlFor={`pay-method-${row.id}`}>{posMessages.payments.methodLabel}</Label>
                )}
                <Select
                  value={row.method}
                  onValueChange={(next) => updateRow(row.id, { method: next as PaymentMethod })}
                  disabled={submitting}
                >
                  <SelectTrigger id={`pay-method-${row.id}`} className="w-full">
                    <SelectValue placeholder={posMessages.payments.methodPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">
                      {posMessages.payments.methods.efectivo}
                    </SelectItem>
                    <SelectItem value="transferencia">
                      {posMessages.payments.methods.transferencia}
                    </SelectItem>
                    <SelectItem value="tarjeta">{posMessages.payments.methods.tarjeta}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isTarjeta && (
                <div className="space-y-1.5">
                  {idx === 0 && (
                    <Label htmlFor={`pay-cardtype-${row.id}`}>
                      {posMessages.payments.cardTypeLabel}
                    </Label>
                  )}
                  <Select
                    value={row.cardType ?? undefined}
                    onValueChange={(next) => updateRow(row.id, { cardType: next as CardType })}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id={`pay-cardtype-${row.id}`}
                      className="w-full"
                      aria-invalid={err.cardType ? true : undefined}
                    >
                      <SelectValue placeholder={posMessages.payments.cardTypePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">
                        {posMessages.payments.cardTypes.credito}
                      </SelectItem>
                      <SelectItem value="debito">
                        {posMessages.payments.cardTypes.debito}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {err.cardType && <p className="text-destructive text-xs">{err.cardType}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                {idx === 0 && (
                  <Label htmlFor={`pay-amount-${row.id}`}>{posMessages.payments.amountLabel}</Label>
                )}
                <Input
                  id={`pay-amount-${row.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                  aria-invalid={err.amount ? true : undefined}
                  aria-label={posMessages.payments.amountLabel}
                  autoFocus={idx === 0}
                  disabled={submitting}
                  data-testid={`pos-payment-amount-${row.id}`}
                />
                {err.amount && <p className="text-destructive text-xs">{err.amount}</p>}
              </div>

              <div className={cn('flex', idx === 0 ? 'items-end' : 'items-center')}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1 || submitting}
                  aria-label={posMessages.payments.removeRow}
                  data-testid={`pos-payment-remove-${row.id}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={submitting}
          data-testid="pos-payment-add-row"
        >
          {posMessages.payments.addRow}
        </Button>
      </div>

      <div
        className="bg-muted/40 space-y-1 rounded-md border px-3 py-2 text-sm"
        aria-live="polite"
        data-testid="pos-payment-balance"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">{posMessages.payments.balance.total}</span>
          <span className="tabular-nums">{formatMXN(total)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">{posMessages.payments.balance.sum}</span>
          <span className="tabular-nums">{formatMXN(sum)}</span>
        </div>
        <div className="pt-1">
          {remaining > 0 ? (
            <p className="text-destructive text-xs">
              {posMessages.payments.balance.remaining(formatMXN(remaining))}
            </p>
          ) : remaining === 0 ? (
            <p className="text-primary text-xs font-medium">
              {posMessages.payments.balance.covered}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {posMessages.payments.balance.over(formatMXN(Math.abs(remaining)))}
            </p>
          )}
        </div>
      </div>

      {showCashHelper && (
        <div className="space-y-1.5" data-testid="pos-payment-cash-helper">
          <Label htmlFor="pay-cash-tendered">{posMessages.payments.cashTendered.label}</Label>
          <Input
            id="pay-cash-tendered"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cashTendered}
            onChange={(e) => setCashTendered(e.target.value)}
            placeholder={posMessages.payments.cashTendered.placeholder}
            disabled={submitting}
          />
          {tenderedInsufficient && (
            <p className="text-destructive text-xs">
              {posMessages.payments.cashTendered.insufficient}
            </p>
          )}
          {change !== null && (
            <p className="text-muted-foreground text-xs">
              {posMessages.payments.cashTendered.change(formatMXN(change))}
            </p>
          )}
        </div>
      )}

      {submitError && <p className="text-destructive text-xs">{submitError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {posMessages.payments.cancel}
        </Button>
        <Button type="submit" disabled={!canSubmit} data-testid="pos-payment-submit">
          {submitting ? posMessages.submit.sending : posMessages.payments.submit}
        </Button>
      </DialogFooter>
    </form>
  )
}
