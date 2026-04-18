import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pos-company">{posMessages.company.label}</Label>
      <Select value={value ?? ''} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger id="pos-company" className="w-full" data-testid="pos-company-trigger">
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
