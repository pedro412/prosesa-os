import { useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  type CatalogCategory,
  type CatalogItem,
  type CatalogPricingMode,
  type CatalogUnit,
  useCategories,
  useItemsPaged,
  useUpdateItem,
} from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

import { ItemDeleteDialog } from './ItemDeleteDialog'
import { ItemFormDialog } from './ItemFormDialog'

const PAGE_SIZE = 25
const ALL_CATEGORIES = '__all__'

const messages = catalogMessages.items
const unitMessages = catalogMessages.units
const pricingModeMessages = catalogMessages.pricingMode

const priceFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

export function ItemsList() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [deleting, setDeleting] = useState<CatalogItem | null>(null)

  // includeInactive on the categories query so the filter dropdown
  // includes archived categories that may still tag historical items.
  const categoriesQuery = useCategories({ includeInactive: true })

  const { data, isPending, isError, isFetching } = useItemsPaged({
    search,
    categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
    includeInactive,
    page,
    pageSize: PAGE_SIZE,
  })

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setPage(0)
  }

  function handleIncludeInactiveChange(value: boolean) {
    setIncludeInactive(value)
    setPage(0)
  }

  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rows = data?.rows ?? []
  const currentPageNumber = page + 1
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  const categories = categoriesQuery.data ?? []
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="space-y-6" data-testid="items-list">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 sm:max-w-xl">
          <div className="relative">
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
              data-testid="items-search"
            />
          </div>
          <Select value={categoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger
              aria-label={messages.filters.categoryLabel}
              className="w-full"
              data-testid="items-category-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>{messages.filters.categoryAll}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="flex items-center gap-2">
            <Switch
              id="items-include-inactive"
              checked={includeInactive}
              onCheckedChange={handleIncludeInactiveChange}
              data-testid="items-include-inactive"
            />
            <Label htmlFor="items-include-inactive" className="text-sm font-normal">
              {messages.filters.includeInactiveLabel}
            </Label>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            data-testid="item-create-button"
            className="shrink-0"
          >
            <Plus aria-hidden className="size-4" />
            {messages.newButton}
          </Button>
        </div>
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
            {search.trim().length > 0 || categoryId !== ALL_CATEGORIES
              ? messages.list.emptySearch
              : messages.list.empty}
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.name}</TableHead>
                <TableHead>{messages.columns.category}</TableHead>
                <TableHead>{messages.columns.unit}</TableHead>
                <TableHead>{messages.columns.pricingMode}</TableHead>
                <TableHead className="text-right">{messages.columns.price}</TableHead>
                <TableHead className="text-center">{messages.columns.active}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  category={categoryById.get(item.category_id)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isPending && !isError && totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-muted-foreground text-sm" data-testid="items-count">
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
              disabled={isFirstPage || isFetching}
              data-testid="items-prev"
            >
              {messages.list.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLastPage || isFetching}
              data-testid="items-next"
            >
              {messages.list.next}
            </Button>
          </div>
        </div>
      )}

      <ItemFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

      <ItemFormDialog
        mode="edit"
        item={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />

      <ItemDeleteDialog
        item={deleting}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      />
    </div>
  )
}

interface ItemRowProps {
  item: CatalogItem
  category: CatalogCategory | undefined
  onEdit: () => void
  onDelete: () => void
}

function ItemRow({ item, category, onEdit, onDelete }: ItemRowProps) {
  const updateMutation = useUpdateItem()

  async function handleToggleActive(value: boolean) {
    try {
      await updateMutation.mutateAsync({ id: item.id, patch: { is_active: value } })
      toast.success(value ? messages.toast.activatedSuccess : messages.toast.deactivatedSuccess)
    } catch {
      toast.error(messages.toast.genericError)
    }
  }

  const unit = item.unit as CatalogUnit
  const pricingMode = item.pricing_mode as CatalogPricingMode

  return (
    <TableRow data-testid={`item-row-${item.id}`}>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell className="text-muted-foreground">{category?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{unitMessages[unit]}</TableCell>
      <TableCell className="text-muted-foreground">{pricingModeMessages[pricingMode]}</TableCell>
      <TableCell className="text-right tabular-nums">
        {pricingMode === 'variable' ? '—' : priceFormatter.format(Number(item.price))}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={item.is_active}
          onCheckedChange={handleToggleActive}
          disabled={updateMutation.isPending}
          aria-label={messages.actions.toggleActiveAria(item.name)}
          data-testid={`item-active-${item.id}`}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={onEdit} data-testid={`item-edit-${item.id}`}>
            {messages.actions.edit}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            aria-label={messages.actions.delete}
            data-testid={`item-delete-${item.id}`}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
