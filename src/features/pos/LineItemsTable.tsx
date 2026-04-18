import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { computeLineTotal, type LineDiscountType } from '@/lib/tax'

import { posMessages } from './messages'
import type { PosLine } from './pos-form-state'

interface LineItemsTableProps {
  lines: PosLine[]
  onUpdate: (id: string, patch: Partial<PosLine>) => void
  onRemove: (id: string) => void
}

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

// Parses a loosely-typed input into a safe number. Empty / invalid →
// 0 so the reducer's `isLineValid` can flag it, rather than letting
// NaN propagate through `computeLineTotal`.
function parseNumber(raw: string): number {
  if (raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

// Shows `value` right-padded so currency columns line up even across
// locale-specific grouping separators. `tabular-nums` carries the rest.
function formatMoney(n: number): string {
  return currency.format(n)
}

export function LineItemsTable({ lines, onUpdate, onRemove }: LineItemsTableProps) {
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
    <div className="overflow-x-auto rounded-md border" data-testid="pos-lines-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{posMessages.table.columns.concept}</TableHead>
            <TableHead className="w-16">{posMessages.table.columns.unit}</TableHead>
            <TableHead className="w-20">{posMessages.table.columns.quantity}</TableHead>
            <TableHead className="w-28">{posMessages.table.columns.unitPrice}</TableHead>
            <TableHead className="w-48">{posMessages.table.columns.discount}</TableHead>
            <TableHead className="w-28 text-right">{posMessages.table.columns.lineTotal}</TableHead>
            <TableHead className="w-10" aria-label={posMessages.table.columns.actions} />
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
                <TableCell>
                  <div className="text-sm font-medium">{line.concept}</div>
                  {(line.dimensions || line.material) && (
                    <div className="text-muted-foreground text-xs">
                      {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{line.unit}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => onUpdate(line.id, { unitPrice: parseNumber(e.target.value) })}
                    className="h-8 w-full"
                    aria-label={posMessages.table.columns.unitPrice}
                    data-testid={`pos-line-price-${line.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Select
                      value={line.discountType}
                      onValueChange={(next) =>
                        onUpdate(line.id, {
                          discountType: next as LineDiscountType,
                          // Reset value when switching to 'none' so the
                          // math helper doesn't see a stale number.
                          discountValue: next === 'none' ? 0 : line.discountValue,
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="h-8 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{posMessages.table.discountTypes.none}</SelectItem>
                        <SelectItem value="percent">
                          {posMessages.table.discountTypes.percent}
                        </SelectItem>
                        <SelectItem value="fixed">
                          {posMessages.table.discountTypes.fixed}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {line.discountType !== 'none' && (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.discountValue}
                        onChange={(e) =>
                          onUpdate(line.id, {
                            discountValue: parseNumber(e.target.value),
                          })
                        }
                        className="h-8 w-20"
                        aria-label={posMessages.table.columns.discount}
                        data-testid={`pos-line-discount-${line.id}`}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(lineTotal)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(line.id)}
                    aria-label={posMessages.table.removeAriaLabel}
                    data-testid={`pos-line-remove-${line.id}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
