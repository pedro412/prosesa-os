import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  type CatalogCategory,
  type NewCatalogCategory,
  useCreateCategory,
  useUpdateCategory,
} from '@/lib/queries/catalog'

import { catalogMessages } from '../messages'

type Mode = 'create' | 'edit'

export interface CategoryFormProps {
  mode: Mode
  category?: CatalogCategory
  onSaved?: (category: CatalogCategory) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  is_active: boolean
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const blankState: FormState = {
  name: '',
  is_active: true,
}

function toFormState(category: CatalogCategory | undefined): FormState {
  if (!category) return blankState
  return {
    name: category.name,
    is_active: category.is_active,
  }
}

const messages = catalogMessages.categories
const formMessages = messages.form

const schema = z.object({
  name: z.string().trim().min(1, formMessages.errors.nameRequired),
  is_active: z.boolean(),
})

function buildCreatePayload(state: FormState): NewCatalogCategory {
  return {
    name: state.name.trim(),
    is_active: state.is_active,
  }
}

function buildUpdatePatch(category: CatalogCategory, state: FormState) {
  const patch: Record<string, unknown> = {}
  const trimmedName = state.name.trim()
  if (trimmedName !== category.name) patch.name = trimmedName
  if (state.is_active !== category.is_active) patch.is_active = state.is_active
  return patch
}

// Postgres unique-violation code (the `lower(name)` partial unique index).
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export function CategoryForm({ mode, category, onSaved, onCancel }: CategoryFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(category))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const submitting = createMutation.isPending || updateMutation.isPending

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
      } else if (category) {
        const patch = buildUpdatePatch(category, state)
        if (Object.keys(patch).length === 0) {
          toast.success(messages.toast.updateSuccess)
          onSaved?.(category)
          return
        }
        const updated = await updateMutation.mutateAsync({ id: category.id, patch })
        toast.success(messages.toast.updateSuccess)
        onSaved?.(updated)
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        setFieldErrors({ name: formMessages.errors.nameTaken })
        return
      }
      toast.error(messages.toast.genericError)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate data-testid="category-form">
      <div className="space-y-2">
        <Label htmlFor="category-name">{formMessages.nameLabel}</Label>
        <Input
          id="category-name"
          value={state.name}
          onChange={(e) => onField('name')(e.target.value)}
          placeholder={formMessages.namePlaceholder}
          aria-invalid={fieldErrors.name ? true : undefined}
          disabled={submitting}
          autoFocus
        />
        {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div className="space-y-1">
          <Label htmlFor="category-active">{formMessages.isActiveLabel}</Label>
          <p className="text-muted-foreground text-xs">{formMessages.isActiveHint}</p>
        </div>
        <Switch
          id="category-active"
          checked={state.is_active}
          onCheckedChange={(value) => onField('is_active')(value)}
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {formMessages.cancel}
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="category-form-submit">
          {submitting ? formMessages.saving : formMessages.save}
        </Button>
      </div>
    </form>
  )
}
