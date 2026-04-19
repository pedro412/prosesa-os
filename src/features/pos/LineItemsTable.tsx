import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { PosLine } from './pos-form-state'

interface LineItemsTableProps {
  lines: PosLine[]
  onUpdate: (id: string, patch: Partial<PosLine>) => void
  onRemove: (id: string) => void
}

// Parses a loosely-typed input into a safe number. Empty / invalid →
// 0 so the reducer's `isLineValid` can flag it, rather than letting
// NaN propagate through `computeLineTotal`.
function parseNumber(raw: string): number {
  if (raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
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
    // The Table primitive already wraps itself in `overflow-x-auto`.
    // Two things keep inputs usable at any viewport width:
    //   (1) `table-fixed` — declared column widths are authoritative
    //       instead of "preferred". Without this, browsers distribute
    //       excess container width across every column proportionally,
    //       so qty/price/discount cells stretch on wide screens and
    //       shrink on narrow ones. With table-fixed, only the concept
    //       column (width: auto) flexes; input cells stay put.
    //   (2) `min-w-[1000px]` — the sum of the fixed widths; below that
    //       the table overflows and the container scrolls horizontally
    //       instead of squeezing anything.
    <div className="rounded-md border" data-testid="pos-lines-table">
      <Table className="min-w-[1000px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>{posMessages.table.columns.concept}</TableHead>
            <TableHead className="w-20">{posMessages.table.columns.unit}</TableHead>
            <TableHead className="w-24">{posMessages.table.columns.quantity}</TableHead>
            <TableHead className="w-32">{posMessages.table.columns.unitPrice}</TableHead>
            <TableHead className="w-64">{posMessages.table.columns.discount}</TableHead>
            <TableHead className="w-32 text-right">{posMessages.table.columns.lineTotal}</TableHead>
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
                  <MoneyInput
                    value={line.unitPrice}
                    onChange={(next) => onUpdate(line.id, { unitPrice: next })}
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
                      <SelectTrigger size="sm" className="h-8 w-36 shrink-0">
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
                    {line.discountType === 'fixed' ? (
                      <MoneyInput
                        value={line.discountValue}
                        onChange={(next) => onUpdate(line.id, { discountValue: next })}
                        className="h-8 w-24 shrink-0"
                        aria-label={posMessages.table.columns.discount}
                        data-testid={`pos-line-discount-${line.id}`}
                      />
                    ) : line.discountType === 'percent' ? (
                      // Percent stays a plain numeric input — it's
                      // a 0..100 value, not a money amount, so
                      // thousands separators would be noise.
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
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMXN(lineTotal)}</TableCell>
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
