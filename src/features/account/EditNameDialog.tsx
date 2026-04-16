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
import { useCurrentProfile, useUpdateOwnFullName } from '@/lib/queries/profiles'

import { accountMessages } from './messages'

interface EditNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const messages = accountMessages.editName

const schema = z.object({
  fullName: z.string().trim().min(1, messages.errors.required).max(120, messages.errors.tooLong),
})

export function EditNameDialog({ open, onOpenChange }: EditNameDialogProps) {
  const profile = useCurrentProfile()
  const initial = profile.data?.full_name ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="edit-name-dialog"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{messages.dialog.title}</DialogTitle>
          <DialogDescription>{messages.dialog.description}</DialogDescription>
        </DialogHeader>
        {/* Conditional + keyed mount so a fresh useState picks up the
            current profile name each time the dialog opens, without
            useEffect-based resets. Mirrors the CustomerFormDialog
            pattern. */}
        {open && (
          <EditNameForm key={initial} initial={initial} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface EditNameFormProps {
  initial: string
  onClose: () => void
}

function EditNameForm({ initial, onClose }: EditNameFormProps) {
  const updateName = useUpdateOwnFullName()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = schema.safeParse({ fullName: value })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? messages.errors.required)
      return
    }
    setError(null)

    try {
      await updateName.mutateAsync(parsed.data.fullName)
      toast.success(messages.toast.success)
      onClose()
    } catch {
      toast.error(messages.toast.error)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="account-name">{messages.field.label}</Label>
        <Input
          id="account-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={messages.field.placeholder}
          maxLength={120}
          aria-invalid={error ? true : undefined}
          disabled={updateName.isPending}
          autoFocus
          data-testid="edit-name-input"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={updateName.isPending}>
          {messages.actions.cancel}
        </Button>
        <Button type="submit" disabled={updateName.isPending} data-testid="edit-name-submit">
          {updateName.isPending ? messages.actions.saving : messages.actions.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
