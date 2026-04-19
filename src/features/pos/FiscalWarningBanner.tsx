import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { customerFiscalStatus, type FiscalField } from '@/features/customers/fiscal-completeness'
import type { Customer } from '@/lib/queries/customers'

import { posMessages } from './messages'

interface FiscalWarningBannerProps {
  requiresInvoice: boolean
  customer: Customer | null
  // Opens the edit dialog that PosPage owns. Passed through so this
  // component stays pure — no dialog state lives here.
  onRequestEdit: () => void
}

// Non-blocking nudge when `Requiere factura` is on but the attached
// customer can't actually be invoiced yet. Warn-don't-block: Cobrar
// stays enabled (matches the "stock puede ir negativo" rule in
// CLAUDE.md §8). Renders nothing when the state is fine.
//
// Two copy variants:
//   * `no-customer`     — factura toggle is on with no customer pick.
//     Cobrar will save the note but it won't be billable later (the
//     printed ticket falls back to XAXX010101000 per CLAUDE.md §7).
//   * `incomplete`      — customer is attached but missing fiscal
//     fields. Shows a "Completar datos fiscales" action.
//   * `complete`        — banner is hidden.
export function FiscalWarningBanner({
  requiresInvoice,
  customer,
  onRequestEdit,
}: FiscalWarningBannerProps) {
  if (!requiresInvoice) return null

  const { status, missing } = customerFiscalStatus(customer)
  if (status === 'complete') return null

  const copy = posMessages.fiscalWarning
  const title = status === 'no-customer' ? copy.noCustomerTitle : copy.incompleteTitle
  const description =
    status === 'no-customer'
      ? copy.noCustomerDescription
      : copy.incompleteDescription(formatMissing(missing))

  return (
    <div
      className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-md border p-3"
      role="alert"
      data-testid="pos-fiscal-warning"
      data-status={status}
    >
      <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-foreground text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        {status === 'incomplete' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestEdit}
            data-testid="pos-fiscal-warning-edit"
          >
            {copy.completeAction}
          </Button>
        )}
      </div>
    </div>
  )
}

function formatMissing(missing: readonly FiscalField[]): string {
  return missing.map((field) => posMessages.fiscalWarning.fieldLabels[field]).join(', ')
}
