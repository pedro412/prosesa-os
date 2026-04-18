import { useEffect, useMemo, useReducer, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type Company, useCompanies } from '@/lib/queries/companies'
import { type Customer } from '@/lib/queries/customers'
import { buildSalesNoteTicketBytes } from '@/lib/print/build-ticket'
import { fetchAndDitherLogo } from '@/lib/print/logo'
import { printViaUSB } from '@/lib/print/usb-printer'
import { type CreateSalesNotePaymentInput, useCreateSalesNote } from '@/lib/queries/sales-notes'
import { computeLineTotal, computeTotals, type Totals } from '@/lib/tax'
import { usePrinterStore } from '@/store/printer-store'

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

// Snapshot of everything a just-created sale needs to render a ticket.
// Captured into state the moment the server resolves so the auto-print
// effect can fire without reading the POS form (which resets right
// after to be ready for the next sale).
interface CompletedSale {
  folio: string
  createdAt: string
  totals: Totals
  ivaRate: number
  lines: Array<{
    concept: string
    quantity: number
    unit: string
    unit_price: number
    line_total: number
  }>
  payments: CreateSalesNotePaymentInput[]
  company: Company
  customer: Customer | null
}

const AUTO_PRINT_DELAY_MS = 300

// /pos — counter-mode POS (LIT-31). Composes the catalog search, line
// editor, company + customer pickers, totals panel, and the charge CTA.
// Submit lands a note in `status='pendiente'`; payment capture is LIT-33.
export function PosPage() {
  const [state, dispatch] = useReducer(posFormReducer, undefined, initialPosFormState)
  const [freeFormOpen, setFreeFormOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)

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
    if (!submittable || !selectedCompany || !totals) return
    try {
      const payload = { ...toCreateSalesNotePayload(state), payments }
      const result = await createMutation.mutateAsync(payload)
      toast.success(posMessages.submit.success(result.folio), {
        description: posMessages.submit.successHint,
      })
      // Snapshot everything the ticket needs BEFORE the reducer reset
      // clears state. The auto-print effect drains this queue.
      setCompletedSale({
        folio: result.folio,
        createdAt: new Date().toISOString(),
        totals,
        ivaRate: Number(selectedCompany.iva_rate),
        lines: state.lines.map((line) => ({
          concept: line.concept,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unitPrice,
          line_total: computeLineTotal({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountType: line.discountType,
            discountValue: line.discountValue,
          }),
        })),
        payments,
        company: selectedCompany,
        customer: selectedCustomer,
      })
      // Keep the company, drop everything else.
      dispatch({ type: 'reset' })
      setSelectedCustomer(null)
      setPaymentOpen(false)
      // TODO(LIT-35): redirect to the note detail view once it lands.
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

  // Silent auto-print after a successful Cobrar. Fires once per
  // completed sale; a small delay gives the success toast a chance to
  // paint before the print round-trip spins up. The note is already
  // persisted at this point — a printer failure is a UX annoyance, not
  // a data issue; we surface it in a toast with a pointer to the
  // /settings/printer fix-it page and move on.
  useEffect(() => {
    if (!completedSale) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (cancelled) return
      const store = usePrinterStore.getState()
      store.setStatus('printing', null)
      try {
        const logoBytes = completedSale.company.logo_url
          ? await fetchAndDitherLogo(completedSale.company.logo_url)
          : null
        const bytes = buildSalesNoteTicketBytes({
          note: {
            folio: completedSale.folio,
            created_at: completedSale.createdAt,
            subtotal: completedSale.totals.subtotal,
            iva: completedSale.totals.iva,
            total: completedSale.totals.total,
            iva_rate_snapshot: completedSale.ivaRate,
          },
          lines: completedSale.lines,
          payments: completedSale.payments,
          company: {
            razon_social: completedSale.company.razon_social,
            nombre_comercial: completedSale.company.nombre_comercial,
            rfc: completedSale.company.rfc,
            regimen_fiscal: completedSale.company.regimen_fiscal,
            direccion_fiscal: completedSale.company.direccion_fiscal,
            cp_fiscal: completedSale.company.cp_fiscal,
          },
          customer: completedSale.customer ? { nombre: completedSale.customer.nombre } : null,
          logoBytes,
          config: { charWidth: store.charWidth },
        })
        await printViaUSB(bytes)
        store.setStatus('ok', null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        store.setStatus('error', errorMessage)
        toast.error(posMessages.print.error, {
          description: posMessages.print.errorHint,
        })
      } finally {
        if (!cancelled) setCompletedSale(null)
      }
    }, AUTO_PRINT_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [completedSale])

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
