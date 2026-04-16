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
import { type Customer, useSoftDeleteCustomer } from '@/lib/queries/customers'

import { customersMessages } from './messages'

export interface CustomerDeleteDialogProps {
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Soft-delete confirmation. RLS enforces that only admins can flip
// deleted_at; if a ventas user somehow reaches this dialog, the
// server responds with a policy violation and we surface the generic
// error toast.
export function CustomerDeleteDialog({ customer, open, onOpenChange }: CustomerDeleteDialogProps) {
  const softDelete = useSoftDeleteCustomer()
  const copy = customersMessages.deleteDialog

  async function handleConfirm() {
    if (!customer) return
    try {
      await softDelete.mutateAsync(customer.id)
      toast.success(customersMessages.toast.deleteSuccess)
      onOpenChange(false)
    } catch {
      toast.error(customersMessages.toast.genericError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="customer-delete-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {customer && <DialogDescription>{copy.body(customer.nombre)}</DialogDescription>}
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
            data-testid="customer-delete-confirm"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
