import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CatalogCategory } from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

import { CategoryForm } from './CategoryForm'

export interface CategoryFormDialogProps {
  mode: 'create' | 'edit'
  category?: CatalogCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (category: CatalogCategory) => void
}

export function CategoryFormDialog({
  mode,
  category,
  open,
  onOpenChange,
  onSaved,
}: CategoryFormDialogProps) {
  const copy =
    mode === 'create'
      ? catalogMessages.categories.createDialog
      : catalogMessages.categories.editDialog
  const formKey = mode === 'edit' ? (category?.id ?? 'edit-empty') : 'create'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="category-form-dialog"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {(mode === 'create' || category) && (
          <CategoryForm
            key={formKey}
            mode={mode}
            category={category ?? undefined}
            onSaved={(saved) => {
              onSaved?.(saved)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
