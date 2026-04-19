import { CheckCircle2Icon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { type Company, useCompanies } from '@/lib/queries/companies'

import { posMessages } from './messages'

interface CompanySelectProps {
  value: string | null
  onChange: (companyId: string | null, company: Company | null) => void
}

// Static per-company tint, keyed by `companies.code`. Phase 1 has
// exactly two razones sociales (A / B, seeded in migration
// 20260415222315) with stable codes, so a hardcoded map is cheaper
// than a `companies.display_color` column + admin picker. If a third
// razón social ever lands, extend this map — or migrate to a DB-backed
// scheme (LIT-86 stretch).
//
// A keeps the brand teal to anchor "Prosesa" as the default-looking
// option; B uses amber for clear separation at a glance.
const COMPANY_TINT: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  A: {
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    text: 'text-primary',
    dot: 'bg-primary',
  },
  B: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
}

const FALLBACK_TINT = {
  bg: 'bg-muted',
  border: 'border-muted-foreground/30',
  text: 'text-foreground',
  dot: 'bg-muted-foreground',
}

function tintFor(code: string | undefined) {
  if (!code) return FALLBACK_TINT
  return COMPANY_TINT[code] ?? FALLBACK_TINT
}

// Inline company picker — required on every sale per CLAUDE.md §6.
// Auto-picks the single active company when only one is available so
// the operator doesn't have to touch it in single-razón-social setups
// (Phase 1 has two, but staging may boot with one during early QA).
export function CompanySelect({ value, onChange }: CompanySelectProps) {
  const { data: companies, isPending, isError } = useCompanies({ includeInactive: false })

  function handleChange(next: string) {
    const picked = companies?.find((c) => c.id === next) ?? null
    onChange(picked?.id ?? null, picked)
  }

  const selectedCompany = value ? companies?.find((c) => c.id === value) : null
  const selected = selectedCompany !== null && selectedCompany !== undefined
  const activeTint = tintFor(selectedCompany?.code)

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pos-company">{posMessages.company.label}</Label>
      <Select value={value ?? ''} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          id="pos-company"
          className={cn(
            'w-full',
            selected
              ? cn(activeTint.bg, activeTint.border, activeTint.text, 'font-semibold')
              : 'border-destructive/30 text-muted-foreground'
          )}
          data-testid="pos-company-trigger"
          data-selected={selected}
        >
          {selected && <CheckCircle2Icon className={cn('size-4', activeTint.text)} aria-hidden />}
          <SelectValue
            placeholder={isPending ? posMessages.company.loading : posMessages.company.placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {companies?.map((company) => {
            const tint = tintFor(company.code)
            return (
              <SelectItem key={company.id} value={company.id}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn('inline-block size-2.5 rounded-full', tint.dot)}
                    aria-hidden
                  />
                  <span>{company.nombre_comercial}</span>
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      {isError && <p className="text-destructive text-xs">{posMessages.company.loadError}</p>}
    </div>
  )
}
