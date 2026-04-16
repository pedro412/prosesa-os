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
import { type CatalogItem, useSoftDeleteItem } from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

export interface ItemDeleteDialogProps {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ItemDeleteDialog({ item, open, onOpenChange }: ItemDeleteDialogProps) {
  const softDelete = useSoftDeleteItem()
  const copy = catalogMessages.items.deleteDialog

  async function handleConfirm() {
    if (!item) return
    try {
      await softDelete.mutateAsync(item.id)
      toast.success(catalogMessages.items.toast.deleteSuccess)
      onOpenChange(false)
    } catch {
      toast.error(catalogMessages.items.toast.genericError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="item-delete-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {item && <DialogDescription>{copy.body(item.name)}</DialogDescription>}
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
            data-testid="item-delete-confirm"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
