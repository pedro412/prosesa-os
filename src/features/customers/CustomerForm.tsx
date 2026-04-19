import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  findRegimenByClave,
  type RegimenAplicaA,
  satRegimenByGroup,
} from '@/lib/constants/sat-regimen-fiscal'
import {
  findUsoCfdiByClave,
  satUsoCfdiByGroup,
  type UsoCfdiAplicaA,
} from '@/lib/constants/sat-uso-cfdi'
import {
  type Customer,
  DuplicateCustomerError,
  findCustomerByEmail,
  findCustomerByTelefono,
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
  // On a 23505 collision the form offers "Ver cliente existente". The
  // parent decides what happens — the list view closes the create
  // dialog and pops the found customer's edit dialog.
  onRequestEditExisting?: (customer: Customer) => void
}

interface FormState {
  nombre: string
  razon_social: string
  rfc: string
  regimen_fiscal: string
  cp_fiscal: string
  direccion_fiscal: string
  uso_cfdi: string
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
  direccion_fiscal: '',
  uso_cfdi: '',
  telefono: '',
  email: '',
  notas: '',
}

// Shown in the Select when the existing regimen_fiscal value isn't
// in the current SAT catalog (legacy free-text captures pre-LIT-80).
// Used as a sentinel: if the user opens the Select and picks anything
// else, the legacy value is overwritten on save.
const SELECT_NONE = '__none__'

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
    direccion_fiscal: customer.direccion_fiscal ?? '',
    uso_cfdi: customer.uso_cfdi ?? '',
    telefono: customer.telefono ?? '',
    email: customer.email ?? '',
    notas: customer.notas ?? '',
  }
}

// Zod schema. Nombre and telefono are required per LIT-80 AC; the rest
// stay optional but are format-validated when present. Blanks are
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
  direccion_fiscal: z.string().optional(),
  uso_cfdi: z.string().optional(),
  telefono: z
    .string()
    .min(1, customersMessages.form.errors.telefonoRequired)
    .regex(/^\d{10}$/, customersMessages.form.errors.telefonoFormat),
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

// Strip any non-digit and clip to 10. Handles typed digits and the
// "55 (938) 123-4567" paste case in a single code path.
function sanitizeTelefono(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

function buildCreatePayload(state: FormState): NewCustomer {
  return {
    nombre: state.nombre.trim(),
    razon_social: blankToNull(state.razon_social),
    rfc: state.rfc ? normalizeRfc(state.rfc) : null,
    regimen_fiscal: blankToNull(state.regimen_fiscal),
    cp_fiscal: blankToNull(state.cp_fiscal),
    direccion_fiscal: blankToNull(state.direccion_fiscal),
    uso_cfdi: blankToNull(state.uso_cfdi),
    telefono: state.telefono,
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

  const direccion = blankToNull(state.direccion_fiscal)
  if (direccion !== customer.direccion_fiscal) patch.direccion_fiscal = direccion

  const uso = blankToNull(state.uso_cfdi)
  if (uso !== customer.uso_cfdi) patch.uso_cfdi = uso

  if (state.telefono !== customer.telefono) patch.telefono = state.telefono

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
  onRequestEditExisting,
}: CustomerFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(customer, initialNombre))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  // Populated when a 23505 comes back — we fetch the colliding row so
  // the "Ver cliente existente" action knows where to jump to.
  const [duplicate, setDuplicate] = useState<{
    field: 'telefono' | 'email'
    customer: Customer
  } | null>(null)

  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const messages = customersMessages.form
  const toastMessages = customersMessages.toast

  const submitting = createMutation.isPending || updateMutation.isPending

  // Drives the Save button. Recomputes on every edit so the form
  // feels responsive; the schema is small enough that reparse cost
  // is negligible.
  const isValid = useMemo(() => schema.safeParse(state).success, [state])

  // If the stored regimen_fiscal doesn't match the current SAT catalog,
  // surface the legacy clave as a dedicated Select option so we don't
  // silently overwrite it when the user saves an untouched form.
  const regimenIsLegacy =
    state.regimen_fiscal !== '' && findRegimenByClave(state.regimen_fiscal) === null
  const usoIsLegacy = state.uso_cfdi !== '' && findUsoCfdiByClave(state.uso_cfdi) === null

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
    setDuplicate(null)

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
    } catch (err) {
      if (err instanceof DuplicateCustomerError) {
        const messageKey = err.field === 'telefono' ? 'telefonoDuplicate' : 'emailDuplicate'
        setFieldErrors({ [err.field]: messages.errors[messageKey] })
        // Fetch the colliding row so the action button has somewhere
        // to jump to. If the lookup fails we still show the field
        // error — users just won't get the shortcut.
        try {
          const dup =
            err.field === 'telefono'
              ? await findCustomerByTelefono(state.telefono)
              : await findCustomerByEmail(state.email)
          if (dup) setDuplicate({ field: err.field, customer: dup })
        } catch {
          // Swallow — the field error is enough to unblock the user.
        }
        return
      }
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
        <Label htmlFor="customer-nombre">
          {messages.nombreLabel} <span aria-hidden>*</span>
        </Label>
        <Input
          id="customer-nombre"
          value={state.nombre}
          onChange={(e) => onField('nombre')(e.target.value)}
          placeholder={messages.nombrePlaceholder}
          aria-invalid={fieldErrors.nombre ? true : undefined}
          aria-required
          disabled={submitting}
          autoFocus
        />
        {fieldErrors.nombre && <p className="text-destructive text-sm">{fieldErrors.nombre}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-telefono">
          {messages.telefonoLabel} <span aria-hidden>*</span>
        </Label>
        <Input
          id="customer-telefono"
          value={state.telefono}
          onChange={(e) => onField('telefono')(sanitizeTelefono(e.target.value))}
          placeholder={messages.telefonoPlaceholder}
          inputMode="numeric"
          maxLength={10}
          aria-invalid={fieldErrors.telefono ? true : undefined}
          aria-required
          disabled={submitting}
        />
        {fieldErrors.telefono && <p className="text-destructive text-sm">{fieldErrors.telefono}</p>}
        {duplicate?.field === 'telefono' && onRequestEditExisting && (
          <button
            type="button"
            className="text-primary text-sm font-medium underline underline-offset-2 hover:opacity-80"
            onClick={() => onRequestEditExisting(duplicate.customer)}
          >
            {messages.duplicateAction} · {duplicate.customer.nombre}
          </button>
        )}
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
        {duplicate?.field === 'email' && onRequestEditExisting && (
          <button
            type="button"
            className="text-primary text-sm font-medium underline underline-offset-2 hover:opacity-80"
            onClick={() => onRequestEditExisting(duplicate.customer)}
          >
            {messages.duplicateAction} · {duplicate.customer.nombre}
          </button>
        )}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="customer-razon">{messages.razonSocialLabel}</Label>
        <Input
          id="customer-razon"
          value={state.razon_social}
          onChange={(e) => onField('razon_social')(e.target.value)}
          disabled={submitting}
        />
        <p className="text-muted-foreground text-xs">{messages.razonSocialHelp}</p>
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
        <Select
          value={state.regimen_fiscal === '' ? SELECT_NONE : state.regimen_fiscal}
          onValueChange={(value) => onField('regimen_fiscal')(value === SELECT_NONE ? '' : value)}
          disabled={submitting}
        >
          <SelectTrigger id="customer-regimen" className="w-full">
            <SelectValue placeholder={messages.regimenFiscalPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>—</SelectItem>
            {regimenIsLegacy && (
              <SelectItem value={state.regimen_fiscal}>
                {messages.regimenFiscalLegacy(state.regimen_fiscal)}
              </SelectItem>
            )}
            {(['fisica', 'moral', 'ambas'] as RegimenAplicaA[]).map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{messages.regimenFiscalGroups[group]}</SelectLabel>
                {satRegimenByGroup[group].map((r) => (
                  <SelectItem key={r.clave} value={r.clave}>
                    {r.clave} · {r.descripcion}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
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
        <Label htmlFor="customer-uso-cfdi">{messages.usoCfdiLabel}</Label>
        <Select
          value={state.uso_cfdi === '' ? SELECT_NONE : state.uso_cfdi}
          onValueChange={(value) => onField('uso_cfdi')(value === SELECT_NONE ? '' : value)}
          disabled={submitting}
        >
          <SelectTrigger id="customer-uso-cfdi" className="w-full">
            <SelectValue placeholder={messages.usoCfdiPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>—</SelectItem>
            {usoIsLegacy && (
              <SelectItem value={state.uso_cfdi}>
                {messages.usoCfdiLegacy(state.uso_cfdi)}
              </SelectItem>
            )}
            {(['ambas', 'fisica', 'moral'] as UsoCfdiAplicaA[]).map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{messages.usoCfdiGroups[group]}</SelectLabel>
                {satUsoCfdiByGroup[group].map((u) => (
                  <SelectItem key={u.clave} value={u.clave}>
                    {u.clave} · {u.descripcion}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="customer-direccion">{messages.direccionFiscalLabel}</Label>
        <Textarea
          id="customer-direccion"
          value={state.direccion_fiscal}
          onChange={(e) => onField('direccion_fiscal')(e.target.value)}
          placeholder={messages.direccionFiscalPlaceholder}
          rows={2}
          disabled={submitting}
        />
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

      <div className="flex flex-col-reverse items-stretch gap-2 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground text-xs">{messages.requiredHint}</p>
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              {messages.cancel}
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting || !isValid}
            data-testid="customer-form-submit"
          >
            {submitting ? messages.saving : messages.save}
          </Button>
        </div>
      </div>
    </form>
  )
}
