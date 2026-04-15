import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { layoutMessages } from './messages'

// Placeholder for the active-company selector. The real data layer (companies
// table, active-company state) lands in M2. Shipping the slot now keeps the
// header stable when we wire it up — no layout churn later.
export function ActiveCompanySelector() {
  return (
    <Select disabled>
      <SelectTrigger className="w-56" data-testid="active-company-selector">
        <SelectValue placeholder={layoutMessages.company.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="placeholder" disabled>
          {layoutMessages.company.hint}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
