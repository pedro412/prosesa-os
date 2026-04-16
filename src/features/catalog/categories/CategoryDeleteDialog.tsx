import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type CatalogCategory, useSoftDeleteCategory } from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

export interface CategoryDeleteDialogProps {
  category: CatalogCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoryDeleteDialog({ category, open, onOpenChange }: CategoryDeleteDialogProps) {
  const softDelete = useSoftDeleteCategory()
  const copy = catalogMessages.categories.deleteDialog

  async function handleConfirm() {
    if (!category) return
    try {
      await softDelete.mutateAsync(category.id)
      toast.success(catalogMessages.categories.toast.deleteSuccess)
      onOpenChange(false)
    } catch {
      toast.error(catalogMessages.categories.toast.genericError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="category-delete-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {category && <DialogDescription>{copy.body(category.name)}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={softDelete.isPending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={softDelete.isPending}
            data-testid="category-delete-confirm"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
