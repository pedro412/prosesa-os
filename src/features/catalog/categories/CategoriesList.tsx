import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type CatalogCategory, useCategories } from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

import { CategoryDeleteDialog } from './CategoryDeleteDialog'
import { CategoryFormDialog } from './CategoryFormDialog'

const messages = catalogMessages.categories

interface CategoriesListProps {
  canEdit: boolean
}

export function CategoriesList({ canEdit }: CategoriesListProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogCategory | null>(null)
  const [deleting, setDeleting] = useState<CatalogCategory | null>(null)

  // Show inactive categories so admins can re-activate them.
  const { data, isPending, isError } = useCategories({ includeInactive: true })

  const rows = data ?? []

  return (
    <div className="space-y-6" data-testid="categories-list">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)} data-testid="category-create-button">
            <Plus aria-hidden className="size-4" />
            {messages.newButton}
          </Button>
        </div>
      )}

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
            {messages.list.empty}
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.name}</TableHead>
                <TableHead>{messages.columns.status}</TableHead>
                {canEdit && <TableHead className="sr-only">{messages.columns.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  canEdit={canEdit}
                  onEdit={() => setEditing(category)}
                  onDelete={() => setDeleting(category)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {canEdit && (
        <>
          <CategoryFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

          <CategoryFormDialog
            mode="edit"
            category={editing}
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null)
            }}
          />

          <CategoryDeleteDialog
            category={deleting}
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null)
            }}
          />
        </>
      )}
    </div>
  )
}

interface CategoryRowProps {
  category: CatalogCategory
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}

function CategoryRow({ category, canEdit, onEdit, onDelete }: CategoryRowProps) {
  return (
    <TableRow data-testid={`category-row-${category.id}`}>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {category.is_active ? messages.status.active : messages.status.inactive}
      </TableCell>
      {canEdit && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              data-testid={`category-edit-${category.id}`}
            >
              {messages.actions.edit}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={messages.actions.delete}
              data-testid={`category-delete-${category.id}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}
