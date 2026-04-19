import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATALOG_UNITS, type CatalogUnit } from '@/lib/queries/catalog'

import { posMessages } from './messages'
import type { NewFreeFormLine } from './pos-form-state'

interface FreeFormLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (line: NewFreeFormLine) => void
}

interface FormState {
  concept: string
  dimensions: string
  material: string
  unit: CatalogUnit | ''
  quantity: string
  unitPrice: string
}

const blankState: FormState = {
  concept: '',
  dimensions: '',
  material: '',
  unit: '',
  quantity: '1',
  unitPrice: '',
}

type FieldErrors = Partial<Record<keyof FormState, string>>

// Dialog that captures a free-form (non-catalog) line. Minimal schema
// enforcement: concept required, quantity > 0, unit_price ≥ 0, unit
// picked. Discounts are applied later from the line row, not here.
//
// The inner form is split out so it can live inside `{open && ...}` —
// unmounting on close is what resets state cleanly without a
// useEffect (the `react-hooks/set-state-in-effect` rule forbids the
// naive reset pattern, and we follow the CustomerFormDialog shape for
// consistency).
export function FreeFormLineDialog({ open, onOpenChange, onAdd }: FreeFormLineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{posMessages.freeForm.title}</DialogTitle>
          <DialogDescription>{posMessages.freeForm.description}</DialogDescription>
        </DialogHeader>
        {open && (
          <FreeFormLineFormInner
            onAdd={(line) => {
              onAdd(line)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FreeFormLineFormInner({
  onAdd,
  onCancel,
}: {
  onAdd: (line: NewFreeFormLine) => void
  onCancel: () => void
}) {
  const [state, setState] = useState<FormState>(blankState)
  const [errors, setErrors] = useState<FieldErrors>({})

  function onField<K extends keyof FormState>(key: K) {
    return (value: FormState[K]) => setState((prev) => ({ ...prev, [key]: value }))
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (state.concept.trim() === '') {
      next.concept = posMessages.freeForm.errors.conceptRequired
    }
    if (state.unit === '') {
      next.unit = posMessages.freeForm.errors.unitRequired
    }
    const qty = Number(state.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      next.quantity = posMessages.freeForm.errors.quantityInvalid
    }
    const price = Number(state.unitPrice)
    if (!Number.isFinite(price) || price < 0) {
      next.unitPrice = posMessages.freeForm.errors.unitPriceInvalid
    }
    return next
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validate()
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    onAdd({
      concept: state.concept.trim(),
      dimensions: state.dimensions.trim() || undefined,
      material: state.material.trim() || undefined,
      unit: state.unit as CatalogUnit,
      quantity: Number(state.quantity),
      unitPrice: Number(state.unitPrice),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="pos-freeform-form">
      <div className="space-y-1.5">
        <Label htmlFor="ff-concept">{posMessages.freeForm.fields.concept} *</Label>
        <Input
          id="ff-concept"
          value={state.concept}
          onChange={(e) => onField('concept')(e.target.value)}
          placeholder={posMessages.freeForm.fields.conceptPlaceholder}
          aria-invalid={errors.concept ? true : undefined}
          autoFocus
        />
        {errors.concept && <p className="text-destructive text-xs">{errors.concept}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ff-dimensions">{posMessages.freeForm.fields.dimensions}</Label>
          <Input
            id="ff-dimensions"
            value={state.dimensions}
            onChange={(e) => onField('dimensions')(e.target.value)}
            placeholder={posMessages.freeForm.fields.dimensionsPlaceholder}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ff-material">{posMessages.freeForm.fields.material}</Label>
          <Input
            id="ff-material"
            value={state.material}
            onChange={(e) => onField('material')(e.target.value)}
            placeholder={posMessages.freeForm.fields.materialPlaceholder}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ff-unit">{posMessages.freeForm.fields.unit} *</Label>
          <Select value={state.unit} onValueChange={(next) => onField('unit')(next as CatalogUnit)}>
            <SelectTrigger id="ff-unit" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {CATALOG_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {posMessages.freeForm.units[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit && <p className="text-destructive text-xs">{errors.unit}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ff-qty">{posMessages.freeForm.fields.quantity} *</Label>
          <Input
            id="ff-qty"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.001"
            value={state.quantity}
            onChange={(e) => onField('quantity')(e.target.value)}
            aria-invalid={errors.quantity ? true : undefined}
          />
          {errors.quantity && <p className="text-destructive text-xs">{errors.quantity}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ff-price">{posMessages.freeForm.fields.unitPrice} *</Label>
          <MoneyInput
            id="ff-price"
            value={Number(state.unitPrice) || 0}
            // Keep the form state as a string so validate() and the
            // existing superRefine-style checks don't have to change —
            // empty ↔ 0 round-trips losslessly through the adapter.
            onChange={(next) => onField('unitPrice')(next > 0 ? String(next) : '')}
            aria-invalid={errors.unitPrice ? true : undefined}
          />
          {errors.unitPrice && <p className="text-destructive text-xs">{errors.unitPrice}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {posMessages.freeForm.cancel}
        </Button>
        <Button type="submit" data-testid="pos-freeform-submit">
          {posMessages.freeForm.add}
        </Button>
      </DialogFooter>
    </form>
  )
}
