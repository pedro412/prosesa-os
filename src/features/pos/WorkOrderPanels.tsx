import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { WorkOrderPriority } from '@/lib/queries/sales-notes'

import { posMessages } from './messages'
import type { PosLine, PosOrder } from './pos-form-state'

interface WorkOrderPanelsProps {
  orders: PosOrder[]
  lines: PosLine[]
  onAddOrder: () => void
  onRemoveOrder: (clientId: string) => void
  onUpdateOrder: (clientId: string, patch: Partial<Omit<PosOrder, 'clientId'>>) => void
}

// Renders the order-metadata section above the lines table. Orders only
// display once the operator has created at least one — the "Nueva
// orden" button remains visible either way so project sales can start
// from an empty slate without first toggling a line.
export function WorkOrderPanels({
  orders,
  lines,
  onAddOrder,
  onRemoveOrder,
  onUpdateOrder,
}: WorkOrderPanelsProps) {
  const [pendingRemove, setPendingRemove] = useState<PosOrder | null>(null)

  function requestRemove(order: PosOrder) {
    const attachedCount = lines.filter((line) => line.orderClientId === order.clientId).length
    if (attachedCount === 0) {
      onRemoveOrder(order.clientId)
      return
    }
    setPendingRemove(order)
  }

  return (
    <section className="space-y-3" data-testid="pos-orders-panel">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">{posMessages.orders.sectionTitle}</h2>
          <p className="text-muted-foreground text-xs">{posMessages.orders.addButtonHint}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddOrder}
          data-testid="pos-order-add"
        >
          {posMessages.orders.addButton}
        </Button>
      </header>

      {orders.length === 0 ? (
        <p
          className="text-muted-foreground rounded-md border border-dashed px-4 py-4 text-center text-xs"
          data-testid="pos-orders-empty"
        >
          {posMessages.orders.empty}
        </p>
      ) : (
        <div className="space-y-3" data-testid="pos-orders-list">
          {orders.map((order, index) => {
            const attached = lines.filter((line) => line.orderClientId === order.clientId).length
            return (
              <div
                key={order.clientId}
                className="space-y-3 rounded-md border p-3"
                data-testid={`pos-order-card-${order.clientId}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {posMessages.orders.cardHeading(index + 1)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {posMessages.orders.lineCount(attached)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => requestRemove(order)}
                    aria-label={posMessages.orders.removeAriaLabel}
                    data-testid={`pos-order-remove-${order.clientId}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>

                {attached === 0 && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200"
                    data-testid={`pos-order-orphan-${order.clientId}`}
                  >
                    <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                    <p>{posMessages.orders.orphanWarning}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label
                    htmlFor={`pos-order-description-${order.clientId}`}
                    className="text-muted-foreground text-xs"
                  >
                    {posMessages.orders.fields.description}
                  </Label>
                  <Textarea
                    id={`pos-order-description-${order.clientId}`}
                    value={order.description}
                    onChange={(e) => onUpdateOrder(order.clientId, { description: e.target.value })}
                    placeholder={posMessages.orders.fields.descriptionPlaceholder}
                    rows={2}
                    data-testid={`pos-order-description-input-${order.clientId}`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      {posMessages.orders.fields.priority}
                    </Label>
                    <Select
                      value={order.priority}
                      onValueChange={(next) =>
                        onUpdateOrder(order.clientId, {
                          priority: next as WorkOrderPriority,
                        })
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-8 w-full"
                        data-testid={`pos-order-priority-${order.clientId}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">
                          {posMessages.orders.fields.priorityOptions.normal}
                        </SelectItem>
                        <SelectItem value="urgente">
                          {posMessages.orders.fields.priorityOptions.urgente}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor={`pos-order-promised-${order.clientId}`}
                      className="text-muted-foreground text-xs"
                    >
                      {posMessages.orders.fields.promisedAt}
                    </Label>
                    <Input
                      id={`pos-order-promised-${order.clientId}`}
                      type="date"
                      value={order.promisedAt ? order.promisedAt.slice(0, 10) : ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        // Store as ISO datetime at local-day start. The
                        // server column is `timestamptz`; a date-only
                        // input maps to midnight of the operator's day.
                        const iso = raw === '' ? null : new Date(`${raw}T00:00:00`).toISOString()
                        onUpdateOrder(order.clientId, { promisedAt: iso })
                      }}
                      className="h-8"
                      data-testid={`pos-order-promised-input-${order.clientId}`}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{posMessages.orders.removeConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {posMessages.orders.removeConfirm.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{posMessages.orders.removeConfirm.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingRemove) onRemoveOrder(pendingRemove.clientId)
                setPendingRemove(null)
              }}
              data-testid="pos-order-remove-confirm"
            >
              {posMessages.orders.removeConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
