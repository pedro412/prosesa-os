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
import { type AdminProfileRow, useUpdateUserRole } from '@/lib/queries/users'

import { usersMessages } from './messages'

interface UserDemoteConfirmDialogProps {
  user: AdminProfileRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDemoteConfirmDialog({
  user,
  open,
  onOpenChange,
}: UserDemoteConfirmDialogProps) {
  const updateRole = useUpdateUserRole()
  const copy = usersMessages.demoteDialog

  async function handleConfirm() {
    if (!user) return
    try {
      await updateRole.mutateAsync({ id: user.id, role: 'ventas' })
      toast.success(usersMessages.toast.roleUpdated)
      onOpenChange(false)
    } catch (error) {
      toast.error(translate(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="user-demote-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {user && <DialogDescription>{copy.body(user.full_name ?? user.email)}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateRole.isPending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={updateRole.isPending}
            data-testid="user-demote-confirm"
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
  return usersMessages.toast.error
}
