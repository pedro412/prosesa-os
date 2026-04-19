import { useMemo, useState } from 'react'
import { Ban, Printer, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PaymentDialog } from '@/features/pos/PaymentDialog'
import { formatMXN } from '@/lib/format'
import { useCompany } from '@/lib/queries/companies'
import { useCustomer } from '@/lib/queries/customers'
import { useReprintTicket } from '@/lib/print/use-reprint-ticket'
import { type CardType, type PaymentMethod } from '@/lib/queries/payments'
import { isAdmin, useCurrentProfile } from '@/lib/queries/profiles'
import { type SalesNoteStatus, useAddPaymentsToNote, useSalesNote } from '@/lib/queries/sales-notes'
import { formatIvaRate, roundMoney } from '@/lib/tax'

import { CancelNoteDialog } from './CancelNoteDialog'
import { salesNotesMessages } from './messages'

interface SalesNoteDetailDrawerProps {
  noteId: string | null
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

function statusVariant(
  status: SalesNoteStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pagada':
      return 'default'
    case 'abonada':
      return 'secondary'
    case 'pendiente':
      return 'outline'
    case 'cancelada':
      return 'destructive'
  }
}

export function SalesNoteDetailDrawer({ noteId, onClose }: SalesNoteDetailDrawerProps) {
  return (
    <Sheet open={noteId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {noteId ? <DrawerBody noteId={noteId} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ noteId }: { noteId: string }) {
  const profile = useCurrentProfile()
  const admin = isAdmin(profile.data)

  const { data: note, isPending, isError } = useSalesNote(noteId)
  const { data: company } = useCompany(note?.company_id)
  const { data: customer } = useCustomer(note?.customer_id ?? undefined)

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const addPayments = useAddPaymentsToNote()
  const reprint = useReprintTicket()

  const messages = salesNotesMessages.drawer

  const totals = useMemo(() => {
    if (!note) return null
    const total = Number(note.total)
    const paidSum = roundMoney(
      note.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    )
    const saldo = roundMoney(Math.max(0, total - paidSum))
    return { total, paidSum, saldo }
  }, [note])

  const cancelled = note?.status === 'cancelada'
  const noSaldo = totals ? totals.saldo <= 0 : true

  if (isPending) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{messages.titlePrefix}…</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <p className="text-muted-foreground text-sm">{messages.loading}</p>
        </SheetBody>
      </>
    )
  }

  if (isError || !note) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{messages.loadError}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <p className="text-destructive text-sm">{messages.loadError}</p>
        </SheetBody>
      </>
    )
  }

  async function handleRegisterPayments(
    payments: Array<{ method: PaymentMethod; card_type: CardType | null; amount: number }>
  ) {
    try {
      await addPayments.mutateAsync({ salesNoteId: noteId, payments })
      toast.success(messages.toasts.paymentSuccess)
      setPaymentOpen(false)
    } catch {
      toast.error(messages.toasts.paymentError)
    }
  }

  async function handleReprint() {
    if (!company) {
      toast.error(messages.toasts.missingCompany)
      return
    }
    try {
      await reprint({ note: note!, company, customer: customer ?? null })
      toast.success(messages.toasts.printSuccess)
    } catch {
      toast.error(messages.toasts.printError)
    }
  }

  const status = note.status as SalesNoteStatus
  const companyLabel = company ? `${company.code} · ${company.nombre_comercial}` : '—'
  const customerLabel = customer?.nombre ?? salesNotesMessages.list.publicoEnGeneral
  const ivaRateDisplay = formatIvaRate(Number(note.iva_rate_snapshot))

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="font-mono">
            {messages.titlePrefix}
            {note.folio}
          </span>
          <Badge variant={statusVariant(status)}>{salesNotesMessages.status[status]}</Badge>
        </SheetTitle>
        <SheetDescription>{formatDate(note.created_at)}</SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-6">
        <section className="space-y-2" data-testid="sales-note-drawer-header">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {messages.sections.encabezado}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{messages.fields.company}</dt>
            <dd>{companyLabel}</dd>
            <dt className="text-muted-foreground">{messages.fields.customer}</dt>
            <dd>{customerLabel}</dd>
            <dt className="text-muted-foreground">{messages.fields.date}</dt>
            <dd>{formatDate(note.created_at)}</dd>
            {note.notes && (
              <>
                <dt className="text-muted-foreground">{messages.fields.notes}</dt>
                <dd className="whitespace-pre-wrap">{note.notes}</dd>
              </>
            )}
            {cancelled && (
              <>
                <dt className="text-destructive">{messages.fields.cancelled}</dt>
                <dd>
                  {note.cancellation_reason ?? '—'}
                  {note.cancelled_at && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatDate(note.cancelled_at)}
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
        </section>

        <section className="space-y-2" data-testid="sales-note-drawer-lines">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {messages.sections.lineas}
          </h3>
          {note.lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">{messages.empty.lines}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {note.lines.map((line) => {
                const lineTotal = Number(line.line_total)
                const quantity = Number(line.quantity)
                const unitPrice = Number(line.unit_price)
                return (
                  <li key={line.id} className="space-y-1 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.concept}</p>
                        <p className="text-muted-foreground text-xs">
                          {quantity} {line.unit} · {formatMXN(unitPrice)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium tabular-nums">
                        {formatMXN(lineTotal)}
                      </p>
                    </div>
                    {(line.dimensions || line.material) && (
                      <p className="text-muted-foreground text-xs">
                        {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2" data-testid="sales-note-drawer-payments">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {messages.sections.pagos}
          </h3>
          {note.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{messages.empty.payments}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {note.payments.map((payment) => {
                const method = payment.method as PaymentMethod
                const cardType = payment.card_type as CardType | null
                const label = cardType
                  ? `${salesNotesMessages.paymentMethods[method]} (${salesNotesMessages.cardTypes[cardType]})`
                  : salesNotesMessages.paymentMethods[method]
                return (
                  <li
                    key={payment.id}
                    className="flex items-baseline justify-between gap-4 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground text-xs">{formatDate(payment.paid_at)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {formatMXN(Number(payment.amount))}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="space-y-1" data-testid="sales-note-drawer-totals">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {messages.sections.totales}
          </h3>
          <dl className="bg-muted/40 space-y-1 rounded-md border px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{messages.fields.subtotal}</dt>
              <dd className="tabular-nums">{formatMXN(Number(note.subtotal))}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{messages.fields.ivaLabel(ivaRateDisplay)}</dt>
              <dd className="tabular-nums">{formatMXN(Number(note.iva))}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-1">
              <dt className="font-medium">{messages.fields.total}</dt>
              <dd className="font-medium tabular-nums">{formatMXN(Number(note.total))}</dd>
            </div>
            {totals && totals.paidSum > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{messages.fields.paidSum}</dt>
                <dd className="tabular-nums">{formatMXN(totals.paidSum)}</dd>
              </div>
            )}
            {totals && totals.saldo > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-destructive">{messages.fields.saldo}</dt>
                <dd className="text-destructive tabular-nums">{formatMXN(totals.saldo)}</dd>
              </div>
            )}
          </dl>
        </section>
      </SheetBody>

      <SheetFooter className="flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleReprint()
          }}
          data-testid="sales-note-drawer-print-ticket"
        >
          <Printer aria-hidden className="size-4" />
          {messages.actions.printTicket}
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  data-testid="sales-note-drawer-print-detailed"
                >
                  <ReceiptText aria-hidden className="size-4" />
                  {messages.actions.printDetailed}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{messages.actions.printDetailedComingSoon}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          type="button"
          onClick={() => setPaymentOpen(true)}
          disabled={cancelled || noSaldo}
          data-testid="sales-note-drawer-register-payment"
        >
          {messages.actions.registerPayment}
        </Button>
        {admin && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setCancelOpen(true)}
            disabled={cancelled}
            data-testid="sales-note-drawer-cancel"
          >
            <Ban aria-hidden className="size-4" />
            {messages.actions.cancel}
          </Button>
        )}
      </SheetFooter>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={totals?.saldo ?? 0}
        submitting={addPayments.isPending}
        onConfirm={handleRegisterPayments}
      />

      <CancelNoteDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        noteId={noteId}
        folio={note.folio}
        onCancelled={() => {
          toast.success(messages.toasts.cancelSuccess(note.folio))
          // Keep the drawer open so the operator can see the new
          // "Cancelada" state; they can close manually. Passing
          // onClose here would hide the outcome they just approved.
        }}
      />
    </>
  )
}
