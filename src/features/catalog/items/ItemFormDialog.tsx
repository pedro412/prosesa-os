import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CatalogItem } from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

import { ItemForm } from './ItemForm'

export interface ItemFormDialogProps {
  mode: 'create' | 'edit'
  item?: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (item: CatalogItem) => void
}

export function ItemFormDialog({ mode, item, open, onOpenChange, onSaved }: ItemFormDialogProps) {
  const copy =
    mode === 'create' ? catalogMessages.items.createDialog : catalogMessages.items.editDialog
  const formKey = mode === 'edit' ? (item?.id ?? 'edit-empty') : 'create'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        data-testid="item-form-dialog"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {(mode === 'create' || item) && (
          <ItemForm
            key={formKey}
            mode={mode}
            item={item ?? undefined}
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
