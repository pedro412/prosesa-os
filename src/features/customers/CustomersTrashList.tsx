import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, RotateCcw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Customer, useCustomersPaged } from '@/lib/queries/customers'

import { CustomerRestoreDialog } from './CustomerRestoreDialog'
import { customersMessages } from './messages'

const PAGE_SIZE = 10

// Papelera view for soft-deleted customers (LIT-83). Admin-only via
// the route guard in customers.papelera.tsx; RLS rejects the query
// for ventas callers regardless.
export function CustomersTrashList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [restoring, setRestoring] = useState<Customer | null>(null)

  const { data, isPending, isError } = useCustomersPaged({
    search,
    page,
    pageSize: PAGE_SIZE,
    onlyDeleted: true,
  })

  const messages = customersMessages

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rows = data?.rows ?? []
  const currentPageNumber = page + 1
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  return (
    <div className="space-y-6" data-testid="customers-trash-list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.trash.title}</h1>
          <p className="text-muted-foreground text-sm">{messages.trash.description}</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/customers" data-testid="customers-trash-back">
            <ArrowLeft aria-hidden className="size-4" />
            {messages.trash.backButton}
          </Link>
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={messages.search.placeholder}
          aria-label={messages.search.ariaLabel}
          className="pl-9"
          data-testid="customers-trash-search"
        />
      </div>

      {isPending && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {messages.list.loading}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardHeader>
            <CardTitle>{messages.list.loadError}</CardTitle>
            <CardDescription>{messages.toast.genericError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isPending && !isError && rows.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {search.trim().length > 0 ? messages.trash.emptySearch : messages.trash.empty}
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.nombre}</TableHead>
                <TableHead>{messages.columns.telefono}</TableHead>
                <TableHead>{messages.columns.email}</TableHead>
                <TableHead>{messages.trash.columnDeletedAt}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((customer) => (
                <TrashedCustomerRow
                  key={customer.id}
                  customer={customer}
                  onRestore={() => setRestoring(customer)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isPending && !isError && totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-muted-foreground text-sm" data-testid="customers-trash-count">
            {messages.list.resultCount(rows.length, totalCount)}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-sm tabular-nums">
              {messages.list.pageOf(currentPageNumber, totalPages)}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={isFirstPage}
              data-testid="customers-trash-prev"
            >
              {messages.list.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => (isLastPage ? p : p + 1))}
              disabled={isLastPage}
              data-testid="customers-trash-next"
            >
              {messages.list.next}
            </Button>
          </div>
        </div>
      )}

      <CustomerRestoreDialog
        customer={restoring}
        open={restoring !== null}
        onOpenChange={(open) => {
          if (!open) setRestoring(null)
        }}
      />
    </div>
  )
}

interface TrashedCustomerRowProps {
  customer: Customer
  onRestore: () => void
}

// Timezone-aware formatter per CLAUDE.md §4 rule 10. Kept inline —
// we only format deleted_at here, no general date helper needed yet.
const deletedAtFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
})

function TrashedCustomerRow({ customer, onRestore }: TrashedCustomerRowProps) {
  const deletedAt = customer.deleted_at
    ? deletedAtFormatter.format(new Date(customer.deleted_at))
    : '—'

  return (
    <TableRow data-testid={`customer-trash-row-${customer.id}`}>
      <TableCell className="font-medium">{customer.nombre}</TableCell>
      <TableCell className="text-muted-foreground">{customer.telefono}</TableCell>
      <TableCell className="text-muted-foreground">{customer.email ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground text-xs tabular-nums">{deletedAt}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={onRestore}
          data-testid={`customer-restore-${customer.id}`}
        >
          <RotateCcw aria-hidden className="size-4" />
          {customersMessages.trash.restoreButton}
        </Button>
      </TableCell>
    </TableRow>
  )
}
