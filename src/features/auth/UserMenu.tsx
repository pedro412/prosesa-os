// TEMPORARY SCAFFOLDING — LIT-13 only.
// This header + user menu exists solely so this ticket's acceptance criteria
// (logout from a header user menu) can be exercised manually. The real app
// shell with role-aware navigation lands in M1-14 (LIT-17). Do not extend
// this component; replace it when the proper layout arrives.

import { LogOut, User } from 'lucide-react'
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
import { useSession, useSignOut } from '@/hooks/useAuth'
import { useCurrentProfile } from '@/lib/queries/profiles'

export function DevAuthHeader() {
  const session = useSession()
  const profile = useCurrentProfile()
  const signOut = useSignOut()

  if (!session.data) return null

  const email = profile.data?.email ?? session.data.user.email ?? 'Usuario'
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
    <header className="bg-background/80 border-border/60 sticky top-0 z-10 flex h-12 items-center justify-end gap-2 border-b px-4 backdrop-blur">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="size-4" />
            <span className="max-w-[16ch] truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{email}</span>
            {role && <span className="text-muted-foreground text-xs capitalize">{role}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              void handleSignOut()
            }}
            disabled={signOut.isPending}
          >
            <LogOut className="mr-2 size-4" />
            {authMessages.logout.action}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
