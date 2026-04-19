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

  const selected = value !== null

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pos-company">{posMessages.company.label}</Label>
      <Select value={value ?? ''} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          id="pos-company"
          className={cn(
            'w-full',
            selected
              ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
              : 'border-destructive/30 text-muted-foreground'
          )}
          data-testid="pos-company-trigger"
          data-selected={selected}
        >
          {selected && <CheckCircle2Icon className="text-primary size-4" aria-hidden />}
          <SelectValue
            placeholder={isPending ? posMessages.company.loading : posMessages.company.placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {companies?.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.nombre_comercial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && <p className="text-destructive text-xs">{posMessages.company.loadError}</p>}
    </div>
  )
}
