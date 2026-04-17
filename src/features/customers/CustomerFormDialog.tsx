import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Customer } from '@/lib/queries/customers'

import { CustomerForm } from './CustomerForm'
import { customersMessages } from './messages'

export interface CustomerFormDialogProps {
  mode: 'create' | 'edit'
  // Required for edit mode.
  customer?: Customer | null
  // Pre-fill the nombre field on create (POS quick-add use case).
  initialNombre?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // Fires after a successful save, before the dialog closes. POS uses
  // this to auto-select the freshly created customer.
  onSaved?: (customer: Customer) => void
  // Forwarded from CustomerForm — invoked when the user clicks
  // "Ver cliente existente" after a duplicate-key error. The list view
  // uses it to switch from create to edit mode on the colliding row.
  onRequestEditExisting?: (customer: Customer) => void
}

// Shared dialog for both create and edit. Keys the inner form by
// (mode, customer?.id, initialNombre) so opening on a different row
// — or re-opening in create mode — resets the form state cleanly.
export function CustomerFormDialog({
  mode,
  customer,
  initialNombre,
  open,
  onOpenChange,
  onSaved,
  onRequestEditExisting,
}: CustomerFormDialogProps) {
  const copy = mode === 'create' ? customersMessages.createDialog : customersMessages.editDialog
  const formKey = mode === 'edit' ? (customer?.id ?? 'edit-empty') : `create-${initialNombre ?? ''}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        data-testid="customer-form-dialog"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {(mode === 'create' || customer) && (
          <CustomerForm
            key={formKey}
            mode={mode}
            customer={customer ?? undefined}
            initialNombre={initialNombre}
            onSaved={(saved) => {
              onSaved?.(saved)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
            onRequestEditExisting={onRequestEditExisting}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
