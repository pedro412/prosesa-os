import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, ChevronLeft, Pencil } from 'lucide-react'

import {
  ListEmptyCard,
  ListErrorCard,
  ListLoadingCard,
  ListPagination,
} from '@/components/layout/list-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMXN } from '@/lib/format'
import { useCustomer } from '@/lib/queries/customers'
import { type SalesNote, type SalesNoteStatus, useSalesNotesPaged } from '@/lib/queries/sales-notes'
import { useVendorsByIds } from '@/lib/queries/vendors'
import {
  type WorkOrderListRow,
  type WorkOrderStatus,
  useWorkOrdersPaged,
} from '@/lib/queries/work-orders'
import { STATUS_LABELS, statusBadgeVariant } from '@/features/work-orders/status-metadata'

import { SalesNoteDetailDrawer } from '@/features/sales-notes/SalesNoteDetailDrawer'

import { CustomerFormDialog } from './CustomerFormDialog'
import { customerFiscalStatus } from './fiscal-completeness'
import { CUSTOMER_FISCAL_FIELD_LABELS, customersMessages } from './messages'

const SECTION_PAGE_SIZE = 10

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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return fullDateFormatter.format(d)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateOnlyFormatter.format(d)
}

function salesNoteStatusVariant(
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

const SALES_NOTE_STATUS_LABELS: Record<SalesNoteStatus, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  abonada: 'Abonada',
  cancelada: 'Cancelada',
}

interface CustomerDetailProps {
  customerId: string
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const messages = customersMessages.detail
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  // Local state for the sales-note drawer. Kept in local state (not URL)
  // so opening a nota doesn't yank the operator to the /sales-notes
  // route — they stay anchored on the customer while scanning.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  const { data: customer, isPending, isError } = useCustomer(customerId)

  if (isPending) {
    return <ListLoadingCard skeleton={{ rows: 4, columns: 2 }} />
  }

  if (isError) {
    return <ListErrorCard title={messages.loadError} />
  }

  if (!customer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.notFound}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{messages.notFoundDescription}</p>
          <Button asChild variant="outline">
            <Link to="/customers">
              <ChevronLeft aria-hidden className="size-4" />
              {messages.backToList}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const fiscal = customerFiscalStatus(customer)
  const deleted = customer.deleted_at !== null

  return (
    <div className="space-y-6" data-testid={`customer-detail-${customer.id}`}>
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/customers" data-testid="customer-detail-back">
            <ChevronLeft aria-hidden className="size-4" />
            {messages.backToList}
          </Link>
        </Button>
      </div>

      {deleted && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="text-destructive py-3 text-sm">
            {messages.deletedBanner(formatDate(customer.deleted_at))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{customer.nombre}</CardTitle>
            <FiscalChip status={fiscal.status} missing={fiscal.missing} />
          </div>
          {!deleted && (
            <Button
              variant="outline"
              onClick={() => setEditOpen(true)}
              data-testid="customer-detail-edit"
            >
              <Pencil aria-hidden className="size-4" />
              {messages.editButton}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label={messages.header.telefono} value={customer.telefono} />
            <Field label={messages.header.email} value={customer.email} />
            <Field label={messages.header.rfc} value={customer.rfc} mono />
            <Field label={messages.header.razonSocial} value={customer.razon_social} />
            <Field label={messages.header.regimenFiscal} value={customer.regimen_fiscal} />
          </dl>
        </CardContent>
      </Card>

      <NotasSection customerId={customer.id} onOpenNote={(noteId) => setOpenNoteId(noteId)} />

      <OrdenesSection
        customerId={customer.id}
        onOpenOrder={(orderId) => navigate({ to: `/work-orders/${orderId}` })}
      />

      <CustomerFormDialog
        mode="edit"
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <SalesNoteDetailDrawer noteId={openNoteId} onClose={() => setOpenNoteId(null)} />
    </div>
  )
}

interface FieldProps {
  label: string
  value: string | null | undefined
  mono?: boolean
}

function Field({ label, value, mono }: FieldProps) {
  const messages = customersMessages.detail
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>
        {value && value.trim().length > 0 ? value : messages.header.noValue}
      </dd>
    </div>
  )
}

interface FiscalChipProps {
  status: ReturnType<typeof customerFiscalStatus>['status']
  missing: ReturnType<typeof customerFiscalStatus>['missing']
}

function FiscalChip({ status, missing }: FiscalChipProps) {
  const messages = customersMessages.detail.fiscal
  if (status === 'no-customer') return null
  if (status === 'complete') {
    return (
      <Badge variant="default" className="gap-1" data-testid="customer-detail-fiscal-complete">
        <CheckCircle2 aria-hidden className="size-3" />
        {messages.complete}
      </Badge>
    )
  }
  const missingLabels = missing
    .map((field) => CUSTOMER_FISCAL_FIELD_LABELS[field])
    .filter(Boolean)
    .join(', ')
  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant="outline"
        className="w-fit gap-1 border-amber-500/60 text-amber-700 dark:text-amber-500"
        data-testid="customer-detail-fiscal-incomplete"
      >
        <AlertCircle aria-hidden className="size-3" />
        {messages.incomplete}
      </Badge>
      {missingLabels.length > 0 && (
        <p className="text-muted-foreground text-xs">{messages.incompleteMissing(missingLabels)}</p>
      )}
    </div>
  )
}

interface NotasSectionProps {
  customerId: string
  onOpenNote: (noteId: string) => void
}

function NotasSection({ customerId, onOpenNote }: NotasSectionProps) {
  const messages = customersMessages.detail.notas
  const [page, setPage] = useState(0)

  const { data, isPending, isError } = useSalesNotesPaged({
    customerId,
    page,
    pageSize: SECTION_PAGE_SIZE,
  })

  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / SECTION_PAGE_SIZE))
  const isLastPage = page >= totalPages - 1

  // Memo off data.rows directly — an `?? []` fallback allocates a new
  // empty array each render and invalidates downstream memos.
  const vendorIds = useMemo(
    () =>
      (data?.rows ?? [])
        .map((row) => row.vendor_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    [data?.rows]
  )
  const { data: vendorNames } = useVendorsByIds(vendorIds)
  const rows = data?.rows ?? []

  return (
    <section className="space-y-3" data-testid="customer-detail-notas">
      <h2 className="text-lg font-semibold tracking-tight">{messages.title}</h2>

      {isPending && <ListLoadingCard skeleton={{ rows: 5, columns: 6 }} />}
      {isError && <ListErrorCard title={messages.loadError} />}
      {!isPending && !isError && rows.length === 0 && <ListEmptyCard message={messages.empty} />}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.folio}</TableHead>
                <TableHead>{messages.columns.date}</TableHead>
                <TableHead className="text-right">{messages.columns.total}</TableHead>
                <TableHead className="text-right">{messages.columns.saldo}</TableHead>
                <TableHead>{messages.columns.vendor}</TableHead>
                <TableHead>{messages.columns.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((note) => (
                <NotaRow
                  key={note.id}
                  note={note}
                  vendorLabel={
                    note.vendor_id
                      ? (vendorNames?.get(note.vendor_id) ?? '…')
                      : messages.sinVendedor
                  }
                  onOpen={() => onOpenNote(note.id)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isPending && !isError && totalCount > 0 && (
        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          shownCount={rows.length}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => (isLastPage ? p : p + 1))}
          messages={{
            resultCount: messages.resultCount,
            pageOf: messages.pageOf,
            previous: messages.previous,
            next: messages.next,
          }}
          testIds={{
            count: 'customer-detail-notas-count',
            prev: 'customer-detail-notas-prev',
            next: 'customer-detail-notas-next',
          }}
        />
      )}
    </section>
  )
}

interface NotaRowProps {
  note: SalesNote
  vendorLabel: string
  onOpen: () => void
}

function NotaRow({ note, vendorLabel, onOpen }: NotaRowProps) {
  const saldo = note.saldo_pendiente
  return (
    <TableRow
      className="hover:bg-accent/30 cursor-pointer"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
      data-testid={`customer-detail-nota-row-${note.id}`}
    >
      <TableCell className="font-mono text-sm font-medium">{note.folio}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDateTime(note.created_at)}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatMXN(Number(note.total))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {saldo === null || saldo === undefined ? '—' : formatMXN(Number(saldo))}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{vendorLabel}</TableCell>
      <TableCell>
        <Badge variant={salesNoteStatusVariant(note.status as SalesNoteStatus)}>
          {SALES_NOTE_STATUS_LABELS[note.status as SalesNoteStatus]}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

interface OrdenesSectionProps {
  customerId: string
  onOpenOrder: (orderId: string) => void
}

function OrdenesSection({ customerId, onOpenOrder }: OrdenesSectionProps) {
  const messages = customersMessages.detail.ordenes
  const [page, setPage] = useState(0)

  const { data, isPending, isError } = useWorkOrdersPaged({
    customerId,
    page,
    pageSize: SECTION_PAGE_SIZE,
  })

  const rows = data?.rows ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / SECTION_PAGE_SIZE))
  const isLastPage = page >= totalPages - 1

  return (
    <section className="space-y-3" data-testid="customer-detail-ordenes">
      <h2 className="text-lg font-semibold tracking-tight">{messages.title}</h2>

      {isPending && <ListLoadingCard skeleton={{ rows: 5, columns: 5 }} />}
      {isError && <ListErrorCard title={messages.loadError} />}
      {!isPending && !isError && rows.length === 0 && <ListEmptyCard message={messages.empty} />}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.folio}</TableHead>
                <TableHead>{messages.columns.status}</TableHead>
                <TableHead>{messages.columns.priority}</TableHead>
                <TableHead>{messages.columns.promisedAt}</TableHead>
                <TableHead>{messages.columns.updatedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <OrderRow key={order.id} order={order} onOpen={() => onOpenOrder(order.id)} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isPending && !isError && totalCount > 0 && (
        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          shownCount={rows.length}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => (isLastPage ? p : p + 1))}
          messages={{
            resultCount: messages.resultCount,
            pageOf: messages.pageOf,
            previous: messages.previous,
            next: messages.next,
          }}
          testIds={{
            count: 'customer-detail-ordenes-count',
            prev: 'customer-detail-ordenes-prev',
            next: 'customer-detail-ordenes-next',
          }}
        />
      )}
    </section>
  )
}

interface OrderRowProps {
  order: WorkOrderListRow
  onOpen: () => void
}

function OrderRow({ order, onOpen }: OrderRowProps) {
  const messages = customersMessages.detail.ordenes
  const status = order.status as WorkOrderStatus
  const cancelled = order.cancelled_at !== null

  return (
    <TableRow
      className="hover:bg-accent/30 cursor-pointer"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
      data-testid={`customer-detail-orden-row-${order.id}`}
    >
      <TableCell
        className={
          cancelled ? 'font-mono text-sm font-medium line-through' : 'font-mono text-sm font-medium'
        }
      >
        {order.folio}
      </TableCell>
      <TableCell>
        {cancelled ? (
          <Badge variant="destructive">{messages.cancelledLabel}</Badge>
        ) : (
          <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>
        )}
      </TableCell>
      <TableCell>
        {order.priority === 'urgente' ? (
          <Badge variant="destructive">{messages.priorityUrgente}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{messages.priorityNormal}</span>
        )}
      </TableCell>
      <TableCell className="text-sm tabular-nums">{formatDate(order.promised_at)}</TableCell>
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {formatDateTime(order.updated_at)}
      </TableCell>
    </TableRow>
  )
}
