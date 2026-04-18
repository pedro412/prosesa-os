import { useDeferredValue, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMXN } from '@/lib/format'
import { type CatalogItem, useItems } from '@/lib/queries/catalog'
import { cn } from '@/lib/utils'

import { posMessages } from './messages'

interface CatalogSearchPanelProps {
  disabled?: boolean
  onAdd: (item: CatalogItem) => void
}

const MAX_RESULTS = 10

// Catalog search: debounced via React 19's `useDeferredValue`, no timer
// plumbing needed. Shows up to 10 matches. Enter on the input adds the
// top match. After each add the input clears and focus returns — the
// operator's hands stay on the keyboard.
export function CatalogSearchPanel({ disabled, onAdd }: CatalogSearchPanelProps) {
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch only when the user has typed ≥2 chars. Below that, the ILIKE
  // substring match is a fire-hose — TanStack Query will memoize 0-char
  // runs, but 1-char queries are still expensive and noisy.
  const {
    data: items,
    isFetching,
    isError,
  } = useItems({
    search: deferred.length >= 2 ? deferred : undefined,
  })

  const showingResults = deferred.length >= 2
  const results = showingResults ? (items ?? []).slice(0, MAX_RESULTS) : []

  function pick(item: CatalogItem) {
    onAdd(item)
    setSearch('')
    inputRef.current?.focus()
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (results.length > 0) pick(results[0])
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="pos-catalog-search">{posMessages.search.label}</Label>
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id="pos-catalog-search"
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder={posMessages.search.placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-9"
          data-testid="pos-catalog-search"
        />
      </div>
      {showingResults && (
        <p className="text-muted-foreground text-xs">{posMessages.search.pickHint}</p>
      )}

      {isError && <p className="text-destructive text-sm">{posMessages.search.error}</p>}

      {showingResults && (
        <div
          className="divide-y rounded-md border"
          data-testid="pos-catalog-results"
          role="listbox"
        >
          {isFetching && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">{posMessages.search.loading}</p>
          )}
          {!isFetching && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">{posMessages.search.empty}</p>
          )}
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className={cn(
                'hover:bg-accent flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                idx === 0 && 'bg-accent/40'
              )}
              data-testid={`pos-catalog-result-${item.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {item.unit}
                  {item.pricing_mode === 'variable' ? ' · precio variable' : ''}
                </div>
              </div>
              <div className="tabular-nums">
                {item.pricing_mode === 'variable' ? '—' : formatMXN(Number(item.price))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
