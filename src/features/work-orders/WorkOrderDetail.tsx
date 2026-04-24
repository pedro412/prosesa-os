import { type FormEvent, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, MoreVertical, Pencil, Printer, X } from 'lucide-react'
import { toast } from 'sonner'

import { ListErrorCard, ListLoadingCard } from '@/components/layout/list-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PaymentDialog } from '@/features/pos/PaymentDialog'
import { formatMXN } from '@/lib/format'
import { useCompany } from '@/lib/queries/companies'
import {
  type CreateSalesNotePaymentInput,
  type SalesNoteStatus,
  useAddPaymentsToNote,
} from '@/lib/queries/sales-notes'
import { isAdmin, useCurrentProfile } from '@/lib/queries/profiles'
import {
  type WorkOrderStatus,
  useUpdateWorkOrderDescription,
  useWorkOrder,
  useWorkOrderLines,
  useWorkOrderStatusLog,
} from '@/lib/queries/work-orders'
import { cn } from '@/lib/utils'

import { workOrdersMessages } from './messages'
import { STATUS_LABELS, isOverdue, promisedDelta, statusBadgeVariant } from './status-metadata'
import { WorkOrderCancelDialog } from './WorkOrderCancelDialog'
import { WorkOrderStatusDialog } from './WorkOrderStatusDialog'

interface WorkOrderDetailProps {
  workOrderId: string
}

const fullDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

const dateOnlyFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
})

function formatFull(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return fullDateFormatter.format(d)
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateOnlyFormatter.format(d)
}

function notaStatusVariant(
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

// Human-readable labels for sales-note status. Kept local to this
// surface — the sales-notes feature owns the canonical copy, but
// duplicating four strings avoids a cross-feature import for a
// two-surface use case.
const SALES_NOTE_STATUS_LABELS: Record<SalesNoteStatus, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  abonada: 'Abonada',
  cancelada: 'Cancelada',
}

export function WorkOrderDetail({ workOrderId }: WorkOrderDetailProps) {
  const profile = useCurrentProfile()
  const admin = isAdmin(profile.data)

  const { data: order, isPending, isError } = useWorkOrder(workOrderId)
  const { data: lines, isPending: linesPending } = useWorkOrderLines(workOrderId)
  const { data: log, isPending: logPending } = useWorkOrderStatusLog(workOrderId)
  const { data: company } = useCompany(order?.company_id)

  const [statusOpen, setStatusOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const addPayments = useAddPaymentsToNote()

  const messages = workOrdersMessages.detail

  if (isPending) {
    return <ListLoadingCard label={messages.loading} />
  }

  if (isError) {
    return <ListErrorCard title={messages.loadError} />
  }

  if (!order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.notFound}</CardTitle>
          <CardDescription>{messages.notFoundDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/work-orders">{messages.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const status = order.status as WorkOrderStatus
  const nota = order.sales_note
  const saldoPendiente = nota?.saldo_pendiente !== undefined ? Number(nota.saldo_pendiente) : 0
  const total = nota ? Number(nota.total) : 0
  const cancelled = order.cancelled_at !== null
  const delta = promisedDelta({
    promised_at: order.promised_at,
    status: order.status,
    cancelled_at: order.cancelled_at,
  })
  const overdue = isOverdue({
    promised_at: order.promised_at,
    status: order.status,
    cancelled_at: order.cancelled_at,
  })

  async function handleConfirmPayments(payments: CreateSalesNotePaymentInput[]) {
    if (!nota) return
    try {
      await addPayments.mutateAsync({ salesNoteId: nota.id, payments })
      toast.success('Pago registrado.')
      setPaymentOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      toast.error(message || 'No se pudo registrar el pago.')
    }
  }

  return (
    <div className="space-y-6" data-testid="work-order-detail">
      {/* Back link */}
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/work-orders" className="gap-1">
            <ArrowLeft aria-hidden className="size-4" />
            {messages.backToList}
          </Link>
        </Button>
      </div>

      {/* Cancelled banner */}
      {cancelled && order.cancellation_reason && (
        <Card
          role="alert"
          className="border-destructive/40 bg-destructive/5"
          data-testid="work-order-cancelled-banner"
        >
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <X aria-hidden className="size-4 shrink-0 text-destructive" />
            <span>{messages.cancelledBanner(order.cancellation_reason)}</span>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                'font-mono text-2xl font-semibold tracking-tight',
                cancelled && 'line-through text-muted-foreground'
              )}
              data-testid="work-order-folio"
            >
              {order.folio}
            </h1>
            {cancelled ? (
              <Badge variant="destructive">{workOrdersMessages.row.cancelledLabel}</Badge>
            ) : (
              <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>
            )}
            {order.priority === 'urgente' && (
              <Badge variant="destructive">{workOrdersMessages.priority.urgente}</Badge>
            )}
            {overdue && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {workOrdersMessages.row.overdueAriaLabel}
              </Badge>
            )}
          </div>
          <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="sr-only">Cliente</dt>
              <dd>{order.customer?.nombre ?? workOrdersMessages.row.noCustomer}</dd>
            </div>
            <div>
              <dt className="sr-only">{messages.header.createdAt}</dt>
              <dd>
                {messages.header.createdAt} · {formatFull(order.created_at)}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{messages.header.promisedAt}</dt>
              <dd>
                {messages.header.promisedAt} ·{' '}
                {order.promised_at
                  ? `${formatDateOnly(order.promised_at)}${delta ? ` (${delta.label})` : ''}`
                  : messages.header.noPromisedDate}
              </dd>
            </div>
            {company && (
              <div>
                <dt className="sr-only">Empresa</dt>
                <dd>{company.nombre_comercial}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setStatusOpen(true)}
            disabled={cancelled}
            data-testid="work-order-change-status"
          >
            {messages.actions.changeStatus}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!nota) return
              const url = `/print/sales-notes/${nota.id}?workOrderId=${workOrderId}`
              window.open(url, '_blank', 'noopener')
            }}
            disabled={!nota}
            data-testid="work-order-print"
          >
            <Printer aria-hidden className="size-4" />
            {messages.actions.print}
          </Button>
          {admin && !cancelled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={messages.actions.more}
                  data-testid="work-order-more"
                >
                  <MoreVertical aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                  data-testid="work-order-cancel-trigger"
                >
                  {messages.actions.cancel}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="space-y-6 lg:min-w-0">
          <DescriptionCard
            workOrderId={workOrderId}
            description={order.description}
            disabled={cancelled}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{messages.sections.conceptos}</CardTitle>
            </CardHeader>
            <CardContent>
              {linesPending ? (
                <p className="text-muted-foreground text-sm">{messages.loading}</p>
              ) : !lines || lines.length === 0 ? (
                <p className="text-muted-foreground text-sm">{messages.lines.empty}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.lines.columns.concept}</TableHead>
                      <TableHead className="w-20">{messages.lines.columns.unit}</TableHead>
                      <TableHead className="w-24 text-right">
                        {messages.lines.columns.quantity}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {messages.lines.columns.unitPrice}
                      </TableHead>
                      <TableHead className="w-32 text-right">
                        {messages.lines.columns.total}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id} data-testid={`wo-line-${line.id}`}>
                        <TableCell className="min-w-0">
                          <div className="text-sm font-medium">{line.concept}</div>
                          {(line.dimensions || line.material) && (
                            <div className="text-muted-foreground text-xs">
                              {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{line.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMXN(Number(line.unit_price))}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMXN(Number(line.line_total))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{messages.sections.materiales}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {messages.sections.materialesComingSoon}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {nota && (
            <Card data-testid="work-order-parent-nota">
              <CardHeader>
                <CardTitle className="text-base">{messages.sections.notaDeVenta}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{messages.nota.folio}</span>
                  <span className="flex items-center gap-2">
                    {(nota.status as SalesNoteStatus) === 'cancelada' && (
                      <Badge variant="destructive" data-testid="work-order-nota-cancelled-badge">
                        {SALES_NOTE_STATUS_LABELS.cancelada}
                      </Badge>
                    )}
                    <Link
                      to="/sales-notes"
                      search={{ openId: nota.id }}
                      className="font-mono font-medium underline underline-offset-2 hover:no-underline"
                      data-testid="work-order-nota-link"
                    >
                      {nota.folio}
                    </Link>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{messages.nota.total}</span>
                  <span className="tabular-nums">{formatMXN(total)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{messages.nota.saldo}</span>
                  <span
                    className={cn(
                      'tabular-nums',
                      saldoPendiente > 0 && 'text-destructive font-medium'
                    )}
                  >
                    {formatMXN(saldoPendiente)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{messages.nota.status}</span>
                  <Badge variant={notaStatusVariant(nota.status as SalesNoteStatus)}>
                    {SALES_NOTE_STATUS_LABELS[nota.status as SalesNoteStatus]}
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{messages.nota.requiresInvoice}</span>
                  <span>
                    {nota.requires_invoice
                      ? messages.nota.requiresInvoiceYes
                      : messages.nota.requiresInvoiceNo}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {nota && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.sections.pagos}</CardTitle>
                <CardDescription>{messages.sections.pagosDisclaimer(nota.folio)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nota.payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{messages.payments.empty}</p>
                ) : (
                  <ul className="space-y-1 text-sm" data-testid="wo-payments-list">
                    {nota.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-baseline justify-between gap-2 border-b pb-1 last:border-0"
                      >
                        <span className="text-muted-foreground text-xs">
                          {formatFull(p.paid_at)}
                        </span>
                        <span className="text-xs capitalize">{p.method}</span>
                        <span className="font-medium tabular-nums">
                          {formatMXN(Number(p.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setPaymentOpen(true)}
                  disabled={saldoPendiente <= 0 || nota.status === 'cancelada'}
                  data-testid="work-order-register-payment"
                >
                  {messages.actions.registerPayment}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{messages.sections.historial}</CardTitle>
            </CardHeader>
            <CardContent>
              {logPending ? (
                <p className="text-muted-foreground text-sm">{messages.loading}</p>
              ) : !log || log.length === 0 ? (
                <p className="text-muted-foreground text-sm">{messages.history.empty}</p>
              ) : (
                <ol className="space-y-3" data-testid="wo-history-timeline">
                  {log.map((entry) => {
                    const fromLabel = entry.old_status
                      ? STATUS_LABELS[entry.old_status as WorkOrderStatus]
                      : null
                    const toLabel = STATUS_LABELS[entry.new_status as WorkOrderStatus]
                    return (
                      <li
                        key={entry.id}
                        className="border-muted border-l-2 pl-3"
                        data-testid={`wo-history-entry-${entry.id}`}
                      >
                        <div className="text-sm font-medium">
                          {messages.history.transition(fromLabel, toLabel)}
                        </div>
                        <div className="text-muted-foreground text-xs tabular-nums">
                          {formatFull(entry.changed_at)}
                        </div>
                        {entry.note && (
                          <p className="mt-1 text-sm">
                            <span className="text-muted-foreground text-xs">
                              {messages.history.note}:{' '}
                            </span>
                            {entry.note}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <WorkOrderStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        workOrderId={workOrderId}
        currentStatus={status}
        saldoPendiente={nota?.saldo_pendiente !== undefined ? Number(nota.saldo_pendiente) : null}
      />

      <WorkOrderCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        workOrderId={workOrderId}
        folio={order.folio}
      />

      {nota && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          total={Math.max(0, saldoPendiente)}
          submitting={addPayments.isPending}
          onConfirm={handleConfirmPayments}
        />
      )}
    </div>
  )
}

interface DescriptionCardProps {
  workOrderId: string
  description: string | null
  disabled?: boolean
}

function DescriptionCard({ workOrderId, description, disabled }: DescriptionCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(description ?? '')
  const [error, setError] = useState<string | null>(null)
  const mutation = useUpdateWorkOrderDescription()
  const messages = workOrdersMessages.detail

  function startEdit() {
    setDraft(description ?? '')
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(description ?? '')
    setError(null)
    setEditing(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const trimmed = draft.trim()
    mutation
      .mutateAsync({ workOrderId, description: trimmed.length > 0 ? trimmed : null })
      .then(() => {
        toast.success(messages.description.updateSuccess)
        setEditing(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message || messages.description.updateError)
      })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{messages.sections.resumen}</CardTitle>
        {!editing && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startEdit}
            aria-label={messages.description.editAria}
            data-testid="work-order-description-edit"
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="wo-description" className="sr-only">
              {messages.sections.resumen}
            </Label>
            <Textarea
              id="wo-description"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                if (error) setError(null)
              }}
              placeholder={messages.description.placeholder}
              rows={4}
              autoFocus
              disabled={mutation.isPending}
              data-testid="work-order-description-input"
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={mutation.isPending}
              >
                {messages.description.cancel}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={mutation.isPending}
                data-testid="work-order-description-save"
              >
                {messages.description.save}
              </Button>
            </div>
          </form>
        ) : description && description.trim().length > 0 ? (
          <p className="text-sm whitespace-pre-wrap" data-testid="work-order-description-text">
            {description}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{messages.description.empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
