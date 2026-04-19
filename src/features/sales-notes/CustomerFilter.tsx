import { useDeferredValue, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomer, useCustomers } from '@/lib/queries/customers'
import { cn } from '@/lib/utils'

import { salesNotesMessages } from './messages'

interface CustomerFilterProps {
  value: string | null
  onChange: (customerId: string | null) => void
}

// Typeahead combobox for the history-view "Cliente" filter. Mirrors
// the POS CustomerSelect's debounce + ≥2-char gate, but scopes the
// output to emitting an id (filter surface), not a full Customer row
// (form surface). No quick-add affordance — filtering a history
// view should never create a customer.
export function CustomerFilter({ value, onChange }: CustomerFilterProps) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const selected = useCustomer(value ?? undefined)

  const { data: results, isFetching } = useCustomers({
    search: deferredSearch.length >= 2 ? deferredSearch : undefined,
  })

  const showingResults = !value && deferredSearch.length >= 2
  const resultRows = showingResults ? (results ?? []).slice(0, 6) : []
  const messages = salesNotesMessages

  if (value && selected.data) {
    return (
      <div
        className="border-input bg-card flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
        data-testid="sales-notes-customer-filter-selected"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{selected.data.nombre}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={messages.filters.customerAll}
          onClick={() => {
            onChange(null)
            setSearch('')
          }}
          data-testid="sales-notes-customer-filter-clear"
        >
          <X aria-hidden className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={messages.filters.customerPlaceholder}
        autoComplete="off"
        data-testid="sales-notes-customer-filter-search"
      />
      {showingResults && (
        <div
          className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md"
          data-testid="sales-notes-customer-filter-results"
        >
          {isFetching && resultRows.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">…</p>
          )}
          {!isFetching && resultRows.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">{messages.list.emptyFiltered}</p>
          )}
          {resultRows.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                'hover:bg-accent flex w-full flex-col items-start gap-0 px-3 py-2 text-left text-sm',
                'border-b last:border-b-0'
              )}
              onClick={() => {
                onChange(customer.id)
                setSearch('')
              }}
              data-testid={`sales-notes-customer-filter-option-${customer.id}`}
            >
              <div className="truncate font-medium">{customer.nombre}</div>
              {(customer.rfc || customer.telefono) && (
                <div className="text-muted-foreground truncate text-xs">
                  {[customer.rfc, customer.telefono].filter(Boolean).join(' · ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
