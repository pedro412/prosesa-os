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
import { type Customer, DuplicateCustomerError, useRestoreCustomer } from '@/lib/queries/customers'

import { customersMessages } from './messages'

export interface CustomerRestoreDialogProps {
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Restore confirmation for the papelera view. The restore can fail if
// the customer's phone/email now collide with an active row — we
// surface that as a specific toast so the admin can investigate the
// duplicate instead of being confused by a generic error.
export function CustomerRestoreDialog({
  customer,
  open,
  onOpenChange,
}: CustomerRestoreDialogProps) {
  const restore = useRestoreCustomer()
  const copy = customersMessages.trash.restoreDialog

  async function handleConfirm() {
    if (!customer) return
    try {
      await restore.mutateAsync(customer.id)
      toast.success(customersMessages.trash.restoreSuccess)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof DuplicateCustomerError) {
        toast.error(customersMessages.trash.restoreDuplicate[err.field])
        return
      }
      toast.error(customersMessages.toast.genericError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="customer-restore-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {customer && <DialogDescription>{copy.body(customer.nombre)}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={restore.isPending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={restore.isPending}
            data-testid="customer-restore-confirm"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
