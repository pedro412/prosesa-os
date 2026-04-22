import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  type NewVendor,
  type Vendor,
  type VendorUpdate,
  useCreateVendor,
  useUpdateVendor,
} from '@/lib/queries/vendors'

import { settingsMessages } from './messages'

type VendorFormProps =
  | { mode: 'create'; onSaved: () => void; vendor?: never }
  | { mode: 'edit'; vendor: Vendor; onSaved: () => void }

type FieldErrors = Partial<Record<'nombre' | 'email', string>>

const schema = z.object({
  nombre: z.string().trim().min(1, settingsMessages.vendors.form.errors.nombreRequired),
  telefono: z.string().trim().max(32).optional().or(z.literal('')),
  email: z.union([
    z.string().trim().email(settingsMessages.vendors.form.errors.emailInvalid),
    z.literal(''),
  ]),
  is_active: z.boolean(),
})

export function VendorForm(props: VendorFormProps) {
  const messages = settingsMessages.vendors
  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()

  const initial: { nombre: string; telefono: string; email: string; is_active: boolean } =
    props.mode === 'edit'
      ? {
          nombre: props.vendor.nombre,
          telefono: props.vendor.telefono ?? '',
          email: props.vendor.email ?? '',
          is_active: props.vendor.is_active,
        }
      : { nombre: '', telefono: '', email: '', is_active: true }

  const [nombre, setNombre] = useState(initial.nombre)
  const [telefono, setTelefono] = useState(initial.telefono)
  const [email, setEmail] = useState(initial.email)
  const [isActive, setIsActive] = useState(initial.is_active)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const pending = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = schema.safeParse({ nombre, telefono, email, is_active: isActive })
    if (!parsed.success) {
      const errs: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'nombre' || field === 'email') errs[field] = issue.message
      }
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    const payload = {
      nombre: parsed.data.nombre,
      telefono:
        parsed.data.telefono && parsed.data.telefono.length > 0 ? parsed.data.telefono : null,
      email: parsed.data.email && parsed.data.email.length > 0 ? parsed.data.email : null,
      is_active: parsed.data.is_active,
    }

    try {
      if (props.mode === 'create') {
        await createMutation.mutateAsync(payload satisfies NewVendor)
        toast.success(messages.toast.createSuccess)
      } else {
        await updateMutation.mutateAsync({
          id: props.vendor.id,
          patch: payload satisfies VendorUpdate,
        })
        toast.success(messages.toast.updateSuccess)
      }
      props.onSaved()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      toast.error(`${messages.toast.error} ${detail}`.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="vendor-form">
      <div className="space-y-1.5">
        <Label htmlFor="vendor-nombre">{messages.form.nombreLabel}</Label>
        <Input
          id="vendor-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={messages.form.nombrePlaceholder}
          aria-invalid={fieldErrors.nombre ? true : undefined}
          data-testid="vendor-form-nombre"
          autoFocus
        />
        {fieldErrors.nombre && <p className="text-destructive text-xs">{fieldErrors.nombre}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vendor-telefono">{messages.form.telefonoLabel}</Label>
          <Input
            id="vendor-telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder={messages.form.telefonoPlaceholder}
            data-testid="vendor-form-telefono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor-email">{messages.form.emailLabel}</Label>
          <Input
            id="vendor-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={messages.form.emailPlaceholder}
            aria-invalid={fieldErrors.email ? true : undefined}
            data-testid="vendor-form-email"
          />
          {fieldErrors.email && <p className="text-destructive text-xs">{fieldErrors.email}</p>}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="vendor-active" className="text-sm font-medium">
            {messages.form.isActiveLabel}
          </Label>
          <p className="text-muted-foreground text-xs">{messages.form.isActiveHint}</p>
        </div>
        <Switch
          id="vendor-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          data-testid="vendor-form-active"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={props.onSaved}
          disabled={pending}
          data-testid="vendor-form-cancel"
        >
          {messages.form.cancel}
        </Button>
        <Button type="submit" disabled={pending} data-testid="vendor-form-submit">
          {pending ? messages.form.saving : messages.form.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
