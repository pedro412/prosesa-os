import { type MouseEvent, useState } from 'react'
import { ArrowRight, Eye, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type WorkOrderStatus, useUpdateWorkOrderStatus } from '@/lib/queries/work-orders'

import { workOrdersMessages } from './messages'
import { STATUS_LABELS, STATUS_ORDER } from './status-metadata'
import { WorkOrderStatusDialog } from './WorkOrderStatusDialog'

interface WorkOrderRowMenuProps {
  workOrderId: string
  status: WorkOrderStatus
  saldoPendiente: number | null
  cancelled: boolean
  onOpenDetail: () => void
}

// Row-scoped quick actions for the work-orders list (LIT-101). Keeps
// the 80% case — "advance to the next stage" — a single click, and
// surfaces the full status dialog for backward transitions or jumps.
export function WorkOrderRowMenu({
  workOrderId,
  status,
  saldoPendiente,
  cancelled,
  onOpenDetail,
}: WorkOrderRowMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const mutation = useUpdateWorkOrderStatus()
  const messages = workOrdersMessages.row

  const currentIdx = STATUS_ORDER.indexOf(status)
  const nextStatus =
    currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null

  // Stop row-click propagation on every interactive element inside the
  // menu — the parent `<TableRow>` opens detail on click, which would
  // hijack any item the user taps.
  function stop(e: MouseEvent) {
    e.stopPropagation()
  }

  function handleAdvance() {
    if (!nextStatus || mutation.isPending) return
    mutation
      .mutateAsync({ workOrderId, newStatus: nextStatus, note: null })
      .then(() => {
        toast.success(messages.advanceSuccess(STATUS_LABELS[nextStatus]))
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err)
        toast.error(`${messages.advanceError} ${detail}`.trim())
      })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={messages.menuAriaLabel}
            onClick={stop}
            data-testid={`work-order-row-menu-${workOrderId}`}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          {!cancelled && nextStatus && (
            <DropdownMenuItem
              onSelect={handleAdvance}
              disabled={mutation.isPending}
              data-testid={`work-order-row-advance-${workOrderId}`}
            >
              <ArrowRight aria-hidden className="size-4" />
              {messages.advanceTo(STATUS_LABELS[nextStatus])}
            </DropdownMenuItem>
          )}
          {!cancelled && (
            <DropdownMenuItem
              onSelect={() => setDialogOpen(true)}
              data-testid={`work-order-row-change-${workOrderId}`}
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              {messages.changeStatus}
            </DropdownMenuItem>
          )}
          {!cancelled && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={onOpenDetail}
            data-testid={`work-order-row-open-${workOrderId}`}
          >
            <Eye aria-hidden className="size-4" />
            {messages.openDetail}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!cancelled && (
        <WorkOrderStatusDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workOrderId={workOrderId}
          currentStatus={status}
          saldoPendiente={saldoPendiente}
        />
      )}
    </>
  )
}
