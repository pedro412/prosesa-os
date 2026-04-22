import { useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'

import {
  ListEmptyCard,
  ListErrorCard,
  ListLoadingCard,
  ListPagination,
} from '@/components/layout/list-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CustomerFilter } from '@/features/sales-notes/CustomerFilter'
import { cn } from '@/lib/utils'
import { formatMXN } from '@/lib/format'
import { useCompanies } from '@/lib/queries/companies'
import {
  type WorkOrderDateField,
  type WorkOrderListRow,
  type WorkOrderPriority,
  type WorkOrderStatus,
  useWorkOrdersPaged,
} from '@/lib/queries/work-orders'

import { workOrdersMessages } from './messages'
import {
  type DeltaTone,
  STATUS_LABELS,
  STATUS_ORDER,
  isOverdue,
  promisedDelta,
  statusBadgeVariant,
} from './status-metadata'
import { WorkOrderRowMenu } from './WorkOrderRowMenu'

const PAGE_SIZE = 25

// Sentinel for "all / no filter" — Radix Select disallows empty-string
// values (matches the SalesNotesList convention).
const ALL = '__all__'

const PRIORITY_OPTIONS: WorkOrderPriority[] = ['normal', 'urgente']
const DATE_FIELD_OPTIONS: WorkOrderDateField[] = ['created', 'promised']

// Route id is the index child (`/work-orders/`), not the layout parent —
// the search-params schema lives on the index file.
const routeApi = getRouteApi('/_app/work-orders/')

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

function formatDate(iso: string | null): string {
  if (!iso) return workOrdersMessages.row.noPromisedDate
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return workOrdersMessages.row.noPromisedDate
  return dateFormatter.format(d)
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFormatter.format(d)
}

// Maps promisedDelta tone to a Tailwind text class. Kept here (not in
// status-metadata) because the metadata module is view-agnostic; only
// the list surface knows about Tailwind tokens.
function deltaToneClass(tone: DeltaTone): string {
  switch (tone) {
    case 'overdue':
      return 'text-destructive font-medium'
    case 'urgent':
      return 'text-destructive font-medium'
    case 'soon':
      return 'text-amber-600 dark:text-amber-500'
    case 'later':
      return 'text-muted-foreground'
    case 'done':
      return 'text-muted-foreground'
  }
}

export function WorkOrdersList() {
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/work-orders' })

  type SearchShape = typeof search

  function updateSearch(patch: Partial<SearchShape>) {
    navigate({
      to: '/work-orders',
      search: (prev) => ({ ...prev, ...patch, page: 0 }),
      replace: true,
    })
  }

  function updatePage(nextPage: number) {
    navigate({
      to: '/work-orders',
      search: (prev) => ({ ...prev, page: nextPage }),
      replace: true,
    })
  }

  function toggleStatusChip(status: WorkOrderStatus) {
    const current = search.statuses ?? []
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    updateSearch({ statuses: next.length > 0 ? next : undefined })
  }

  const { data: companies } = useCompanies({ includeInactive: true })
  const companyMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const company of companies ?? []) {
      map.set(company.id, { code: company.code, name: company.nombre_comercial })
    }
    return map
  }, [companies])

  const { data, isPending, isError } = useWorkOrdersPaged({
    companyId: search.companyId,
    statuses: search.statuses,
    priority: search.priority,
    customerId: search.customerId,
    dateField: search.dateField,
    from: search.from,
    to: search.to,
    overdueOnly: search.overdueOnly,
    search: search.q,
    page: search.page ?? 0,
    pageSize: PAGE_SIZE,
  })

  const totalCount = data?.totalCount ?? 0
  const page = search.page ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const isLastPage = page >= totalPages - 1
  const rows = data?.rows ?? []

  const activeStatuses = search.statuses ?? []
  const filtersApplied =
    !!search.companyId ||
    activeStatuses.length > 0 ||
    !!search.priority ||
    !!search.customerId ||
    !!search.from ||
    !!search.to ||
    !!search.overdueOnly ||
    (search.q ?? '').trim().length > 0

  const messages = workOrdersMessages

  return (
    <div className="space-y-6" data-testid="work-orders-list">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.page.title}</h1>
        <p className="text-muted-foreground text-sm">{messages.page.description}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Status chips — toggleable `Badge`s so we reuse the existing
           *   primitive instead of adding a multi-select. Operators scan
           *   by flow state; showing every status as a chip gives a
           *   single-click filter without hiding options in a dropdown. */}
          <div className="space-y-1.5">
            <Label>{messages.filters.statusLabel}</Label>
            <div className="flex flex-wrap gap-2" data-testid="work-orders-filter-statuses">
              <StatusChip
                selected={activeStatuses.length === 0}
                label={messages.filters.statusAll}
                onClick={() => updateSearch({ statuses: undefined })}
                testId="work-orders-status-chip-all"
              />
              {STATUS_ORDER.map((status) => (
                <StatusChip
                  key={status}
                  selected={activeStatuses.includes(status)}
                  label={STATUS_LABELS[status]}
                  onClick={() => toggleStatusChip(status)}
                  testId={`work-orders-status-chip-${status}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="wo-company">{messages.filters.companyLabel}</Label>
              <Select
                value={search.companyId ?? ALL}
                onValueChange={(value) =>
                  updateSearch({ companyId: value === ALL ? undefined : value })
                }
              >
                <SelectTrigger id="wo-company" data-testid="work-orders-filter-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{messages.filters.companyAll}</SelectItem>
                  {(companies ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.code} · {company.nombre_comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-priority">{messages.filters.priorityLabel}</Label>
              <Select
                value={search.priority ?? ALL}
                onValueChange={(value) =>
                  updateSearch({
                    priority: value === ALL ? undefined : (value as WorkOrderPriority),
                  })
                }
              >
                <SelectTrigger id="wo-priority" data-testid="work-orders-filter-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{messages.filters.priorityAll}</SelectItem>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {messages.filters.priorityOptions[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{messages.filters.customerLabel}</Label>
              <CustomerFilter
                value={search.customerId ?? null}
                onChange={(id) => updateSearch({ customerId: id ?? undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-date-field">{messages.filters.dateFieldLabel}</Label>
              <Select
                value={search.dateField ?? 'created'}
                onValueChange={(value) => updateSearch({ dateField: value as WorkOrderDateField })}
              >
                <SelectTrigger id="wo-date-field" data-testid="work-orders-filter-date-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FIELD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {messages.filters.dateFieldOptions[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-from">{messages.filters.dateFromLabel}</Label>
              <Input
                id="wo-from"
                type="date"
                value={search.from ?? ''}
                onChange={(e) => updateSearch({ from: e.target.value || undefined })}
                data-testid="work-orders-filter-from"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-to">{messages.filters.dateToLabel}</Label>
              <Input
                id="wo-to"
                type="date"
                value={search.to ?? ''}
                onChange={(e) => updateSearch({ to: e.target.value || undefined })}
                data-testid="work-orders-filter-to"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-1">
              <Label htmlFor="wo-overdue" className="text-sm font-normal leading-tight">
                {messages.filters.overdueOnlyLabel}
              </Label>
              <Switch
                id="wo-overdue"
                checked={!!search.overdueOnly}
                onCheckedChange={(checked) => updateSearch({ overdueOnly: checked || undefined })}
                data-testid="work-orders-filter-overdue"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wo-search">{messages.filters.searchLabel}</Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <Input
                  id="wo-search"
                  value={search.q ?? ''}
                  onChange={(e) => updateSearch({ q: e.target.value || undefined })}
                  placeholder={messages.filters.searchPlaceholder}
                  className="pl-9"
                  data-testid="work-orders-filter-search"
                />
              </div>
            </div>

            {filtersApplied && (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: '/work-orders',
                      search: { page: 0 },
                      replace: true,
                    })
                  }
                  data-testid="work-orders-clear-filters"
                >
                  {messages.filters.clear}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isPending && <ListLoadingCard skeleton={{ rows: PAGE_SIZE, columns: 7 }} />}

      {isError && <ListErrorCard title={messages.list.loadError} />}

      {!isPending && !isError && rows.length === 0 && (
        <ListEmptyCard
          message={filtersApplied ? messages.list.emptyFiltered : messages.list.empty}
        />
      )}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.folio}</TableHead>
                <TableHead>{messages.columns.customer}</TableHead>
                <TableHead>{messages.columns.status}</TableHead>
                <TableHead>{messages.columns.priority}</TableHead>
                <TableHead>{messages.columns.promisedAt}</TableHead>
                <TableHead className="text-right">{messages.columns.saldo}</TableHead>
                <TableHead>{messages.columns.updatedAt}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <WorkOrderRow
                  key={order.id}
                  order={order}
                  companyLabel={companyMap.get(order.company_id)?.name ?? '—'}
                  onOpen={() => navigate({ to: `/work-orders/${order.id}` })}
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
          onPrev={() => updatePage(Math.max(0, page - 1))}
          onNext={() => updatePage(isLastPage ? page : page + 1)}
          messages={{
            resultCount: messages.list.resultCount,
            pageOf: messages.list.pageOf,
            previous: messages.list.previous,
            next: messages.list.next,
          }}
          testIds={{
            count: 'work-orders-count',
            prev: 'work-orders-prev',
            next: 'work-orders-next',
          }}
        />
      )}
    </div>
  )
}

interface StatusChipProps {
  selected: boolean
  label: string
  onClick: () => void
  testId?: string
}

function StatusChip({ selected, label, onClick, testId }: StatusChipProps) {
  return (
    <Badge
      asChild
      variant={selected ? 'default' : 'outline'}
      className={cn(
        'cursor-pointer select-none',
        !selected && 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={selected} data-testid={testId}>
        {label}
      </button>
    </Badge>
  )
}

interface WorkOrderRowProps {
  order: WorkOrderListRow
  companyLabel: string
  onOpen: () => void
}

function WorkOrderRow({ order, companyLabel: _companyLabel, onOpen }: WorkOrderRowProps) {
  const status = order.status as WorkOrderStatus
  const overdue = isOverdue({
    promised_at: order.promised_at,
    status: order.status,
    cancelled_at: order.cancelled_at,
  })
  const cancelled = order.cancelled_at !== null
  const saldo = order.sales_note?.saldo_pendiente
  const customerName = order.customer?.nombre ?? workOrdersMessages.row.noCustomer

  return (
    <TableRow
      data-testid={`work-order-row-${order.id}`}
      aria-label={overdue ? workOrdersMessages.row.overdueAriaLabel : undefined}
      className={cn(
        'hover:bg-accent/30 cursor-pointer',
        overdue && 'bg-destructive/5 hover:bg-destructive/10',
        cancelled && 'text-muted-foreground opacity-70'
      )}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
    >
      <TableCell className={cn('font-mono text-sm font-medium', cancelled && 'line-through')}>
        {order.folio}
      </TableCell>
      <TableCell className="text-sm">{customerName}</TableCell>
      <TableCell>
        {cancelled ? (
          <Badge variant="destructive">{workOrdersMessages.row.cancelledLabel}</Badge>
        ) : (
          <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>
        )}
      </TableCell>
      <TableCell>
        {order.priority === 'urgente' ? (
          <Badge variant="destructive">{workOrdersMessages.priority.urgente}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">
            {workOrdersMessages.priority.normal}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        <div className="flex flex-col leading-tight">
          <span>{formatDate(order.promised_at)}</span>
          {(() => {
            const delta = promisedDelta({
              promised_at: order.promised_at,
              status: order.status,
              cancelled_at: order.cancelled_at,
            })
            if (!delta) return null
            return (
              <span
                className={cn('text-xs', deltaToneClass(delta.tone))}
                data-testid={`work-order-delta-${order.id}`}
              >
                {delta.label}
              </span>
            )
          })()}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {saldo !== null && saldo !== undefined
          ? formatMXN(Number(saldo))
          : workOrdersMessages.row.noSaldo}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {formatDateTime(order.updated_at)}
      </TableCell>
      <TableCell className="text-right">
        <WorkOrderRowMenu
          workOrderId={order.id}
          status={status}
          saldoPendiente={
            order.sales_note?.saldo_pendiente !== null &&
            order.sales_note?.saldo_pendiente !== undefined
              ? Number(order.sales_note.saldo_pendiente)
              : null
          }
          cancelled={cancelled}
          onOpenDetail={onOpen}
        />
      </TableCell>
    </TableRow>
  )
}
