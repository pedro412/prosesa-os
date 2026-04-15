import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompanies } from '@/lib/queries/companies'
import { cn } from '@/lib/utils'

import { companiesMessages } from './messages'

interface CompanyPickerProps {
  value: string | null
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  // Optional test id override. Defaults to "company-picker" so tests can
  // target a single picker on a page; pass a unique id when multiple
  // pickers coexist.
  testId?: string
}

// Reusable dropdown backed by the live, active-only companies list.
// Consumers (POS sale/quotation form, eventually) own the selected state
// and any downstream effects — this component is intentionally dumb.
export function CompanyPicker({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  testId = 'company-picker',
}: CompanyPickerProps) {
  const { data, isPending, isError } = useCompanies()

  const loading = isPending
  const empty = !loading && !isError && (data?.length ?? 0) === 0

  const placeholderText = isError
    ? companiesMessages.picker.error
    : loading
      ? companiesMessages.picker.loading
      : (placeholder ?? companiesMessages.picker.placeholder)

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled || loading || isError || empty}
    >
      <SelectTrigger
        className={cn('w-full', className)}
        aria-label={companiesMessages.picker.label}
        data-testid={testId}
      >
        <SelectValue placeholder={placeholderText} />
      </SelectTrigger>
      <SelectContent>
        {data?.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            <span className="flex items-center gap-2">
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                {company.code}
              </span>
              <span>{company.nombre_comercial}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
