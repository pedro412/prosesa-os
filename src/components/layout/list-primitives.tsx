import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

// Shared building blocks for list views (customers, sales-notes,
// catalog items/categories, users settings). Extracted in LIT-88 —
// before, every list hand-rolled the same `<Card><CardContent .../>
// </Card>` loading card, error card, empty card, and pagination bar.
// Primitive-level theming already flowed through Tailwind tokens;
// these cover the structural shape so a tweak (skeleton state, empty
// padding, pagination layout) lands once.
//
// Kept message-agnostic: callers pass copy directly so the primitive
// doesn't know about `customersMessages`, `salesNotesMessages`, etc.

interface ListLoadingCardProps {
  // Non-skeleton fallback label — shown when a caller doesn't provide
  // a `skeleton` shape (e.g., a non-table surface or mid-refactor).
  label?: string
  // When provided, renders ghost `<TableRow>`s matching the column
  // count so the layout doesn't snap tall→short when real rows
  // arrive. `rows` should match the caller's page size.
  skeleton?: { rows: number; columns: number }
}

export function ListLoadingCard({ label, skeleton }: ListLoadingCardProps) {
  if (skeleton) {
    return (
      <Card>
        <Table>
          <TableBody>
            {Array.from({ length: skeleton.rows }, (_, rowIdx) => (
              <TableRow key={rowIdx} aria-hidden data-testid="list-skeleton-row">
                {Array.from({ length: skeleton.columns }, (_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="text-muted-foreground py-8 text-center text-sm">{label}</CardContent>
    </Card>
  )
}

interface ListErrorCardProps {
  title: string
  description?: string
}

export function ListErrorCard({ title, description }: ListErrorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
    </Card>
  )
}

interface ListEmptyCardProps {
  message: string
}

export function ListEmptyCard({ message }: ListEmptyCardProps) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-8 text-center text-sm">
        {message}
      </CardContent>
    </Card>
  )
}

interface ListPaginationProps {
  page: number
  totalPages: number
  totalCount: number
  shownCount: number
  onPrev: () => void
  onNext: () => void
  disabled?: boolean
  // Caller-owned copy. Kept as inline props (not a single nested
  // object) so a partial update at the call site is still type-safe.
  messages: {
    resultCount: (shown: number, total: number) => string
    pageOf: (current: number, total: number) => string
    previous: string
    next: string
  }
  // Optional testids so existing tests don't break on the retrofit.
  testIds?: {
    count?: string
    prev?: string
    next?: string
  }
}

export function ListPagination({
  page,
  totalPages,
  totalCount,
  shownCount,
  onPrev,
  onNext,
  disabled,
  messages,
  testIds,
}: ListPaginationProps) {
  const currentPageNumber = page + 1
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  return (
    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
      <p className="text-muted-foreground text-sm" data-testid={testIds?.count}>
        {messages.resultCount(shownCount, totalCount)}
      </p>
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-sm tabular-nums">
          {messages.pageOf(currentPageNumber, totalPages)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={isFirstPage || disabled}
          data-testid={testIds?.prev}
        >
          {messages.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={isLastPage || disabled}
          data-testid={testIds?.next}
        >
          {messages.next}
        </Button>
      </div>
    </div>
  )
}
