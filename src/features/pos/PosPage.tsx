import { useMemo, useReducer, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type Company, useCompanies } from '@/lib/queries/companies'
import { type Customer } from '@/lib/queries/customers'
import { type CreateSalesNotePaymentInput, useCreateSalesNote } from '@/lib/queries/sales-notes'
import { computeTotals } from '@/lib/tax'

import { CatalogSearchPanel } from './CatalogSearchPanel'
import { CompanySelect } from './CompanySelect'
import { CustomerSelect } from './CustomerSelect'
import { FreeFormLineDialog } from './FreeFormLineDialog'
import { LineItemsTable } from './LineItemsTable'
import { posMessages } from './messages'
import { PaymentDialog } from './PaymentDialog'
import {
  canSubmit,
  initialPosFormState,
  posFormReducer,
  toCreateSalesNotePayload,
} from './pos-form-state'
import { TotalsPanel } from './TotalsPanel'

// /pos — counter-mode POS (LIT-31). Composes the catalog search, line
// editor, company + customer pickers, totals panel, and the charge CTA.
// Submit lands a note in `status='pendiente'`; payment capture is LIT-33.
export function PosPage() {
  const [state, dispatch] = useReducer(posFormReducer, undefined, initialPosFormState)
  const [freeFormOpen, setFreeFormOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const createMutation = useCreateSalesNote()

  // We read companies here to resolve the selected company's IVA
  // config for the Totals panel. The <CompanySelect> component drives
  // its own fetch; both calls share the same TanStack Query cache so
  // it's a single network request.
  const { data: companies } = useCompanies({ includeInactive: false })
  const selectedCompany: Company | null = useMemo(
    () => companies?.find((c) => c.id === state.companyId) ?? null,
    [companies, state.companyId]
  )

  // Computed once so the totals panel and the payment dialog read from
  // the same source of truth (no drift between "total to cobrar" and
  // "total being paid").
  const totals = useMemo(() => {
    if (!selectedCompany) return null
    return computeTotals({
      lines: state.lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
      })),
      ivaRate: Number(selectedCompany.iva_rate),
      ivaInclusive: selectedCompany.iva_inclusive,
    })
  }, [selectedCompany, state.lines])

  const submittable = canSubmit(state) && !createMutation.isPending

  async function handleConfirmPayments(payments: CreateSalesNotePaymentInput[]) {
    if (!submittable) return
    try {
      const payload = { ...toCreateSalesNotePayload(state), payments }
      const result = await createMutation.mutateAsync(payload)
      toast.success(posMessages.submit.success(result.folio), {
        description: posMessages.submit.successHint,
      })
      // Keep the company, drop everything else.
      dispatch({ type: 'reset' })
      setSelectedCustomer(null)
      setPaymentOpen(false)
      // TODO(LIT-34/LIT-35): trigger thermal ticket print (M3-7) or
      // redirect to the note detail (M3-8) once those land. For now
      // the operator stays in POS with the success toast.
    } catch (err) {
      // Surface server-side messages we can recognize; fall back to
      // the generic toast otherwise. Keep the dialog open on error so
      // the operator can correct and retry.
      const message = err instanceof Error ? err.message : ''
      if (message.includes('not authenticated')) {
        toast.error(posMessages.submit.notAuthenticated)
      } else if (message.includes('unknown or inactive company')) {
        toast.error(posMessages.submit.companyInactive)
      } else if (message.includes('do not cover total')) {
        // Defensive: the dialog already blocks this path client-side,
        // but the server is the source of truth.
        toast.error(posMessages.payments.errors.totalNotCovered)
      } else {
        toast.error(posMessages.submit.genericError)
      }
    }
  }

  const blocked = state.companyId === null

  return (
    <div className="space-y-6" data-testid="pos-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{posMessages.page.title}</h1>
        <p className="text-muted-foreground text-sm">{posMessages.page.description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column — build the sale */}
        <div className="space-y-6 lg:min-w-0">
          <CatalogSearchPanel
            disabled={blocked}
            onAdd={(item) => dispatch({ type: 'addCatalogLine', item })}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFreeFormOpen(true)}
              disabled={blocked}
              data-testid="pos-freeform-open"
            >
              {posMessages.freeForm.openButton}
            </Button>
          </div>

          {blocked && (
            <p
              className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm"
              data-testid="pos-company-blocker"
            >
              {posMessages.blockers.companyRequired}
            </p>
          )}

          {!blocked && (
            <LineItemsTable
              lines={state.lines}
              onUpdate={(id, patch) => dispatch({ type: 'updateLine', id, patch })}
              onRemove={(id) => dispatch({ type: 'removeLine', id })}
            />
          )}
        </div>

        {/* Right column — metadata + totals + charge */}
        <div className="space-y-6">
          <CompanySelect
            value={state.companyId}
            onChange={(companyId) => dispatch({ type: 'setCompany', companyId })}
          />

          <CustomerSelect
            value={selectedCustomer}
            onChange={(customer) => {
              setSelectedCustomer(customer)
              dispatch({ type: 'setCustomer', customerId: customer?.id ?? null })
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="pos-notes">{posMessages.notes.label}</Label>
            <Textarea
              id="pos-notes"
              value={state.notes}
              onChange={(e) => dispatch({ type: 'setNotes', notes: e.target.value })}
              placeholder={posMessages.notes.placeholder}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="pos-invoice" className="text-sm font-normal">
              {posMessages.invoice.label}
            </Label>
            <Switch
              id="pos-invoice"
              checked={state.requiresInvoice}
              onCheckedChange={(requiresInvoice) =>
                dispatch({ type: 'setRequiresInvoice', requiresInvoice })
              }
              data-testid="pos-invoice-toggle"
            />
          </div>

          <TotalsPanel
            lines={state.lines}
            ivaRate={selectedCompany ? Number(selectedCompany.iva_rate) : null}
            ivaInclusive={selectedCompany ? selectedCompany.iva_inclusive : null}
          />

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!submittable}
            onClick={() => setPaymentOpen(true)}
            data-testid="pos-submit"
          >
            {createMutation.isPending ? posMessages.submit.sending : posMessages.submit.cta}
          </Button>
          {!submittable &&
            !createMutation.isPending &&
            state.companyId &&
            state.lines.length === 0 && (
              <p className="text-muted-foreground text-center text-xs">
                {posMessages.submit.disabledReason}
              </p>
            )}
        </div>
      </div>

      <FreeFormLineDialog
        open={freeFormOpen}
        onOpenChange={setFreeFormOpen}
        onAdd={(line) => dispatch({ type: 'addFreeFormLine', line })}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={totals?.total ?? 0}
        submitting={createMutation.isPending}
        onConfirm={handleConfirmPayments}
      />
    </div>
  )
}
