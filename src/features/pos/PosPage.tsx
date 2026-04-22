import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog'
import { useItems } from '@/lib/queries/catalog'
import { type Company, useCompanies } from '@/lib/queries/companies'
import { type Customer, useCustomer } from '@/lib/queries/customers'
import { formatMXN } from '@/lib/format'
import { buildSalesNoteTicketBytes } from '@/lib/print/build-ticket'
import { fetchAndDitherLogo } from '@/lib/print/logo'
import { printViaUSB } from '@/lib/print/usb-printer'
import {
  type CreatedWorkOrder,
  type CreateSalesNotePaymentInput,
  useCreateSalesNote,
} from '@/lib/queries/sales-notes'
import { useVendors } from '@/lib/queries/vendors'
import { computeLineTotal, computeTotals, roundMoney, type Totals } from '@/lib/tax'
import { usePosDraftStore } from '@/store/pos-draft-store'
import { usePosPreferencesStore } from '@/store/pos-preferences'
import { usePrinterStore } from '@/store/printer-store'

import { CatalogSearchPanel } from './CatalogSearchPanel'
import { CompanySelect } from './CompanySelect'
import { CustomerSelect } from './CustomerSelect'
import { FiscalWarningBanner } from './FiscalWarningBanner'
import { FreeFormLineDialog } from './FreeFormLineDialog'
import { LineItemsTable } from './LineItemsTable'
import { posMessages } from './messages'
import { PaymentDialog } from './PaymentDialog'
import {
  canSubmit,
  createEmptyOrder,
  hasReferencedOrder,
  initialPosFormState,
  isDraftEmpty,
  orphanOrders,
  posFormReducer,
  sanitizeDraft,
  toCreateSalesNotePayload,
} from './pos-form-state'
import { PrinterStatusIndicator } from './PrinterStatusIndicator'
import { TotalsPanel } from './TotalsPanel'
import { VendorSelect } from './VendorSelect'
import { WorkOrderPanels } from './WorkOrderPanels'

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
  // LIT-37: CTAs rendered on the success screen, one per created work
  // order. The detail route is a placeholder until LIT-42 lands.
  workOrders: CreatedWorkOrder[]
}

const AUTO_PRINT_DELAY_MS = 300

// /pos — counter-mode POS (LIT-31). Composes the catalog search, line
// editor, company + customer pickers, totals panel, and the charge CTA.
// Submit lands a note in `status='pendiente'`; payment capture is LIT-33.
// Draft persistence (LIT-87) layers on top: the reducer stays pure,
// `useReducer` seeds from `pos-draft-store` on mount, and a sync effect
// writes every tick back to localStorage.
export function PosPage() {
  const [state, dispatch] = useReducer(
    posFormReducer,
    undefined,
    // Zustand `persist` with sync storage rehydrates before first
    // render, so reading `getState()` here lands the localStorage
    // draft into useReducer's initial state without a flicker.
    () => usePosDraftStore.getState().draft ?? initialPosFormState()
  )
  // Captured once per mount from the same source the reducer was
  // seeded from — drives the "Venta restaurada" toast below. We can't
  // derive it from `state` after mount because the sync effect will
  // mutate `state` immediately.
  const [initialDraftNonEmpty] = useState(
    () => !isDraftEmpty(usePosDraftStore.getState().draft ?? initialPosFormState())
  )
  const [freeFormOpen, setFreeFormOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  // Edit dialog for the attached customer. Lifted to PosPage so the
  // fiscal-warning banner's "Completar datos fiscales" action and
  // `CustomerSelect`'s Pencil button both open the same dialog.
  const [customerEditOpen, setCustomerEditOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)
  // Sticky banner with per-order CTAs after a successful Cobrar. Split
  // from `completedSale` (which drives the one-shot print) so the
  // links remain visible on the form for subsequent sales until the
  // operator starts typing.
  const [lastCreatedWorkOrders, setLastCreatedWorkOrders] = useState<CreatedWorkOrder[]>([])

  const createMutation = useCreateSalesNote()

  // Mirror every reducer tick into the persisted draft store. The
  // store's setter auto-empties when the form carries no
  // user-meaningful data (see `isDraftEmpty`), so post-Cobrar reset
  // — which keeps `companyId` but empties everything else — clears
  // localStorage without needing an explicit call site.
  const setDraft = usePosDraftStore((s) => s.setDraft)
  const clearDraft = usePosDraftStore((s) => s.clear)
  useEffect(() => {
    setDraft(state)
  }, [state, setDraft])

  // We read companies here to resolve the selected company's IVA
  // config for the Totals panel. The <CompanySelect> component drives
  // its own fetch; both calls share the same TanStack Query cache so
  // it's a single network request.
  const { data: companies, isPending: companiesPending } = useCompanies({
    includeInactive: false,
  })
  const selectedCompany: Company | null = useMemo(
    () => companies?.find((c) => c.id === state.companyId) ?? null,
    [companies, state.companyId]
  )

  // Active catalog items — read here (not just inside `CatalogSearchPanel`)
  // so the on-mount drift check can tell whether a persisted
  // `catalogItemId` still resolves. Same cache as the search panel.
  const { data: catalogItems, isPending: catalogPending } = useItems({})

  // Active vendors — LIT-107. Read here so the drift check can null
  // out a persisted vendorId that points at a now-deactivated vendor.
  // Same cache as VendorSelect.
  const { data: vendors, isPending: vendorsPending } = useVendors({ includeInactive: false })

  // Rehydrate the `selectedCustomer` row when we restore a draft with
  // a `customerId`. `CustomerSelect` needs the full `Customer` object
  // to render a label, but the store only persists the id. Returns
  // null (and `isFetched: true`, `isError: true`) when the customer
  // was deleted — the sanitize effect below drops the stale ref.
  const {
    data: rehydratedCustomer,
    isFetched: customerFetched,
    isError: customerError,
  } = useCustomer(state.customerId ?? undefined)
  useEffect(() => {
    if (!state.customerId) {
      setSelectedCustomer(null)
      return
    }
    if (rehydratedCustomer) {
      setSelectedCustomer(rehydratedCustomer)
    }
  }, [state.customerId, rehydratedCustomer])

  // Sticky default: on first load with no selection, pre-fill from the
  // per-workstation store, or auto-pick when only one active company
  // exists. A stored id that no longer matches an active company is
  // silently ignored — `useCompanies({ includeInactive: false })` has
  // already filtered deactivated rows out. No-op once the operator (or
  // this effect) has set a company, so the post-Cobrar reset behavior
  // at pos-form-state.ts:161 keeps working.
  const lastCompanyId = usePosPreferencesStore((s) => s.lastCompanyId)
  const setLastCompanyId = usePosPreferencesStore((s) => s.setLastCompanyId)
  useEffect(() => {
    if (state.companyId !== null) return
    if (!companies || companies.length === 0) return
    if (lastCompanyId && companies.some((c) => c.id === lastCompanyId)) {
      dispatch({ type: 'setCompany', companyId: lastCompanyId })
      return
    }
    if (companies.length === 1) {
      dispatch({ type: 'setCompany', companyId: companies[0].id })
    }
  }, [companies, state.companyId, lastCompanyId])

  // Drift check — fires once after all reference queries settle.
  // Walks the rehydrated draft and nulls out any reference that no
  // longer resolves (deactivated company, soft-deleted catalog item,
  // deleted customer), keeping concept/price snapshots on lines
  // intact. A single warning toast surfaces the drop so the operator
  // isn't surprised by silently-missing data.
  const driftCheckedRef = useRef(false)
  useEffect(() => {
    if (driftCheckedRef.current) return
    if (companiesPending || catalogPending || vendorsPending) return
    if (state.customerId && !customerFetched && !customerError) return

    const ctx = {
      activeCompanyIds: new Set(companies?.map((c) => c.id) ?? []),
      activeCatalogItemIds: new Set(catalogItems?.map((i) => i.id) ?? []),
      customerValid: state.customerId === null || (!!rehydratedCustomer && !customerError),
      activeVendorIds: new Set(vendors?.map((v) => v.id) ?? []),
    }
    const { state: sanitized, drifted } = sanitizeDraft(state, ctx)
    driftCheckedRef.current = true
    if (!drifted) return

    if (sanitized.companyId !== state.companyId) {
      dispatch({ type: 'setCompany', companyId: sanitized.companyId })
    }
    if (sanitized.customerId !== state.customerId) {
      dispatch({ type: 'setCustomer', customerId: sanitized.customerId })
      setSelectedCustomer(null)
    }
    if (sanitized.vendorId !== state.vendorId) {
      dispatch({ type: 'setVendor', vendorId: sanitized.vendorId })
    }
    sanitized.lines.forEach((line) => {
      const before = state.lines.find((l) => l.id === line.id)
      if (!before) return
      if (before.catalogItemId !== line.catalogItemId) {
        dispatch({ type: 'updateLine', id: line.id, patch: { catalogItemId: line.catalogItemId } })
      }
      if (before.orderClientId !== line.orderClientId) {
        dispatch({ type: 'setLineOrder', id: line.id, orderClientId: line.orderClientId })
      }
    })
    // Remove any orders the sanitizer pruned (empty / orphan).
    state.orders.forEach((order) => {
      if (!sanitized.orders.find((o) => o.clientId === order.clientId)) {
        dispatch({ type: 'removeOrder', clientId: order.clientId })
      }
    })
    toast.warning(posMessages.draft.drifted)
    // `state` is read as current via closure on each render — we gate
    // the first real run on the queries settling. Re-runs bail on the
    // ref guard. Excluding `state` from deps keeps the effect from
    // thrashing while the sync effect writes every keystroke back to
    // the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    companiesPending,
    catalogPending,
    vendorsPending,
    customerFetched,
    customerError,
    companies,
    catalogItems,
    vendors,
    rehydratedCustomer,
  ])

  // One-shot "Venta restaurada." toast when we actually rehydrated a
  // non-empty draft. Guarded by a ref so React 18 Strict Mode's
  // double-invoke in dev doesn't fire the toast twice.
  const restoredToastRef = useRef(false)
  useEffect(() => {
    if (!initialDraftNonEmpty) return
    if (restoredToastRef.current) return
    restoredToastRef.current = true
    toast.info(posMessages.draft.restored)
  }, [initialDraftNonEmpty])

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
      const paidSum = roundMoney(payments.reduce((acc, p) => acc + p.amount, 0))
      const saldo = roundMoney(Math.max(0, totals.total - paidSum))
      const isAnticipo = saldo > 0
      toast.success(posMessages.submit.success(result.folio), {
        description: isAnticipo
          ? posMessages.submit.successHintAnticipo(formatMXN(saldo))
          : posMessages.submit.successHint,
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
        workOrders: result.work_orders,
      })
      setLastCreatedWorkOrders(result.work_orders)
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
  const canDiscard = !isDraftEmpty(state)

  function handleDiscardConfirm() {
    clearDraft()
    dispatch({ type: 'reset' })
    // Reset keeps companyId, so we also wipe it to land on a
    // genuinely clean form — matches operator intent when they
    // explicitly said "descartar". Preferences sticky default will
    // refill it on next render via the bootstrap effect above.
    dispatch({ type: 'setCompany', companyId: null })
    setSelectedCustomer(null)
    setLastCreatedWorkOrders([])
    setDiscardOpen(false)
    toast.success(posMessages.draft.discard.success)
  }

  function handleCreateOrderForLine(lineId: string) {
    const order = createEmptyOrder()
    dispatch({ type: 'addOrder', order })
    dispatch({ type: 'setLineOrder', id: lineId, orderClientId: order.clientId })
  }

  // Clear the success banner the moment the operator starts a new sale
  // (adds a line or picks a different company). Keeps the links visible
  // for the window where the operator is likely to click them, without
  // cluttering the next sale's form.
  useEffect(() => {
    if (lastCreatedWorkOrders.length === 0) return
    if (state.lines.length > 0) {
      setLastCreatedWorkOrders([])
    }
  }, [state.lines.length, lastCreatedWorkOrders.length])

  return (
    <div className="space-y-6" data-testid="pos-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{posMessages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{posMessages.page.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            disabled={!canDiscard}
            aria-label={posMessages.draft.discard.triggerAria}
            data-testid="pos-discard-draft"
          >
            {posMessages.draft.discard.trigger}
          </Button>
          <PrinterStatusIndicator />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column — build the sale. `@container` lets the line
         *   editor swap between table and stacked-card layouts based
         *   on this column's actual width, not the viewport. The
         *   table needs ~1000px to fit; in the lg+ two-column layout
         *   the right side locks at 360px, so the left column is
         *   often narrower than the viewport. */}
        <div className="@container space-y-6 lg:min-w-0">
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
            <>
              <WorkOrderPanels
                orders={state.orders}
                lines={state.lines}
                onAddOrder={() => dispatch({ type: 'addOrder', order: createEmptyOrder() })}
                onRemoveOrder={(clientId) => dispatch({ type: 'removeOrder', clientId })}
                onUpdateOrder={(clientId, patch) =>
                  dispatch({ type: 'updateOrder', clientId, patch })
                }
              />
              <LineItemsTable
                lines={state.lines}
                orders={state.orders}
                onUpdate={(id, patch) => dispatch({ type: 'updateLine', id, patch })}
                onRemove={(id) => dispatch({ type: 'removeLine', id })}
                onChangeOrder={(id, orderClientId) =>
                  dispatch({ type: 'setLineOrder', id, orderClientId })
                }
                onCreateOrderFor={handleCreateOrderForLine}
              />
            </>
          )}

          {lastCreatedWorkOrders.length > 0 && (
            <div
              className="rounded-md border bg-muted/40 p-3 space-y-2"
              data-testid="pos-last-work-orders"
            >
              <p className="text-xs font-medium">{posMessages.submit.successHint}</p>
              <ul className="flex flex-wrap gap-2">
                {lastCreatedWorkOrders.map((wo) => (
                  <li key={wo.id}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`pos-work-order-link-${wo.id}`}
                    >
                      {/* Detail route will be wired in LIT-42. Using an
                       * anchor keeps the CTA present even before the
                       * route exists; the href is a stable pattern
                       * the router can later intercept. */}
                      <a href={`/ordenes-de-trabajo/${wo.id}`}>
                        {posMessages.submit.workOrderLink(wo.folio)}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column — metadata + totals + charge */}
        <div className="space-y-6">
          <CompanySelect
            value={state.companyId}
            onChange={(companyId) => {
              dispatch({ type: 'setCompany', companyId })
              setLastCompanyId(companyId)
            }}
          />

          <CustomerSelect
            value={selectedCustomer}
            onChange={(customer) => {
              setSelectedCustomer(customer)
              dispatch({ type: 'setCustomer', customerId: customer?.id ?? null })
            }}
            onRequestEdit={() => setCustomerEditOpen(true)}
          />

          <VendorSelect
            value={state.vendorId}
            onChange={(vendorId) => dispatch({ type: 'setVendor', vendorId })}
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

          <FiscalWarningBanner
            requiresInvoice={state.requiresInvoice}
            customer={selectedCustomer}
            onRequestEdit={() => setCustomerEditOpen(true)}
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
          {!submittable &&
            !createMutation.isPending &&
            state.companyId &&
            state.lines.length > 0 &&
            hasReferencedOrder(state) &&
            !state.customerId && (
              <p
                className="text-center text-xs text-destructive"
                data-testid="pos-customer-required-for-order"
              >
                {posMessages.submit.customerRequiredForOrder}
              </p>
            )}
          {!submittable &&
            !createMutation.isPending &&
            state.companyId &&
            state.lines.length > 0 &&
            orphanOrders(state).length > 0 && (
              <p
                className="text-center text-xs text-destructive"
                data-testid="pos-submit-blocked-orphan"
              >
                {posMessages.submit.blockedOrphanOrder}
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

      {/*
       * Customer edit dialog. Mounted here (not inside CustomerSelect)
       * so both the Pencil button in the selected-customer card and
       * the fiscal-warning banner's "Completar datos fiscales" action
       * open the same dialog. Only mounts when a customer is actually
       * attached — guards against passing `customer={null}` to the
       * underlying form.
       */}
      {selectedCustomer && (
        <CustomerFormDialog
          mode="edit"
          customer={selectedCustomer}
          open={customerEditOpen}
          onOpenChange={setCustomerEditOpen}
          onSaved={(updated) => {
            setSelectedCustomer(updated)
            setCustomerEditOpen(false)
          }}
        />
      )}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{posMessages.draft.discard.title}</AlertDialogTitle>
            <AlertDialogDescription>{posMessages.draft.discard.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{posMessages.draft.discard.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDiscardConfirm}
              data-testid="pos-discard-confirm"
            >
              {posMessages.draft.discard.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
