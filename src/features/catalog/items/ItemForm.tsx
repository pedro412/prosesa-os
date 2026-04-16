import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CATALOG_PRICING_MODES,
  CATALOG_UNITS,
  type CatalogItem,
  type CatalogPricingMode,
  type CatalogUnit,
  type NewCatalogItem,
  useCategories,
  useCreateItem,
  useUpdateItem,
} from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

type Mode = 'create' | 'edit'

export interface ItemFormProps {
  mode: Mode
  item?: CatalogItem
  onSaved?: (item: CatalogItem) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  description: string
  category_id: string
  unit: CatalogUnit
  pricing_mode: CatalogPricingMode
  // Held as a string so the field can be empty during typing; parsed
  // on submit. Ignored when pricing_mode === 'variable'.
  price: string
  is_active: boolean
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const blankState: FormState = {
  name: '',
  description: '',
  category_id: '',
  unit: 'pieza',
  pricing_mode: 'fixed',
  price: '',
  is_active: true,
}

function toFormState(item: CatalogItem | undefined): FormState {
  if (!item) return blankState
  return {
    name: item.name,
    description: item.description ?? '',
    category_id: item.category_id,
    unit: item.unit as CatalogUnit,
    pricing_mode: item.pricing_mode as CatalogPricingMode,
    price: String(item.price ?? 0),
    is_active: item.is_active,
  }
}

const messages = catalogMessages.items
const formMessages = messages.form

const schema = z
  .object({
    name: z.string().trim().min(1, formMessages.errors.nameRequired),
    description: z.string().optional(),
    category_id: z.string().min(1, formMessages.errors.categoryRequired),
    unit: z.enum(CATALOG_UNITS as readonly [CatalogUnit, ...CatalogUnit[]]),
    pricing_mode: z.enum(
      CATALOG_PRICING_MODES as readonly [CatalogPricingMode, ...CatalogPricingMode[]]
    ),
    price: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.pricing_mode === 'fixed') {
      const trimmed = data.price.trim()
      if (trimmed === '' || Number.isNaN(Number(trimmed)) || Number(trimmed) < 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: formMessages.errors.priceInvalid,
        })
      }
    }
  })

const blankToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function buildCreatePayload(state: FormState): NewCatalogItem {
  const isVariable = state.pricing_mode === 'variable'
  return {
    name: state.name.trim(),
    description: blankToNull(state.description),
    category_id: state.category_id,
    unit: state.unit,
    pricing_mode: state.pricing_mode,
    price: isVariable ? 0 : Number(state.price.trim()),
    is_active: state.is_active,
  }
}

function buildUpdatePatch(item: CatalogItem, state: FormState) {
  const patch: Record<string, unknown> = {}
  const trimmedName = state.name.trim()
  if (trimmedName !== item.name) patch.name = trimmedName

  const description = blankToNull(state.description)
  if (description !== item.description) patch.description = description

  if (state.category_id !== item.category_id) patch.category_id = state.category_id
  if (state.unit !== item.unit) patch.unit = state.unit
  if (state.pricing_mode !== item.pricing_mode) patch.pricing_mode = state.pricing_mode

  const isVariable = state.pricing_mode === 'variable'
  const newPrice = isVariable ? 0 : Number(state.price.trim())
  if (newPrice !== Number(item.price)) patch.price = newPrice

  if (state.is_active !== item.is_active) patch.is_active = state.is_active

  return patch
}

export function ItemForm({ mode, item, onSaved, onCancel }: ItemFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(item))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const createMutation = useCreateItem()
  const updateMutation = useUpdateItem()
  // includeInactive so editing an item that points to an inactive category
  // can still display + save without forcing a category change.
  const categoriesQuery = useCategories({ includeInactive: true })

  const submitting = createMutation.isPending || updateMutation.isPending
  const showPriceField = state.pricing_mode === 'fixed'

  function onField<K extends keyof FormState>(key: K) {
    return (value: FormState[K]) => setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = schema.safeParse(state)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') errors[field as keyof FormState] = issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    try {
      if (mode === 'create') {
        const created = await createMutation.mutateAsync(buildCreatePayload(state))
        toast.success(messages.toast.createSuccess)
        onSaved?.(created)
      } else if (item) {
        const patch = buildUpdatePatch(item, state)
        if (Object.keys(patch).length === 0) {
          toast.success(messages.toast.updateSuccess)
          onSaved?.(item)
          return
        }
        const updated = await updateMutation.mutateAsync({ id: item.id, patch })
        toast.success(messages.toast.updateSuccess)
        onSaved?.(updated)
      }
    } catch {
      toast.error(messages.toast.genericError)
    }
  }

  const categoryOptions = categoriesQuery.data ?? []

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={handleSubmit}
      noValidate
      data-testid="item-form"
    >
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="item-name">{formMessages.nameLabel}</Label>
        <Input
          id="item-name"
          value={state.name}
          onChange={(e) => onField('name')(e.target.value)}
          placeholder={formMessages.namePlaceholder}
          aria-invalid={fieldErrors.name ? true : undefined}
          disabled={submitting}
          autoFocus
        />
        {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="item-description">{formMessages.descriptionLabel}</Label>
        <Textarea
          id="item-description"
          value={state.description}
          onChange={(e) => onField('description')(e.target.value)}
          placeholder={formMessages.descriptionPlaceholder}
          rows={3}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-category">{formMessages.categoryLabel}</Label>
        <Select
          value={state.category_id || undefined}
          onValueChange={(value) => onField('category_id')(value)}
          disabled={submitting || categoriesQuery.isPending}
        >
          <SelectTrigger
            id="item-category"
            className="w-full"
            aria-invalid={fieldErrors.category_id ? true : undefined}
          >
            <SelectValue placeholder={formMessages.categoryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.category_id && (
          <p className="text-destructive text-sm">{fieldErrors.category_id}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-unit">{formMessages.unitLabel}</Label>
        <Select
          value={state.unit}
          onValueChange={(value) => onField('unit')(value as CatalogUnit)}
          disabled={submitting}
        >
          <SelectTrigger id="item-unit" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATALOG_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {catalogMessages.units[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-pricing-mode">{formMessages.pricingModeLabel}</Label>
        <Select
          value={state.pricing_mode}
          onValueChange={(value) => onField('pricing_mode')(value as CatalogPricingMode)}
          disabled={submitting}
        >
          <SelectTrigger id="item-pricing-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATALOG_PRICING_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {catalogMessages.pricingMode[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showPriceField ? (
        <div className="space-y-2">
          <Label htmlFor="item-price">{formMessages.priceLabel}</Label>
          <Input
            id="item-price"
            value={state.price}
            onChange={(e) => onField('price')(e.target.value)}
            placeholder={formMessages.pricePlaceholder}
            inputMode="decimal"
            aria-invalid={fieldErrors.price ? true : undefined}
            disabled={submitting}
          />
          {fieldErrors.price && <p className="text-destructive text-sm">{fieldErrors.price}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-muted-foreground">{formMessages.priceLabel}</Label>
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
            {formMessages.variableHint}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-md border p-3 md:col-span-2">
        <div className="space-y-1">
          <Label htmlFor="item-active">{formMessages.isActiveLabel}</Label>
          <p className="text-muted-foreground text-xs">{formMessages.isActiveHint}</p>
        </div>
        <Switch
          id="item-active"
          checked={state.is_active}
          onCheckedChange={(value) => onField('is_active')(value)}
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2 md:col-span-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {formMessages.cancel}
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="item-form-submit">
          {submitting ? formMessages.saving : formMessages.save}
        </Button>
      </div>
    </form>
  )
}
