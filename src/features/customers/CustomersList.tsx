import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Search, Trash, Trash2 } from 'lucide-react'

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
import { isAdmin, useCurrentProfile } from '@/lib/queries/profiles'

import { CustomerDeleteDialog } from './CustomerDeleteDialog'
import { CustomerFormDialog } from './CustomerFormDialog'
import { customersMessages } from './messages'

const PAGE_SIZE = 10

export function CustomersList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)

  const profile = useCurrentProfile()
  const admin = isAdmin(profile.data)

  const { data, isPending, isError } = useCustomersPaged({
    search,
    page,
    pageSize: PAGE_SIZE,
  })

  const messages = customersMessages

  // Reset to page 0 when the search input changes. A change handler
  // could live next to the input, but centralizing it here keeps the
  // pagination invariant obvious.
  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rows = data?.rows ?? []
  const isLastPage = page >= totalPages - 1

  return (
    <div className="space-y-6" data-testid="customers-list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{messages.page.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {admin && (
            <Button asChild variant="outline" data-testid="customers-trash-link">
              <Link to="/customers/papelera">
                <Trash aria-hidden className="size-4" />
                {messages.page.trashButton}
              </Link>
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} data-testid="customer-create-button">
            <Plus aria-hidden className="size-4" />
            {messages.page.newButton}
          </Button>
        </div>
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
          data-testid="customers-search"
        />
      </div>

      {isPending && <ListLoadingCard skeleton={{ rows: PAGE_SIZE, columns: 5 }} />}

      {isError && (
        <ListErrorCard title={messages.list.loadError} description={messages.toast.genericError} />
      )}

      {!isPending && !isError && rows.length === 0 && (
        <ListEmptyCard
          message={search.trim().length > 0 ? messages.list.emptySearch : messages.list.empty}
        />
      )}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.nombre}</TableHead>
                <TableHead>{messages.columns.rfc}</TableHead>
                <TableHead>{messages.columns.telefono}</TableHead>
                <TableHead>{messages.columns.email}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  admin={admin}
                  onEdit={() => setEditing(customer)}
                  onDelete={() => setDeleting(customer)}
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
          testIds={{ count: 'customers-count', prev: 'customers-prev', next: 'customers-next' }}
        />
      )}

      <CustomerFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onRequestEditExisting={(existing) => {
          // User hit a duplicate on create — jump to the colliding
          // row's edit dialog so they can update it instead of fighting
          // the unique constraint.
          setCreateOpen(false)
          setEditing(existing)
        }}
      />

      <CustomerFormDialog
        mode="edit"
        customer={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onRequestEditExisting={(existing) => {
          // Same collision UX when editing: swap the dialog contents
          // to the actual owner of the conflicting field.
          setEditing(existing)
        }}
      />

      <CustomerDeleteDialog
        customer={deleting}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      />
    </div>
  )
}

interface CustomerRowProps {
  customer: Customer
  admin: boolean
  onEdit: () => void
  onDelete: () => void
}

function CustomerRow({ customer, admin, onEdit, onDelete }: CustomerRowProps) {
  const messages = customersMessages

  return (
    <TableRow data-testid={`customer-row-${customer.id}`}>
      <TableCell className="font-medium">{customer.nombre}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-xs">
        {customer.rfc ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">{customer.telefono ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{customer.email ?? '—'}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            data-testid={`customer-edit-${customer.id}`}
          >
            {messages.actions.edit}
          </Button>
          {admin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={messages.actions.delete}
              data-testid={`customer-delete-${customer.id}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
