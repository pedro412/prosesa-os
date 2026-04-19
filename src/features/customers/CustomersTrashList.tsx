import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, RotateCcw, Search } from 'lucide-react'

import {
  ListEmptyCard,
  ListErrorCard,
  ListLoadingCard,
  ListPagination,
} from '@/components/layout/list-primitives'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

      {isPending && <ListLoadingCard skeleton={{ rows: PAGE_SIZE, columns: 5 }} />}

      {isError && (
        <ListErrorCard title={messages.list.loadError} description={messages.toast.genericError} />
      )}

      {!isPending && !isError && rows.length === 0 && (
        <ListEmptyCard
          message={search.trim().length > 0 ? messages.trash.emptySearch : messages.trash.empty}
        />
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
        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          shownCount={rows.length}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => (isLastPage ? p : p + 1))}
          messages={{
            resultCount: messages.list.resultCount,
            pageOf: messages.list.pageOf,
            previous: messages.list.previous,
            next: messages.list.next,
          }}
          testIds={{
            count: 'customers-trash-count',
            prev: 'customers-trash-prev',
            next: 'customers-trash-next',
          }}
        />
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
