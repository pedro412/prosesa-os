import { type FormEvent, useState } from 'react'
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
import { useCancelSalesNote } from '@/lib/queries/sales-notes'

import { salesNotesMessages } from './messages'

interface CancelNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteId: string
  folio: string
  onCancelled?: () => void
}

const reasonSchema = z.string().trim().min(5, salesNotesMessages.cancelDialog.reasonError)

export function CancelNoteDialog({
  open,
  onOpenChange,
  noteId,
  folio,
  onCancelled,
}: CancelNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{salesNotesMessages.cancelDialog.title}</DialogTitle>
          <DialogDescription>{salesNotesMessages.cancelDialog.body(folio)}</DialogDescription>
        </DialogHeader>
        {open && (
          <CancelForm
            noteId={noteId}
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
  noteId,
  folio,
  onCancelled,
  onClose,
}: {
  noteId: string
  folio: string
  onCancelled: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const mutation = useCancelSalesNote()

  const messages = salesNotesMessages.cancelDialog

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
      .mutateAsync({ id: noteId, reason: parsed.data })
      .then(() => onCancelled())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setSubmitError(message || salesNotesMessages.drawer.toasts.cancelError)
      })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid={`cancel-note-form-${folio}`}>
      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason">{messages.reasonLabel}</Label>
        <Textarea
          id="cancel-reason"
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
          data-testid="cancel-note-reason"
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
          data-testid="cancel-note-confirm"
        >
          {mutation.isPending ? messages.submitting : messages.confirm}
        </Button>
      </DialogFooter>
    </form>
  )
}
