import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  type Customer,
  type NewCustomer,
  useCreateCustomer,
  useUpdateCustomer,
} from '@/lib/queries/customers'

import { customersMessages } from './messages'
import { isValidRfc, normalizeRfc } from './rfcValidation'

type Mode = 'create' | 'edit'

export interface CustomerFormProps {
  mode: Mode
  // Required in edit mode, ignored in create.
  customer?: Customer
  // Pre-fill nombre on create (POS typeahead hand-off).
  initialNombre?: string
  // Fires after a successful save. The parent (dialog) typically
  // closes itself here.
  onSaved?: (customer: Customer) => void
  onCancel?: () => void
}

interface FormState {
  nombre: string
  razon_social: string
  rfc: string
  regimen_fiscal: string
  cp_fiscal: string
  telefono: string
  email: string
  notas: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const blankState: FormState = {
  nombre: '',
  razon_social: '',
  rfc: '',
  regimen_fiscal: '',
  cp_fiscal: '',
  telefono: '',
  email: '',
  notas: '',
}

function toFormState(customer: Customer | undefined, initialNombre: string | undefined): FormState {
  if (!customer) {
    return { ...blankState, nombre: initialNombre ?? '' }
  }
  return {
    nombre: customer.nombre,
    razon_social: customer.razon_social ?? '',
    rfc: customer.rfc ?? '',
    regimen_fiscal: customer.regimen_fiscal ?? '',
    cp_fiscal: customer.cp_fiscal ?? '',
    telefono: customer.telefono ?? '',
    email: customer.email ?? '',
    notas: customer.notas ?? '',
  }
}

// Zod schema. All text fields are allowed empty; blanks are later
// converted to null before the DB write so we don't pollute rows with
// empty strings.
const schema = z.object({
  nombre: z.string().trim().min(1, customersMessages.form.errors.nombreRequired),
  razon_social: z.string().optional(),
  rfc: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === '' || isValidRfc(normalizeRfc(v)), {
      message: customersMessages.form.errors.rfcFormat,
    }),
  regimen_fiscal: z.string().optional(),
  cp_fiscal: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === '' || /^\d{5}$/.test(v.trim()), {
      message: customersMessages.form.errors.cpFormat,
    }),
  telefono: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v.trim() === '') return true
        return z.string().email().safeParse(v.trim()).success
      },
      { message: customersMessages.form.errors.emailFormat }
    ),
  notas: z.string().optional(),
})

const blankToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

// Builds the payload to send. In edit mode we produce a partial with
// only the fields that actually changed; in create mode we send the
// full shape.
function buildCreatePayload(state: FormState): NewCustomer {
  return {
    nombre: state.nombre.trim(),
    razon_social: blankToNull(state.razon_social),
    rfc: state.rfc ? normalizeRfc(state.rfc) : null,
    regimen_fiscal: blankToNull(state.regimen_fiscal),
    cp_fiscal: blankToNull(state.cp_fiscal),
    telefono: blankToNull(state.telefono),
    email: blankToNull(state.email),
    notas: blankToNull(state.notas),
  }
}

function buildUpdatePatch(customer: Customer, state: FormState) {
  const patch: Record<string, unknown> = {}
  const trimmedNombre = state.nombre.trim()
  if (trimmedNombre !== customer.nombre) patch.nombre = trimmedNombre

  const razon = blankToNull(state.razon_social)
  if (razon !== customer.razon_social) patch.razon_social = razon

  const rfc = state.rfc ? normalizeRfc(state.rfc) : null
  if (rfc !== customer.rfc) patch.rfc = rfc

  const regimen = blankToNull(state.regimen_fiscal)
  if (regimen !== customer.regimen_fiscal) patch.regimen_fiscal = regimen

  const cp = blankToNull(state.cp_fiscal)
  if (cp !== customer.cp_fiscal) patch.cp_fiscal = cp

  const tel = blankToNull(state.telefono)
  if (tel !== customer.telefono) patch.telefono = tel

  const email = blankToNull(state.email)
  if (email !== customer.email) patch.email = email

  const notas = blankToNull(state.notas)
  if (notas !== customer.notas) patch.notas = notas

  return patch
}

export function CustomerForm({
  mode,
  customer,
  initialNombre,
  onSaved,
  onCancel,
}: CustomerFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(customer, initialNombre))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const messages = customersMessages.form
  const toastMessages = customersMessages.toast

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
        toast.success(toastMessages.createSuccess)
        onSaved?.(created)
      } else if (customer) {
        const patch = buildUpdatePatch(customer, state)
        if (Object.keys(patch).length === 0) {
          toast.success(toastMessages.updateSuccess)
          onSaved?.(customer)
          return
        }
        const updated = await updateMutation.mutateAsync({ id: customer.id, patch })
        toast.success(toastMessages.updateSuccess)
        onSaved?.(updated)
      }
    } catch {
      toast.error(toastMessages.genericError)
    }
  }

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={handleSubmit}
      noValidate
      data-testid="customer-form"
    >
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="customer-nombre">{messages.nombreLabel}</Label>
        <Input
          id="customer-nombre"
          value={state.nombre}
          onChange={(e) => onField('nombre')(e.target.value)}
          placeholder={messages.nombrePlaceholder}
          aria-invalid={fieldErrors.nombre ? true : undefined}
          disabled={submitting}
          autoFocus
        />
        {fieldErrors.nombre && <p className="text-destructive text-sm">{fieldErrors.nombre}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-razon">{messages.razonSocialLabel}</Label>
        <Input
          id="customer-razon"
          value={state.razon_social}
          onChange={(e) => onField('razon_social')(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-rfc">{messages.rfcLabel}</Label>
        <Input
          id="customer-rfc"
          value={state.rfc}
          onChange={(e) => onField('rfc')(e.target.value.toUpperCase())}
          placeholder={messages.rfcPlaceholder}
          maxLength={13}
          aria-invalid={fieldErrors.rfc ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.rfc && <p className="text-destructive text-sm">{fieldErrors.rfc}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-regimen">{messages.regimenFiscalLabel}</Label>
        <Input
          id="customer-regimen"
          value={state.regimen_fiscal}
          onChange={(e) => onField('regimen_fiscal')(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-cp">{messages.cpFiscalLabel}</Label>
        <Input
          id="customer-cp"
          value={state.cp_fiscal}
          onChange={(e) => onField('cp_fiscal')(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          aria-invalid={fieldErrors.cp_fiscal ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.cp_fiscal && (
          <p className="text-destructive text-sm">{fieldErrors.cp_fiscal}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-telefono">{messages.telefonoLabel}</Label>
        <Input
          id="customer-telefono"
          value={state.telefono}
          onChange={(e) => onField('telefono')(e.target.value)}
          inputMode="tel"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-email">{messages.emailLabel}</Label>
        <Input
          id="customer-email"
          value={state.email}
          onChange={(e) => onField('email')(e.target.value)}
          inputMode="email"
          aria-invalid={fieldErrors.email ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.email && <p className="text-destructive text-sm">{fieldErrors.email}</p>}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="customer-notas">{messages.notasLabel}</Label>
        <Textarea
          id="customer-notas"
          value={state.notas}
          onChange={(e) => onField('notas')(e.target.value)}
          placeholder={messages.notasPlaceholder}
          rows={3}
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2 md:col-span-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {messages.cancel}
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="customer-form-submit">
          {submitting ? messages.saving : messages.save}
        </Button>
      </div>
    </form>
  )
}
