import { type FormEvent, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import { formatMXN } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type WorkOrderStatus, useUpdateWorkOrderStatus } from '@/lib/queries/work-orders'

import { workOrdersMessages } from './messages'
import { STATUS_LABELS, STATUS_ORDER, statusBadgeVariant } from './status-metadata'

interface WorkOrderStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  currentStatus: WorkOrderStatus
  // Nota saldo for the entregado-with-balance warning. Pass the raw
  // numeric value; null when the parent nota isn't joined in (shouldn't
  // happen in practice but keep the type honest).
  saldoPendiente: number | null
  onChanged?: () => void
}

// Backward = target index is lower than current index in STATUS_ORDER.
// Matches the RPC's server-side check so the UI mirrors the rule.
function isBackward(current: WorkOrderStatus, target: WorkOrderStatus): boolean {
  return STATUS_ORDER.indexOf(target) < STATUS_ORDER.indexOf(current)
}

export function WorkOrderStatusDialog({
  open,
  onOpenChange,
  workOrderId,
  currentStatus,
  saldoPendiente,
  onChanged,
}: WorkOrderStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workOrdersMessages.statusDialog.title}</DialogTitle>
          <DialogDescription>{workOrdersMessages.statusDialog.description}</DialogDescription>
        </DialogHeader>
        {open && (
          <StatusForm
            workOrderId={workOrderId}
            currentStatus={currentStatus}
            saldoPendiente={saldoPendiente}
            onChanged={() => {
              onChanged?.()
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({
  workOrderId,
  currentStatus,
  saldoPendiente,
  onChanged,
  onClose,
}: {
  workOrderId: string
  currentStatus: WorkOrderStatus
  saldoPendiente: number | null
  onChanged: () => void
  onClose: () => void
}) {
  // Default to the next-forward stage if one exists — the "Cobrar"
  // equivalent for this surface. Operators almost always advance,
  // so biasing the default shaves a click.
  const nextForward = useMemo<WorkOrderStatus | null>(() => {
    const idx = STATUS_ORDER.indexOf(currentStatus)
    return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null
  }, [currentStatus])

  const [target, setTarget] = useState<WorkOrderStatus>(nextForward ?? currentStatus)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const mutation = useUpdateWorkOrderStatus()

  const backward = target !== currentStatus && isBackward(currentStatus, target)
  const messages = workOrdersMessages.statusDialog

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    if (target === currentStatus) return

    const trimmed = note.trim()
    if (backward && trimmed.length === 0) {
      setNoteError(messages.noteRequired)
      return
    }
    setNoteError(null)
    setSubmitError(null)

    mutation
      .mutateAsync({
        workOrderId,
        newStatus: target,
        note: trimmed.length > 0 ? trimmed : null,
      })
      .then(() => {
        toast.success(messages.success)
        onChanged()
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setSubmitError(message || messages.genericError)
      })
  }

  const showEntregadoWarning =
    target === 'entregado' && saldoPendiente !== null && Number(saldoPendiente) > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="work-order-status-form">
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">{messages.currentLabel}</Label>
        <div>
          <Badge variant={statusBadgeVariant(currentStatus)}>{STATUS_LABELS[currentStatus]}</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">{messages.selectLabel}</Label>
        <div
          role="radiogroup"
          aria-label={messages.selectLabel}
          className="grid gap-1.5"
          data-testid="work-order-status-options"
        >
          {STATUS_ORDER.map((candidate) => {
            const isCurrent = candidate === currentStatus
            const isSelected = target === candidate
            const candidateBackward = !isCurrent && isBackward(currentStatus, candidate)
            return (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isCurrent}
                onClick={() => {
                  setTarget(candidate)
                  if (noteError) setNoteError(null)
                }}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isCurrent && 'opacity-60 cursor-not-allowed',
                  !isCurrent && isSelected && 'border-primary bg-accent',
                  !isCurrent && !isSelected && 'hover:bg-accent/40'
                )}
                data-testid={`work-order-status-option-${candidate}`}
              >
                <span className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(candidate)}>{STATUS_LABELS[candidate]}</Badge>
                  {candidateBackward && (
                    <span className="text-muted-foreground text-xs">(regresa)</span>
                  )}
                </span>
                {isCurrent && (
                  <span className="text-muted-foreground text-xs">{messages.currentLabel}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {backward && (
        <p className="text-muted-foreground text-xs" data-testid="work-order-status-backward-hint">
          {messages.backwardHint}
        </p>
      )}

      {showEntregadoWarning && saldoPendiente !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          data-testid="work-order-status-entregado-warning"
        >
          <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber-600" />
          <p className="text-amber-800 dark:text-amber-200">
            {messages.entregadoWithSaldoWarning(formatMXN(Number(saldoPendiente)))}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="work-order-status-note">{messages.noteLabel}</Label>
        <Textarea
          id="work-order-status-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            if (noteError) setNoteError(null)
          }}
          placeholder={messages.notePlaceholder}
          aria-invalid={noteError ? true : undefined}
          aria-required={backward || undefined}
          rows={3}
          disabled={mutation.isPending}
          data-testid="work-order-status-note-input"
        />
        {noteError && <p className="text-destructive text-xs">{noteError}</p>}
        {submitError && <p className="text-destructive text-xs">{submitError}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {messages.cancel}
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || target === currentStatus}
          data-testid="work-order-status-submit"
        >
          {mutation.isPending ? messages.submitting : messages.submit}
        </Button>
      </DialogFooter>
    </form>
  )
}
