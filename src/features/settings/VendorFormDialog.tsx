import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Vendor } from '@/lib/queries/vendors'

import { settingsMessages } from './messages'
import { VendorForm } from './VendorForm'

type VendorFormDialogProps =
  | {
      mode: 'create'
      open: boolean
      onOpenChange: (open: boolean) => void
      vendor?: never
    }
  | {
      mode: 'edit'
      vendor: Vendor | null
      open: boolean
      onOpenChange: (open: boolean) => void
    }

export function VendorFormDialog(props: VendorFormDialogProps) {
  const dialogCopy =
    props.mode === 'create'
      ? settingsMessages.vendors.createDialog
      : settingsMessages.vendors.editDialog

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="vendor-form-dialog">
        <DialogHeader>
          <DialogTitle>{dialogCopy.title}</DialogTitle>
          <DialogDescription>{dialogCopy.description}</DialogDescription>
        </DialogHeader>
        {props.mode === 'create' ? (
          <VendorForm mode="create" onSaved={() => props.onOpenChange(false)} />
        ) : props.vendor ? (
          <VendorForm
            key={props.vendor.id}
            mode="edit"
            vendor={props.vendor}
            onSaved={() => props.onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
