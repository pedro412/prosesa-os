import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Company, type CompanyUpdate, useUpdateCompany } from '@/lib/queries/companies'

import { settingsMessages } from './messages'

interface CompanyFormProps {
  company: Company
  // Fired after a successful save (including no-op saves where nothing
  // changed). Used by the edit dialog to close itself automatically.
  onSaved?: () => void
}

type FormState = {
  nombre_comercial: string
  razon_social: string
  rfc: string
  regimen_fiscal: string
  direccion_fiscal: string
  cp_fiscal: string
  logo_url: string
  iva_rate_pct: string
  iva_inclusive: boolean
  is_active: boolean
}

// IVA rate is stored as a 0–1 fraction (0.16) but edited as a percentage
// (16) for humans. Rounded to 4 decimal places so the DB numeric(5,4)
// accepts the value verbatim after division.
const toPct = (rate: number) => (rate * 100).toString()
const fromPct = (pct: string) => Math.round(Number(pct) * 100) / 10000

const schema = z.object({
  nombre_comercial: z.string().min(1, settingsMessages.form.errors.required),
  razon_social: z.string().min(1, settingsMessages.form.errors.required),
  rfc: z.string().min(1, settingsMessages.form.errors.required),
  iva_rate_pct: z.string().refine((v) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 && n <= 100
  }, settingsMessages.form.errors.ivaRateRange),
})

type FieldErrors = Partial<Record<keyof FormState, string>>

function toFormState(company: Company): FormState {
  return {
    nombre_comercial: company.nombre_comercial,
    razon_social: company.razon_social,
    rfc: company.rfc,
    regimen_fiscal: company.regimen_fiscal ?? '',
    direccion_fiscal: company.direccion_fiscal ?? '',
    cp_fiscal: company.cp_fiscal ?? '',
    logo_url: company.logo_url ?? '',
    iva_rate_pct: toPct(company.iva_rate),
    iva_inclusive: company.iva_inclusive,
    is_active: company.is_active,
  }
}

// Only send fields that actually changed. The Update row type accepts
// partials, so a no-op save is allowed but wasteful; returning early also
// gives nicer UX (toast still fires as "up to date").
function diffPatch(company: Company, state: FormState): CompanyUpdate {
  const patch: CompanyUpdate = {}
  const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim())

  if (state.nombre_comercial !== company.nombre_comercial) {
    patch.nombre_comercial = state.nombre_comercial
  }
  if (state.razon_social !== company.razon_social) {
    patch.razon_social = state.razon_social
  }
  if (state.rfc !== company.rfc) {
    patch.rfc = state.rfc
  }
  if (blankToNull(state.regimen_fiscal) !== company.regimen_fiscal) {
    patch.regimen_fiscal = blankToNull(state.regimen_fiscal)
  }
  if (blankToNull(state.direccion_fiscal) !== company.direccion_fiscal) {
    patch.direccion_fiscal = blankToNull(state.direccion_fiscal)
  }
  if (blankToNull(state.cp_fiscal) !== company.cp_fiscal) {
    patch.cp_fiscal = blankToNull(state.cp_fiscal)
  }
  if (blankToNull(state.logo_url) !== company.logo_url) {
    patch.logo_url = blankToNull(state.logo_url)
  }

  const nextRate = fromPct(state.iva_rate_pct)
  if (nextRate !== company.iva_rate) {
    patch.iva_rate = nextRate
  }
  if (state.iva_inclusive !== company.iva_inclusive) {
    patch.iva_inclusive = state.iva_inclusive
  }
  if (state.is_active !== company.is_active) {
    patch.is_active = state.is_active
  }
  return patch
}

export function CompanyForm({ company, onSaved }: CompanyFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(company))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const update = useUpdateCompany()
  const messages = settingsMessages.form

  function onField<K extends keyof FormState>(key: K) {
    return (value: FormState[K]) => setState((prev) => ({ ...prev, [key]: value }))
  }

  function handleReset() {
    setState(toFormState(company))
    setFieldErrors({})
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

    const patch = diffPatch(company, state)
    if (Object.keys(patch).length === 0) {
      toast.success(settingsMessages.toast.success)
      onSaved?.()
      return
    }

    try {
      await update.mutateAsync({ id: company.id, patch })
      toast.success(settingsMessages.toast.success)
      onSaved?.()
    } catch {
      toast.error(settingsMessages.toast.error)
    }
  }

  const submitting = update.isPending
  const testIdBase = `company-form-${company.code.toLowerCase()}`

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={handleSubmit}
      noValidate
      data-testid={testIdBase}
    >
      <div className="space-y-2 md:col-span-2">
        <Label>{messages.codeLabel}</Label>
        <Input value={company.code} readOnly disabled />
        <p className="text-muted-foreground text-xs">{messages.codeHelp}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-nombre`}>{messages.nombreComercialLabel}</Label>
        <Input
          id={`${testIdBase}-nombre`}
          value={state.nombre_comercial}
          onChange={(e) => onField('nombre_comercial')(e.target.value)}
          aria-invalid={fieldErrors.nombre_comercial ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.nombre_comercial && (
          <p className="text-destructive text-sm">{fieldErrors.nombre_comercial}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-razon`}>{messages.razonSocialLabel}</Label>
        <Input
          id={`${testIdBase}-razon`}
          value={state.razon_social}
          onChange={(e) => onField('razon_social')(e.target.value)}
          aria-invalid={fieldErrors.razon_social ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.razon_social && (
          <p className="text-destructive text-sm">{fieldErrors.razon_social}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-rfc`}>{messages.rfcLabel}</Label>
        <Input
          id={`${testIdBase}-rfc`}
          value={state.rfc}
          onChange={(e) => onField('rfc')(e.target.value.toUpperCase())}
          aria-invalid={fieldErrors.rfc ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.rfc && <p className="text-destructive text-sm">{fieldErrors.rfc}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-regimen`}>{messages.regimenFiscalLabel}</Label>
        <Input
          id={`${testIdBase}-regimen`}
          value={state.regimen_fiscal}
          onChange={(e) => onField('regimen_fiscal')(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${testIdBase}-direccion`}>{messages.direccionFiscalLabel}</Label>
        <Input
          id={`${testIdBase}-direccion`}
          value={state.direccion_fiscal}
          onChange={(e) => onField('direccion_fiscal')(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-cp`}>{messages.cpFiscalLabel}</Label>
        <Input
          id={`${testIdBase}-cp`}
          value={state.cp_fiscal}
          onChange={(e) => onField('cp_fiscal')(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-logo`}>{messages.logoUrlLabel}</Label>
        <Input
          id={`${testIdBase}-logo`}
          value={state.logo_url}
          onChange={(e) => onField('logo_url')(e.target.value)}
          inputMode="url"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${testIdBase}-iva`}>{messages.ivaRateLabel}</Label>
        <Input
          id={`${testIdBase}-iva`}
          value={state.iva_rate_pct}
          onChange={(e) => onField('iva_rate_pct')(e.target.value)}
          inputMode="decimal"
          aria-invalid={fieldErrors.iva_rate_pct ? true : undefined}
          disabled={submitting}
        />
        {fieldErrors.iva_rate_pct ? (
          <p className="text-destructive text-sm">{fieldErrors.iva_rate_pct}</p>
        ) : (
          <p className="text-muted-foreground text-xs">{messages.ivaRateHelp}</p>
        )}
      </div>

      <div className="flex items-start gap-3 md:col-span-2">
        <Checkbox
          id={`${testIdBase}-iva-inclusive`}
          checked={state.iva_inclusive}
          onCheckedChange={(v) => onField('iva_inclusive')(v === true)}
          disabled={submitting}
        />
        <div className="space-y-1">
          <Label htmlFor={`${testIdBase}-iva-inclusive`}>{messages.ivaInclusiveLabel}</Label>
          <p className="text-muted-foreground text-xs">{messages.ivaInclusiveHelp}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:col-span-2">
        <Checkbox
          id={`${testIdBase}-active`}
          checked={state.is_active}
          onCheckedChange={(v) => onField('is_active')(v === true)}
          disabled={submitting}
        />
        <Label htmlFor={`${testIdBase}-active`}>{messages.isActiveLabel}</Label>
      </div>

      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" onClick={handleReset} disabled={submitting}>
          {messages.reset}
        </Button>
        <Button type="submit" disabled={submitting} data-testid={`${testIdBase}-submit`}>
          {submitting ? messages.saving : messages.save}
        </Button>
      </div>
    </form>
  )
}
