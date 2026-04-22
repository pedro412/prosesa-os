import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useVendors } from '@/lib/queries/vendors'

import { posMessages } from './messages'

interface VendorSelectProps {
  value: string | null
  onChange: (vendorId: string | null) => void
}

// Radix Select disallows empty-string values. Use an explicit sentinel
// for "Sin vendedor" so null / absence is a real selectable option.
const NONE = '__none__'

// POS vendor picker (LIT-107). Lists active vendors only — deactivated
// ones stay on historical notas but can't be attributed to new sales.
// "Sin vendedor" is the default and a legitimate outcome: Gustavo's
// walk-ins + any sale where nobody got explicit credit.
export function VendorSelect({ value, onChange }: VendorSelectProps) {
  const { data: vendors, isPending } = useVendors({ includeInactive: false })
  const messages = posMessages.vendor

  function handleChange(next: string) {
    onChange(next === NONE ? null : next)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pos-vendor">{messages.label}</Label>
      <Select value={value ?? NONE} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          id="pos-vendor"
          className="w-full"
          data-testid="pos-vendor-trigger"
          data-selected={value !== null}
        >
          <SelectValue placeholder={isPending ? messages.loading : messages.none} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{messages.none}</SelectItem>
          {(vendors ?? []).map((vendor) => (
            <SelectItem key={vendor.id} value={vendor.id}>
              {vendor.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
