import { useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Eye, Plus, Search } from 'lucide-react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMXN } from '@/lib/format'
import { isTodayMX, isYesterdayMX } from '@/lib/mx-date'
import { useCompanies } from '@/lib/queries/companies'
import { useCustomersByIds } from '@/lib/queries/customers'
import { usePaymentsByNote, type PaymentMethod } from '@/lib/queries/payments'
import { type SalesNote, type SalesNoteStatus, useSalesNotesPaged } from '@/lib/queries/sales-notes'

import { CustomerFilter } from './CustomerFilter'
import { salesNotesMessages } from './messages'
import { SalesNoteDetailDrawer } from './SalesNoteDetailDrawer'

const PAGE_SIZE = 25

const STATUS_OPTIONS: SalesNoteStatus[] = ['pagada', 'pendiente', 'abonada', 'cancelada']
const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta']

// Sentinel value used by the shadcn Select to represent "no filter".
// Radix Select doesn't accept an empty-string value, and undefined is
// reserved for the controlled-component initial state.
const ALL = '__all__'

const fullDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

// Row-scan–friendly date label. Collapses same-day rows to "Hoy
// 14:32" and yesterday's rows to "Ayer 14:32" so the operator can
// pick out today's sales without reading the date portion. Older
// rows fall back to the full DD/MM/YYYY HH:MM stamp.
function formatRowDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (isTodayMX(iso)) return `${salesNotesMessages.list.today} ${timeFormatter.format(d)}`
  if (isYesterdayMX(iso)) return `${salesNotesMessages.list.yesterday} ${timeFormatter.format(d)}`
  return fullDateFormatter.format(d)
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

// The route owns the search-params schema; we read it via the route
// api so this feature component stays decoupled from the file-based
// route path string beyond this single call.
const routeApi = getRouteApi('/_app/sales-notes')

export function SalesNotesList() {
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/sales-notes' })

  // Filter-bar inputs are driven off the URL; writes navigate with
  // the merged search object. `page=0` is applied on any filter
  // change so the operator doesn't land on an empty page that no
  // longer exists in the reduced result set.
  type SearchShape = typeof search

  function updateSearch(patch: Partial<SearchShape>) {
    navigate({
      to: '/sales-notes',
      search: (prev) => ({ ...prev, ...patch, page: 0 }),
      replace: true,
    })
  }

  function updatePage(nextPage: number) {
    navigate({
      to: '/sales-notes',
      search: (prev) => ({ ...prev, page: nextPage }),
      replace: true,
    })
  }

  const { data: companies } = useCompanies({ includeInactive: true })
  const companyMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const company of companies ?? []) {
      map.set(company.id, { code: company.code, name: company.nombre_comercial })
    }
    return map
  }, [companies])

  const { data, isPending, isError } = useSalesNotesPaged({
    companyId: search.companyId,
    status: search.status,
    paymentMethod: search.paymentMethod,
    customerId: search.customerId,
    from: search.from,
    to: search.to,
    search: search.q,
    page: search.page ?? 0,
    pageSize: PAGE_SIZE,
  })

  const totalCount = data?.totalCount ?? 0
  const page = search.page ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const isLastPage = page >= totalPages - 1

  // Memo off data.rows directly so the empty-fallback doesn't
  // allocate a fresh array and re-trigger the downstream memo on
  // every render.
  const customerIds = useMemo(
    () =>
      (data?.rows ?? []).map((row) => row.customer_id).filter((id): id is string => id !== null),
    [data?.rows]
  )
  const { data: customerNames } = useCustomersByIds(customerIds)
  const rows = data?.rows ?? []

  const filtersApplied =
    !!search.companyId ||
    !!search.status ||
    !!search.paymentMethod ||
    !!search.customerId ||
    !!search.from ||
    !!search.to ||
    (search.q ?? '').trim().length > 0

  const messages = salesNotesMessages

  return (
    <div className="space-y-6" data-testid="sales-notes-list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{messages.page.description}</p>
        </div>
        <Button onClick={() => navigate({ to: '/pos' })} data-testid="sales-notes-new-button">
          <Plus aria-hidden className="size-4" />
          {messages.page.newButton}
        </Button>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="sn-from">{messages.filters.dateFromLabel}</Label>
            <Input
              id="sn-from"
              type="date"
              value={search.from ?? ''}
              onChange={(e) => updateSearch({ from: e.target.value || undefined })}
              data-testid="sales-notes-filter-from"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sn-to">{messages.filters.dateToLabel}</Label>
            <Input
              id="sn-to"
              type="date"
              value={search.to ?? ''}
              onChange={(e) => updateSearch({ to: e.target.value || undefined })}
              data-testid="sales-notes-filter-to"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sn-company">{messages.filters.companyLabel}</Label>
            <Select
              value={search.companyId ?? ALL}
              onValueChange={(value) =>
                updateSearch({ companyId: value === ALL ? undefined : value })
              }
            >
              <SelectTrigger id="sn-company" data-testid="sales-notes-filter-company">
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
            <Label htmlFor="sn-status">{messages.filters.statusLabel}</Label>
            <Select
              value={search.status ?? ALL}
              onValueChange={(value) =>
                updateSearch({
                  status: value === ALL ? undefined : (value as SalesNoteStatus),
                })
              }
            >
              <SelectTrigger id="sn-status" data-testid="sales-notes-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{messages.filters.statusAll}</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {messages.status[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sn-method">{messages.filters.paymentMethodLabel}</Label>
            <Select
              value={search.paymentMethod ?? ALL}
              onValueChange={(value) =>
                updateSearch({
                  paymentMethod: value === ALL ? undefined : (value as PaymentMethod),
                })
              }
            >
              <SelectTrigger id="sn-method" data-testid="sales-notes-filter-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{messages.filters.paymentMethodAll}</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {messages.paymentMethods[method]}
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sn-search">{messages.filters.searchLabel}</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                id="sn-search"
                value={search.q ?? ''}
                onChange={(e) => updateSearch({ q: e.target.value || undefined })}
                placeholder={messages.filters.searchPlaceholder}
                className="pl-9"
                data-testid="sales-notes-filter-search"
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
                    to: '/sales-notes',
                    search: { page: 0 },
                    replace: true,
                  })
                }
                data-testid="sales-notes-clear-filters"
              >
                {messages.filters.clear}
              </Button>
            </div>
          )}
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
                <TableHead>{messages.columns.date}</TableHead>
                <TableHead>{messages.columns.company}</TableHead>
                <TableHead>{messages.columns.customer}</TableHead>
                <TableHead className="text-right">{messages.columns.total}</TableHead>
                <TableHead>{messages.columns.status}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((note) => (
                <SalesNoteRow
                  key={note.id}
                  note={note}
                  companyLabel={companyMap.get(note.company_id)?.name ?? '—'}
                  customerLabel={
                    note.customer_id
                      ? (customerNames?.get(note.customer_id) ?? '…')
                      : messages.list.publicoEnGeneral
                  }
                  onOpen={() => updateSearch({ openId: note.id })}
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
            count: 'sales-notes-count',
            prev: 'sales-notes-prev',
            next: 'sales-notes-next',
          }}
        />
      )}

      <SalesNoteDetailDrawer
        noteId={search.openId ?? null}
        onClose={() =>
          navigate({
            to: '/sales-notes',
            search: (prev) => {
              const { openId: _openId, ...rest } = prev
              return rest
            },
            replace: true,
          })
        }
      />
    </div>
  )
}

interface SalesNoteRowProps {
  note: SalesNote
  companyLabel: string
  customerLabel: string
  onOpen: () => void
}

function SalesNoteRow({ note, companyLabel, customerLabel, onOpen }: SalesNoteRowProps) {
  // Per-row fetch of the note's payments just to compute a display
  // method chip. TanStack Query deduplicates across rows and the
  // detail drawer, so this stays a single cache entry per note.
  const { data: payments } = usePaymentsByNote(note.id)
  const methodLabel =
    payments && payments.length > 0
      ? payments.length === 1
        ? salesNotesMessages.paymentMethods[payments[0].method as PaymentMethod]
        : // Mixto sales span ≥2 methods; we surface "Mixto" rather
          // than picking one arbitrarily.
          'Mixto'
      : '—'

  return (
    <TableRow
      data-testid={`sales-note-row-${note.id}`}
      className="hover:bg-accent/30 cursor-pointer"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
    >
      <TableCell className="font-mono text-sm font-medium">{note.folio}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatRowDate(note.created_at)}
      </TableCell>
      <TableCell className="text-sm">{companyLabel}</TableCell>
      <TableCell className="text-sm">{customerLabel}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatMXN(Number(note.total))}
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(note.status as SalesNoteStatus)}>
          {salesNotesMessages.status[note.status as SalesNoteStatus]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-xs">{methodLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={salesNotesMessages.actions.view}
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            data-testid={`sales-note-view-${note.id}`}
          >
            <Eye aria-hidden className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
