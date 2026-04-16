import { useState } from 'react'
import { LogOut, Pencil, User } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authMessages } from '@/features/auth/messages'
import { EditNameDialog } from '@/features/account/EditNameDialog'
import { accountMessages } from '@/features/account/messages'
import { useSession, useSignOut } from '@/hooks/useAuth'
import { useCurrentProfile } from '@/lib/queries/profiles'

// Dropdown-only user menu consumed by AppHeader. The previous DevAuthHeader
// wrapper (LIT-13 scaffolding) is gone now that the real app shell ships.

export function UserMenu() {
  const session = useSession()
  const profile = useCurrentProfile()
  const signOut = useSignOut()
  const [editOpen, setEditOpen] = useState(false)

  if (!session.data) return null

  const email = profile.data?.email ?? session.data.user.email ?? 'Usuario'
  const fullName = profile.data?.full_name?.trim() || null
  // Trigger shows the friendlier name when set; the dropdown still
  // surfaces both so the user can verify the underlying account.
  const triggerLabel = fullName ?? email
  const role = profile.data?.role

  async function handleSignOut() {
    try {
      await signOut.mutateAsync()
      toast.success(authMessages.logout.success)
    } catch {
      toast.error(authMessages.logout.error)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="auth-menu-trigger">
            <User className="size-4" />
            <span className="max-w-[20ch] truncate">{triggerLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{fullName ?? email}</span>
            {fullName && <span className="text-muted-foreground truncate text-xs">{email}</span>}
            {role && <span className="text-muted-foreground text-xs capitalize">{role}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setEditOpen(true)
            }}
            data-testid="auth-edit-name"
          >
            <Pencil className="mr-2 size-4" />
            {accountMessages.menu.editName}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              void handleSignOut()
            }}
            disabled={signOut.isPending}
            data-testid="auth-logout"
          >
            <LogOut className="mr-2 size-4" />
            {authMessages.logout.action}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditNameDialog open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
