import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { customerFiscalStatus, type FiscalField } from '@/features/customers/fiscal-completeness'
import type { Customer } from '@/lib/queries/customers'
import { useUpdateRequiresInvoice } from '@/lib/queries/sales-notes'

import { salesNotesMessages } from './messages'

interface EditRequiresInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteId: string
  currentValue: boolean
  customer: Customer | null
  onSaved?: () => void
}

export function EditRequiresInvoiceDialog({
  open,
  onOpenChange,
  noteId,
  currentValue,
  customer,
  onSaved,
}: EditRequiresInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{salesNotesMessages.requiresInvoiceDialog.title}</DialogTitle>
          <DialogDescription>
            {salesNotesMessages.requiresInvoiceDialog.description}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EditForm
            noteId={noteId}
            currentValue={currentValue}
            customer={customer}
            onSaved={() => {
              onSaved?.()
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  noteId,
  currentValue,
  customer,
  onSaved,
  onClose,
}: {
  noteId: string
  currentValue: boolean
  customer: Customer | null
  onSaved: () => void
  onClose: () => void
}) {
  const [value, setValue] = useState(currentValue)
  // Reset when the dialog reopens on a different nota or the source
  // value changed while the dialog was closed.
  useEffect(() => {
    setValue(currentValue)
  }, [currentValue])

  const mutation = useUpdateRequiresInvoice()
  const messages = salesNotesMessages.requiresInvoiceDialog

  const { status, missing } = customerFiscalStatus(customer)
  // Only warn when the operator is about to flip *to* true with an
  // unbillable customer. Non-blocking per the ticket.
  const showFiscalWarning = value && status !== 'complete'

  function handleSubmit() {
    if (mutation.isPending) return
    if (value === currentValue) {
      onClose()
      return
    }
    mutation
      .mutateAsync({ id: noteId, requiresInvoice: value })
      .then(() => {
        toast.success(messages.toastSuccess)
        onSaved()
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err)
        toast.error(detail || messages.toastError)
      })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
      data-testid="edit-requires-invoice-form"
    >
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
        <Label htmlFor="edit-requires-invoice-switch" className="cursor-pointer">
          {messages.switchLabel}
        </Label>
        <Switch
          id="edit-requires-invoice-switch"
          checked={value}
          onCheckedChange={setValue}
          disabled={mutation.isPending}
          data-testid="edit-requires-invoice-switch"
        />
      </div>
      {showFiscalWarning && (
        <div
          className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-md border p-3"
          role="alert"
          data-testid="edit-requires-invoice-fiscal-warning"
          data-status={status}
        >
          <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              {status === 'no-customer'
                ? messages.fiscal.noCustomerTitle
                : messages.fiscal.incompleteTitle}
            </p>
            <p className="text-muted-foreground text-xs">
              {status === 'no-customer'
                ? messages.fiscal.noCustomerDescription
                : messages.fiscal.incompleteDescription(formatMissing(missing))}
            </p>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {messages.cancel}
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          data-testid="edit-requires-invoice-confirm"
        >
          {mutation.isPending ? messages.submitting : messages.confirm}
        </Button>
      </DialogFooter>
    </form>
  )
}

const FIELD_LABELS: Record<FiscalField, string> = {
  rfc: 'RFC',
  razon_social: 'Razón social',
  regimen_fiscal: 'Régimen fiscal',
  cp_fiscal: 'Código postal',
  direccion_fiscal: 'Dirección fiscal',
  uso_cfdi: 'Uso de CFDI',
}

function formatMissing(missing: readonly FiscalField[]): string {
  return missing.map((field) => FIELD_LABELS[field]).join(', ')
}
