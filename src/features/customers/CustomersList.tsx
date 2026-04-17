import { useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'

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
  const currentPageNumber = page + 1
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  return (
    <div className="space-y-6" data-testid="customers-list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{messages.page.description}</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="customer-create-button"
          className="shrink-0"
        >
          <Plus aria-hidden className="size-4" />
          {messages.page.newButton}
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
          data-testid="customers-search"
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
            {search.trim().length > 0 ? messages.list.emptySearch : messages.list.empty}
          </CardContent>
        </Card>
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
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-muted-foreground text-sm" data-testid="customers-count">
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
              data-testid="customers-prev"
            >
              {messages.list.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => (isLastPage ? p : p + 1))}
              disabled={isLastPage}
              data-testid="customers-next"
            >
              {messages.list.next}
            </Button>
          </div>
        </div>
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
