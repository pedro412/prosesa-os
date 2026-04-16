import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InviteUserError, useInviteUser } from '@/lib/queries/users'
import type { ProfileRole } from '@/types/profile'

import { usersMessages } from './messages'

interface UserInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  email: string
  fullName: string
  role: ProfileRole
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const blank: FormState = {
  email: '',
  fullName: '',
  role: 'ventas',
}

const dialogMessages = usersMessages.inviteDialog

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, dialogMessages.errors.emailRequired)
    .email(dialogMessages.errors.emailFormat),
  fullName: z.string().trim().optional(),
  role: z.enum(['admin', 'ventas']),
})

export function UserInviteDialog({ open, onOpenChange }: UserInviteDialogProps) {
  const [state, setState] = useState<FormState>(blank)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const invite = useInviteUser()

  function reset() {
    setState(blank)
    setFieldErrors({})
  }

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
      const result = await invite.mutateAsync({
        email: parsed.data.email.toLowerCase(),
        full_name: parsed.data.fullName ? parsed.data.fullName : null,
        role: parsed.data.role,
      })
      toast.success(usersMessages.toast.inviteSent(result.user.email))
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(translateInviteError(error))
    }
  }

  function handleOpenChange(value: boolean) {
    if (!value && !invite.isPending) reset()
    onOpenChange(value)
  }

  const submitting = invite.isPending
  const isAdminRole = state.role === 'admin'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="user-invite-dialog"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogMessages.title}</DialogTitle>
          <DialogDescription>{dialogMessages.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{dialogMessages.emailLabel}</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={state.email}
              onChange={(e) => onField('email')(e.target.value)}
              placeholder={dialogMessages.emailPlaceholder}
              aria-invalid={fieldErrors.email ? true : undefined}
              disabled={submitting}
              autoFocus
              data-testid="invite-email"
            />
            {fieldErrors.email && <p className="text-destructive text-sm">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name">{dialogMessages.fullNameLabel}</Label>
            <Input
              id="invite-name"
              value={state.fullName}
              onChange={(e) => onField('fullName')(e.target.value)}
              placeholder={dialogMessages.fullNamePlaceholder}
              disabled={submitting}
              data-testid="invite-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">{dialogMessages.roleLabel}</Label>
            <Select
              value={state.role}
              onValueChange={(value) => onField('role')(value as ProfileRole)}
              disabled={submitting}
            >
              <SelectTrigger id="invite-role" className="w-full" data-testid="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ventas">{usersMessages.roles.ventas}</SelectItem>
                <SelectItem value="admin">{usersMessages.roles.admin}</SelectItem>
              </SelectContent>
            </Select>
            {isAdminRole && (
              <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs">
                {dialogMessages.adminWarning}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={submitting} data-testid="invite-submit">
              {submitting ? dialogMessages.submitting : dialogMessages.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function translateInviteError(error: unknown): string {
  if (error instanceof InviteUserError) {
    switch (error.code) {
      case 'rate_limited':
        return usersMessages.toast.rateLimited
      case 'already_invited':
        return usersMessages.toast.alreadyInvited
      case 'invalid_email':
        return usersMessages.toast.invalidEmail
      case 'forbidden':
        return usersMessages.toast.forbidden
      case 'partial_role_update':
        return usersMessages.toast.partialRoleUpdate
      default:
        return usersMessages.toast.error
    }
  }
  return usersMessages.toast.error
}
