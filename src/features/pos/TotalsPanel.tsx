import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { computeTotals, formatIvaRate } from '@/lib/tax'

import { posMessages } from './messages'
import type { PosLine } from './pos-form-state'

interface TotalsPanelProps {
  lines: PosLine[]
  ivaRate: number | null
  ivaInclusive: boolean | null
  className?: string
}

// Currency formatter locked to MXN — the project is single-currency per
// CLAUDE.md §4 rule 9. Created once at module scope; cheap.
const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

function formatMoney(n: number): string {
  return currency.format(n)
}

// Totals panel. Always visible; shows placeholders until a company is
// picked (we need iva_rate + iva_inclusive to compute anything).
export function TotalsPanel({ lines, ivaRate, ivaInclusive, className }: TotalsPanelProps) {
  const hasCompany = ivaRate !== null && ivaInclusive !== null

  const totals = hasCompany
    ? computeTotals({
        lines: lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountType: line.discountType,
          discountValue: line.discountValue,
        })),
        ivaRate,
        ivaInclusive,
      })
    : null

  const ratePct = hasCompany ? formatIvaRate(ivaRate) : ''
  const hint = hasCompany
    ? ivaInclusive
      ? posMessages.totals.ivaInclusiveHint
      : posMessages.totals.ivaExclusiveHint
    : null

  return (
    <Card className={cn('', className)} data-testid="pos-totals">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{posMessages.totals.total}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row
          label={posMessages.totals.subtotal}
          value={totals ? formatMoney(totals.subtotal) : posMessages.totals.empty}
          testId="pos-totals-subtotal"
        />
        <Row
          label={
            hasCompany ? posMessages.totals.ivaLabel(ratePct) : posMessages.totals.ivaLabel('—')
          }
          value={totals ? formatMoney(totals.iva) : posMessages.totals.empty}
          testId="pos-totals-iva"
        />
        <div className="border-t pt-2">
          <Row
            label={<span className="font-semibold">{posMessages.totals.total}</span>}
            value={
              <span className="text-lg font-semibold">
                {totals ? formatMoney(totals.total) : posMessages.totals.empty}
              </span>
            }
            testId="pos-totals-total"
          />
        </div>
        {hint && <p className="text-muted-foreground pt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  testId,
}: {
  label: React.ReactNode
  value: React.ReactNode
  testId: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4" data-testid={testId}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
