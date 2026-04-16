import type { Customer } from '@/lib/queries/customers'

import { CustomerFormDialog } from './CustomerFormDialog'

export interface CustomerQuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // POS passes whatever the user typed in the customer typeahead so
  // the dialog opens with the name already filled in.
  initialNombre?: string
  // POS auto-selects the freshly created customer into the sale.
  onCreated?: (customer: Customer) => void
}

// Thin wrapper around CustomerFormDialog locked to "create" mode. POS
// (M3) will mount this from its customer picker; the /clientes page
// uses CustomerFormDialog directly.
export function CustomerQuickAddDialog({
  open,
  onOpenChange,
  initialNombre,
  onCreated,
}: CustomerQuickAddDialogProps) {
  return (
    <CustomerFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      initialNombre={initialNombre}
      onSaved={onCreated}
    />
  )
}
