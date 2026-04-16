import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type AdminProfileRow, useSoftDeleteUser } from '@/lib/queries/users'

import { usersMessages } from './messages'

interface UserDeleteDialogProps {
  user: AdminProfileRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDeleteDialog({ user, open, onOpenChange }: UserDeleteDialogProps) {
  const softDelete = useSoftDeleteUser()
  const copy = usersMessages.deleteDialog

  async function handleConfirm() {
    if (!user) return
    try {
      await softDelete.mutateAsync(user.id)
      toast.success(usersMessages.toast.deleted)
      onOpenChange(false)
    } catch (error) {
      toast.error(translate(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="user-delete-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {user && <DialogDescription>{copy.body(user.full_name ?? user.email)}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={softDelete.isPending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={softDelete.isPending}
            data-testid="user-delete-confirm"
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function translate(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? '').toLowerCase()
  if (msg.includes('último administrador') || msg.includes('ultimo administrador')) {
    return usersMessages.toast.lastAdmin
  }
  if (msg.includes('propio') || msg.includes('insufficient_privilege')) {
    return usersMessages.toast.selfBlocked
  }
  return usersMessages.toast.error
}
