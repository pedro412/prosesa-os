import { useDeferredValue, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CustomerQuickAddDialog } from '@/features/customers/CustomerQuickAddDialog'
import { type Customer, useCustomers } from '@/lib/queries/customers'
import { cn } from '@/lib/utils'

import { posMessages } from './messages'

interface CustomerSelectProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  // Opens the shared edit dialog mounted by `PosPage`. Lifted there so
  // the fiscal-completeness warning banner can also trigger the same
  // dialog without routing through this component.
  onRequestEdit: () => void
}

// Optional customer picker for the POS form. Typeahead against the
// shared customers list, with "Nuevo" escape hatch for walk-ins we
// want to capture on the fly (reuses the existing CustomerQuickAddDialog
// from LIT-25). Leaving the field blank is valid — the printed ticket
// renders "Público en general" + the SAT generic RFC in that case
// (CLAUDE.md §7, fallback lives in the doc-render code, not here).
export function CustomerSelect({ value, onChange, onRequestEdit }: CustomerSelectProps) {
  const [search, setSearch] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // useDeferredValue debounces without touching timer APIs. The actual
  // query stays fresh while the input stays responsive — React 19
  // prioritizes the keystroke over the list re-render.
  const deferredSearch = useDeferredValue(search)

  // Only query once the user has typed ≥2 chars. Below that, the ILIKE
  // substring match would return half the customers table and the UI
  // would do nothing useful with it.
  const { data: results, isFetching } = useCustomers({
    search: deferredSearch.length >= 2 ? deferredSearch : undefined,
  })

  const showingResults = deferredSearch.length >= 2
  const resultRows = showingResults ? (results ?? []).slice(0, 6) : []

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="pos-customer-search">
          {posMessages.customer.label}{' '}
          <span className="text-muted-foreground text-xs font-normal">
            ({posMessages.customer.optional})
          </span>
        </Label>
        {value && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            onClick={() => {
              onChange(null)
              setSearch('')
            }}
            data-testid="pos-customer-clear"
          >
            {posMessages.customer.none}
          </button>
        )}
      </div>

      {value ? (
        <SelectedCustomer customer={value} onEdit={onRequestEdit} />
      ) : (
        <div className="flex gap-2">
          <Input
            id="pos-customer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={posMessages.customer.defaultPlaceholder}
            autoComplete="off"
            data-testid="pos-customer-search"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuickAddOpen(true)}
            data-testid="pos-customer-quick-add"
          >
            <Plus aria-hidden className="size-4" />
            {posMessages.customer.newButton}
          </Button>
        </div>
      )}

      {showingResults && !value && (
        <div className="rounded-md border" data-testid="pos-customer-results">
          {isFetching && resultRows.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              {posMessages.customer.loading}
            </p>
          )}
          {!isFetching && resultRows.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              {posMessages.customer.noResults}
            </p>
          )}
          {resultRows.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                'hover:bg-accent flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                'border-b last:border-b-0'
              )}
              onClick={() => {
                onChange(customer)
                setSearch('')
              }}
              data-testid={`pos-customer-result-${customer.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{customer.nombre}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {[customer.rfc, customer.telefono].filter(Boolean).join(' · ') ||
                    customer.email ||
                    ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CustomerQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialNombre={search}
        onCreated={(created) => {
          onChange(created)
          setSearch('')
          setQuickAddOpen(false)
        }}
      />
    </div>
  )
}

function SelectedCustomer({ customer, onEdit }: { customer: Customer; onEdit: () => void }) {
  const meta = [customer.rfc, customer.telefono, customer.email].filter(Boolean).join(' · ') || null

  return (
    <div
      className="border-input bg-card flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
      data-testid="pos-customer-selected"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{customer.nombre}</div>
        {meta && <div className="text-muted-foreground truncate text-xs">{meta}</div>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0"
        onClick={onEdit}
        aria-label={posMessages.customer.editAria}
        data-testid="pos-customer-edit"
      >
        <Pencil aria-hidden className="size-4" />
      </Button>
    </div>
  )
}
