import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UNASSIGNED_VENDOR } from '@/lib/queries/sales-notes'
import { useVendors } from '@/lib/queries/vendors'

import { salesNotesMessages } from './messages'

interface VendorFilterProps {
  value: string | null
  onChange: (vendorId: string | null) => void
}

// Sentinels. Radix Select disallows empty-string values, so `__all__`
// represents "no filter." `UNASSIGNED_VENDOR` is re-exported from the
// query layer and filters to vendor_id IS NULL rows (notas sin
// atribución).
const ALL = '__all__'

// Small dropdown filter for the sales-notes list (LIT-107). Vendors
// are admin-curated and small in count (5–15 expected), so a plain
// Select beats the typeahead pattern used by CustomerFilter. Includes
// inactive vendors in the dropdown so historical filters still work
// when a vendedor has been deactivated.
export function VendorFilter({ value, onChange }: VendorFilterProps) {
  const { data: vendors } = useVendors({ includeInactive: true })
  const messages = salesNotesMessages.filters

  function handleChange(next: string) {
    if (next === ALL) return onChange(null)
    onChange(next)
  }

  const current = value ?? ALL

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger data-testid="sales-notes-filter-vendor">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{messages.vendorAll}</SelectItem>
        <SelectItem value={UNASSIGNED_VENDOR}>{messages.vendorUnassigned}</SelectItem>
        <SelectSeparator />
        {(vendors ?? []).map((vendor) => (
          <SelectItem key={vendor.id} value={vendor.id}>
            {vendor.nombre}
            {!vendor.is_active ? ` · ${messages.vendorInactiveHint}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
