import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMXN } from '@/lib/format'
import { computeLineTotal, type LineDiscountType } from '@/lib/tax'

import { posMessages } from './messages'
import type { PosLine, PosOrder } from './pos-form-state'

// Sentinel used by the destination dropdown for "create a new order and
// attach this line to it" in a single click. Picked so it can't collide
// with a real order clientId (which start with 'order-').
const CREATE_NEW_DESTINATION = '__create-new__'
// Sentinel for Mostrador (null orderClientId). Radix Select disallows
// empty-string values, so we round-trip null through this token.
const COUNTER_DESTINATION = '__counter__'

interface LineItemsTableProps {
  lines: PosLine[]
  orders: PosOrder[]
  onUpdate: (id: string, patch: Partial<PosLine>) => void
  onRemove: (id: string) => void
  // LIT-37: set the line's order. When `orderClientId` is null → Mostrador.
  onChangeOrder: (id: string, orderClientId: string | null) => void
  // Called when the operator picks "+ Nueva orden" in a line's
  // destination dropdown. Must atomically create a new order and attach
  // this line to it so we don't render a frame with a stale selector.
  onCreateOrderFor: (lineId: string) => void
}

// Parses a loosely-typed input into a safe number. Empty / invalid →
// 0 so the reducer's `isLineValid` can flag it, rather than letting
// NaN propagate through `computeLineTotal`.
function parseNumber(raw: string): number {
  if (raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

interface FieldProps {
  line: PosLine
  onUpdate: (id: string, patch: Partial<PosLine>) => void
}

// Field renderers shared between the desktop table and the mobile
// card layout. Extracted because each one has non-trivial conditional
// logic (especially DiscountFields) and inlining both layouts would
// duplicate ~40 lines per field.
function QuantityInput({ line, onUpdate }: FieldProps) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.001"
      value={line.quantity}
      onChange={(e) => onUpdate(line.id, { quantity: parseNumber(e.target.value) })}
      className="h-8 w-full"
      aria-label={posMessages.table.columns.quantity}
      data-testid={`pos-line-qty-${line.id}`}
    />
  )
}

function UnitPriceInput({ line, onUpdate }: FieldProps) {
  // LIT-108: amber inline hint when the operator types a price below
  // the catalog cost captured at add-time. Non-blocking — Gustavo may
  // be giving a repeat-customer discount that he owns.
  const belowCost =
    line.catalogItemId !== null &&
    line.catalogCost !== null &&
    line.catalogCost > 0 &&
    line.unitPrice > 0 &&
    line.unitPrice < line.catalogCost

  return (
    <div className="space-y-1">
      <MoneyInput
        value={line.unitPrice}
        onChange={(next) => onUpdate(line.id, { unitPrice: next })}
        className="h-8 w-full"
        aria-label={posMessages.table.columns.unitPrice}
        aria-invalid={belowCost ? true : undefined}
        data-testid={`pos-line-price-${line.id}`}
      />
      {belowCost && (
        <p
          className="text-xs text-amber-700 dark:text-amber-500"
          data-testid={`pos-line-below-cost-${line.id}`}
        >
          {posMessages.table.belowCostHint}
        </p>
      )}
    </div>
  )
}

function DiscountFields({ line, onUpdate }: FieldProps) {
  return (
    <div className="flex gap-2">
      <Select
        value={line.discountType}
        onValueChange={(next) =>
          onUpdate(line.id, {
            discountType: next as LineDiscountType,
            // Reset value when switching to 'none' so the math
            // helper doesn't see a stale number.
            discountValue: next === 'none' ? 0 : line.discountValue,
          })
        }
      >
        <SelectTrigger size="sm" className="h-8 w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{posMessages.table.discountTypes.none}</SelectItem>
          <SelectItem value="percent">{posMessages.table.discountTypes.percent}</SelectItem>
          <SelectItem value="fixed">{posMessages.table.discountTypes.fixed}</SelectItem>
        </SelectContent>
      </Select>
      {line.discountType === 'fixed' ? (
        <MoneyInput
          value={line.discountValue}
          onChange={(next) => onUpdate(line.id, { discountValue: next })}
          className="h-8 w-24 shrink-0"
          aria-label={posMessages.table.columns.discount}
          data-testid={`pos-line-discount-${line.id}`}
        />
      ) : line.discountType === 'percent' ? (
        // Percent stays a plain numeric input — it's a 0..100 value,
        // not a money amount, so thousands separators would be noise.
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={line.discountValue}
          onChange={(e) =>
            onUpdate(line.id, {
              discountValue: parseNumber(e.target.value),
            })
          }
          className="h-8 w-20 shrink-0"
          aria-label={posMessages.table.columns.discount}
          data-testid={`pos-line-discount-${line.id}`}
        />
      ) : null}
    </div>
  )
}

function RemoveButton({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => onRemove(id)}
      aria-label={posMessages.table.removeAriaLabel}
      data-testid={`pos-line-remove-${id}`}
    >
      <Trash2 aria-hidden className="size-4" />
    </Button>
  )
}

interface DestinationSelectProps {
  line: PosLine
  orders: PosOrder[]
  onChangeOrder: (id: string, orderClientId: string | null) => void
  onCreateOrderFor: (lineId: string) => void
  className?: string
}

function DestinationSelect({
  line,
  orders,
  onChangeOrder,
  onCreateOrderFor,
  className,
}: DestinationSelectProps) {
  const current = line.orderClientId ?? COUNTER_DESTINATION
  return (
    <Select
      value={current}
      onValueChange={(next) => {
        if (next === CREATE_NEW_DESTINATION) {
          onCreateOrderFor(line.id)
          return
        }
        if (next === COUNTER_DESTINATION) {
          onChangeOrder(line.id, null)
          return
        }
        onChangeOrder(line.id, next)
      }}
    >
      <SelectTrigger
        size="sm"
        className={className ?? 'h-8 w-full'}
        aria-label={posMessages.table.destination.ariaLabel}
        data-testid={`pos-line-destination-${line.id}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={COUNTER_DESTINATION}>{posMessages.table.destination.counter}</SelectItem>
        {orders.map((order, index) => (
          <SelectItem key={order.clientId} value={order.clientId}>
            {posMessages.table.destination.order(index + 1)}
          </SelectItem>
        ))}
        <SelectItem value={CREATE_NEW_DESTINATION}>
          {posMessages.table.destination.createNew}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function LineItemsTable({
  lines,
  orders,
  onUpdate,
  onRemove,
  onChangeOrder,
  onCreateOrderFor,
}: LineItemsTableProps) {
  if (lines.length === 0) {
    return (
      <div
        className="text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm"
        data-testid="pos-lines-empty"
      >
        {posMessages.table.empty}
      </div>
    )
  }

  return (
    <>
      {/* Desktop / wide-column — the historical table layout. Two
       *   things keep inputs usable when the column is wide enough:
       *   (1) `table-fixed` — declared column widths are authoritative
       *       instead of "preferred". Without this, browsers distribute
       *       excess container width across every column proportionally,
       *       so qty/price/discount cells stretch on wide screens and
       *       shrink on narrow ones. With table-fixed, only the concept
       *       column (width: auto) flexes; input cells stay put.
       *   (2) `min-w-[1000px]` — the sum of the fixed widths; below
       *       that the table would overflow and the trash button
       *       would scroll out of view (LIT-95 #2).
       *   We swap to the stacked-card layout below `@5xl` (1024px of
       *   *column* width, not viewport) — the parent in PosPage
       *   carries `@container`, so this responds to the actual
       *   column the table lives in, not the window. */}
      <div className="hidden rounded-md border @5xl:block" data-testid="pos-lines-table">
        <Table className="min-w-[1140px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>{posMessages.table.columns.concept}</TableHead>
              <TableHead className="w-20">{posMessages.table.columns.unit}</TableHead>
              <TableHead className="w-24">{posMessages.table.columns.quantity}</TableHead>
              <TableHead className="w-32">{posMessages.table.columns.unitPrice}</TableHead>
              <TableHead className="w-64">{posMessages.table.columns.discount}</TableHead>
              <TableHead className="w-36">{posMessages.table.columns.destination}</TableHead>
              <TableHead className="w-32 text-right">
                {posMessages.table.columns.lineTotal}
              </TableHead>
              <TableHead className="w-12" aria-label={posMessages.table.columns.actions} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const lineTotal = computeLineTotal({
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountType: line.discountType,
                discountValue: line.discountValue,
              })

              return (
                <TableRow key={line.id} data-testid={`pos-line-${line.id}`}>
                  <TableCell className="min-w-0">
                    <div className="truncate text-sm font-medium" title={line.concept}>
                      {line.concept}
                    </div>
                    {(line.dimensions || line.material) && (
                      <div className="text-muted-foreground truncate text-xs">
                        {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{line.unit}</TableCell>
                  <TableCell>
                    <QuantityInput line={line} onUpdate={onUpdate} />
                  </TableCell>
                  <TableCell>
                    <UnitPriceInput line={line} onUpdate={onUpdate} />
                  </TableCell>
                  <TableCell>
                    <DiscountFields line={line} onUpdate={onUpdate} />
                  </TableCell>
                  <TableCell>
                    <DestinationSelect
                      line={line}
                      orders={orders}
                      onChangeOrder={onChangeOrder}
                      onCreateOrderFor={onCreateOrderFor}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMXN(lineTotal)}</TableCell>
                  <TableCell>
                    <RemoveButton id={line.id} onRemove={onRemove} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Narrow column — stacked cards. Each card surfaces the trash
       *   button inline at the top-right so it's always reachable
       *   without a horizontal scroll. */}
      <div className="space-y-3 @5xl:hidden" data-testid="pos-lines-cards">
        {lines.map((line) => {
          const lineTotal = computeLineTotal({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountType: line.discountType,
            discountValue: line.discountValue,
          })

          return (
            <div
              key={line.id}
              className="space-y-3 rounded-md border p-3"
              data-testid={`pos-line-${line.id}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-medium" title={line.concept}>
                    {line.concept}
                  </div>
                  {(line.dimensions || line.material) && (
                    <div className="text-muted-foreground text-xs">
                      {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs">{line.unit}</div>
                </div>
                <RemoveButton id={line.id} onRemove={onRemove} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    {posMessages.table.columns.quantity}
                  </Label>
                  <QuantityInput line={line} onUpdate={onUpdate} />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    {posMessages.table.columns.unitPrice}
                  </Label>
                  <UnitPriceInput line={line} onUpdate={onUpdate} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">
                  {posMessages.table.columns.discount}
                </Label>
                <DiscountFields line={line} onUpdate={onUpdate} />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">
                  {posMessages.table.columns.destination}
                </Label>
                <DestinationSelect
                  line={line}
                  orders={orders}
                  onChangeOrder={onChangeOrder}
                  onCreateOrderFor={onCreateOrderFor}
                />
              </div>

              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-muted-foreground text-xs">
                  {posMessages.table.columns.lineTotal}
                </span>
                <span className="text-sm font-medium tabular-nums">{formatMXN(lineTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
