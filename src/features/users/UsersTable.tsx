import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type AdminProfileRow,
  type InviteErrorCode,
  useRestoreUser,
  useUpdateUserActive,
  useUpdateUserRole,
} from '@/lib/queries/users'
import type { ProfileRole } from '@/types/profile'

import { usersMessages } from './messages'

interface UsersTableProps {
  rows: AdminProfileRow[]
  currentUserId: string | null
  onRequestDemote: (user: AdminProfileRow) => void
  onRequestDelete: (user: AdminProfileRow) => void
}

export function UsersTable({
  rows,
  currentUserId,
  onRequestDemote,
  onRequestDelete,
}: UsersTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{usersMessages.columns.email}</TableHead>
            <TableHead>{usersMessages.columns.name}</TableHead>
            <TableHead>{usersMessages.columns.role}</TableHead>
            <TableHead className="text-center">{usersMessages.columns.active}</TableHead>
            <TableHead>{usersMessages.columns.lastSignIn}</TableHead>
            <TableHead className="sr-only">{usersMessages.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={currentUserId === user.id}
              onRequestDemote={onRequestDemote}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

interface UserRowProps {
  user: AdminProfileRow
  isSelf: boolean
  onRequestDemote: (user: AdminProfileRow) => void
  onRequestDelete: (user: AdminProfileRow) => void
}

const lastSignInFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function UserRow({ user, isSelf, onRequestDemote, onRequestDelete }: UserRowProps) {
  const updateRole = useUpdateUserRole()
  const updateActive = useUpdateUserActive()
  const restore = useRestoreUser()

  const isDeleted = user.deleted_at !== null
  const role = user.role as ProfileRole

  function handleRoleChange(value: string) {
    const next = value as ProfileRole
    if (next === role) return
    if (next === 'ventas' && role === 'admin') {
      onRequestDemote(user)
      return
    }
    runRoleUpdate(next)
  }

  async function runRoleUpdate(role: ProfileRole) {
    try {
      await updateRole.mutateAsync({ id: user.id, role })
      toast.success(usersMessages.toast.roleUpdated)
    } catch (error) {
      toast.error(translateMutationError(error))
    }
  }

  async function handleActiveChange(value: boolean) {
    try {
      await updateActive.mutateAsync({ id: user.id, isActive: value })
      toast.success(value ? usersMessages.toast.activated : usersMessages.toast.deactivated)
    } catch (error) {
      toast.error(translateMutationError(error))
    }
  }

  async function handleRestore() {
    try {
      await restore.mutateAsync(user.id)
      toast.success(usersMessages.toast.restored)
    } catch (error) {
      toast.error(translateMutationError(error))
    }
  }

  return (
    <TableRow data-testid={`user-row-${user.id}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span>{user.email}</span>
          {isDeleted && (
            <Badge variant="outline" className="text-muted-foreground">
              {usersMessages.status.deletedBadge}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.full_name ?? '—'}</TableCell>
      <TableCell>
        <DisabledWhenSelf isSelf={isSelf}>
          <Select
            value={role}
            onValueChange={handleRoleChange}
            disabled={isSelf || isDeleted || updateRole.isPending}
          >
            <SelectTrigger
              className="w-32"
              data-testid={`user-role-${user.id}`}
              aria-label={usersMessages.columns.role}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{usersMessages.roles.admin}</SelectItem>
              <SelectItem value="ventas">{usersMessages.roles.ventas}</SelectItem>
            </SelectContent>
          </Select>
        </DisabledWhenSelf>
      </TableCell>
      <TableCell className="text-center">
        <DisabledWhenSelf isSelf={isSelf}>
          <Switch
            checked={user.is_active}
            onCheckedChange={handleActiveChange}
            disabled={isSelf || isDeleted || updateActive.isPending}
            data-testid={`user-active-${user.id}`}
            aria-label={usersMessages.columns.active}
          />
        </DisabledWhenSelf>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {user.last_sign_in_at
          ? lastSignInFormatter.format(new Date(user.last_sign_in_at))
          : usersMessages.status.never}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {isDeleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestore}
              disabled={restore.isPending}
              data-testid={`user-restore-${user.id}`}
            >
              {usersMessages.actions.restore}
            </Button>
          ) : (
            <DisabledWhenSelf isSelf={isSelf}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRequestDelete(user)}
                disabled={isSelf}
                data-testid={`user-delete-${user.id}`}
              >
                {usersMessages.actions.delete}
              </Button>
            </DisabledWhenSelf>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// Wraps a disabled control in a tooltip that explains the self-action
// rule. When isSelf is false, returns the children untouched so we
// don't add a wrapper for nothing.
function DisabledWhenSelf({ isSelf, children }: { isSelf: boolean; children: React.ReactNode }) {
  if (!isSelf) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span wrapper because disabled controls don't fire the events
            radix-tooltip listens for. */}
        <span className="inline-block">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{usersMessages.actions.selfBlocked}</TooltipContent>
    </Tooltip>
  )
}

// Map the Supabase / function error codes back to a Spanish toast.
// Keeps the row component decoupled from the InviteUserError class
// (it's only used by the invite mutation).
function translateMutationError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('último administrador') || msg.includes('ultimo administrador')) {
      return usersMessages.toast.lastAdmin
    }
    if (msg.includes('propio rol') || msg.includes('insufficient_privilege')) {
      return usersMessages.toast.selfBlocked
    }
  }
  // Treat the typed invite errors gracefully if anyone reuses this.
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    const code = (error as { code: InviteErrorCode }).code
    if (code === 'rate_limited') return usersMessages.toast.rateLimited
    if (code === 'forbidden') return usersMessages.toast.forbidden
  }
  return usersMessages.toast.error
}
