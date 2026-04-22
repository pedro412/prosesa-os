import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Textarea } from '@/components/ui/textarea'
import { useCancelWorkOrder } from '@/lib/queries/work-orders'

import { workOrdersMessages } from './messages'

interface WorkOrderCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  folio: string
  onCancelled?: () => void
}

const reasonSchema = z.string().trim().min(5, workOrdersMessages.cancelDialog.reasonError)

// Mirrors CancelNoteDialog from the sales-notes feature — same reason
// schema, same UX. The underlying mutation hits work_orders.UPDATE;
// LIT-38's `work_orders_enforce_admin_cancel` trigger blocks non-admin
// writes to the cancellation columns, so this is belt + suspenders on
// top of the admin-only trigger affordance.
export function WorkOrderCancelDialog({
  open,
  onOpenChange,
  workOrderId,
  folio,
  onCancelled,
}: WorkOrderCancelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workOrdersMessages.cancelDialog.title}</DialogTitle>
          <DialogDescription>{workOrdersMessages.cancelDialog.body(folio)}</DialogDescription>
        </DialogHeader>
        {open && (
          <CancelForm
            workOrderId={workOrderId}
            folio={folio}
            onCancelled={() => {
              onCancelled?.()
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CancelForm({
  workOrderId,
  folio,
  onCancelled,
  onClose,
}: {
  workOrderId: string
  folio: string
  onCancelled: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const mutation = useCancelWorkOrder()

  const messages = workOrdersMessages.cancelDialog

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const parsed = reasonSchema.safeParse(reason)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? messages.reasonError)
      return
    }
    setError(null)
    setSubmitError(null)
    mutation
      .mutateAsync({ workOrderId, reason: parsed.data })
      .then(() => {
        toast.success(messages.success(folio))
        onCancelled()
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        // Surface the trigger's Spanish message when we recognize it;
        // otherwise fall through to a generic copy.
        if (message.includes('entregado') || message.includes('delivered')) {
          setSubmitError(messages.errorDelivered)
          return
        }
        setSubmitError(message || messages.errorGeneric)
      })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid={`cancel-work-order-form-${folio}`}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cancel-wo-reason">{messages.reasonLabel}</Label>
        <Textarea
          id="cancel-wo-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (error) setError(null)
          }}
          placeholder={messages.reasonPlaceholder}
          aria-invalid={error ? true : undefined}
          rows={4}
          autoFocus
          disabled={mutation.isPending}
          data-testid="cancel-work-order-reason"
        />
        <p className="text-muted-foreground text-xs">{messages.reasonHint}</p>
        {error && <p className="text-destructive text-xs">{error}</p>}
        {submitError && <p className="text-destructive text-xs">{submitError}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {messages.cancel}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={mutation.isPending}
          data-testid="cancel-work-order-confirm"
        >
          {mutation.isPending ? messages.submitting : messages.confirm}
        </Button>
      </DialogFooter>
    </form>
  )
}
