import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TooltipProvider } from '@/components/ui/tooltip'
import { type AdminProfileRow, useAdminProfiles } from '@/lib/queries/users'
import { useCurrentProfile } from '@/lib/queries/profiles'

import { UserDeleteDialog } from './UserDeleteDialog'
import { UserDemoteConfirmDialog } from './UserDemoteConfirmDialog'
import { UserInviteDialog } from './UserInviteDialog'
import { UsersTable } from './UsersTable'
import { usersMessages } from './messages'

const PAGE_SIZE = 25

export function UsersSettings() {
  const [page, setPage] = useState(0)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminProfileRow | null>(null)
  const [demoting, setDemoting] = useState<AdminProfileRow | null>(null)

  const profile = useCurrentProfile()
  const currentUserId = profile.data?.id ?? null

  const { data, isPending, isError, isFetching } = useAdminProfiles({
    page,
    pageSize: PAGE_SIZE,
    includeDeleted,
  })

  function handleIncludeDeletedChange(value: boolean) {
    setIncludeDeleted(value)
    setPage(0)
  }

  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rows = data?.rows ?? []
  const currentPageNumber = page + 1
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  return (
    <TooltipProvider>
      <section className="space-y-4" data-testid="users-settings">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{usersMessages.section.title}</h2>
            <p className="text-muted-foreground text-sm">{usersMessages.section.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="flex items-center gap-2">
              <Switch
                id="users-include-deleted"
                checked={includeDeleted}
                onCheckedChange={handleIncludeDeletedChange}
                data-testid="users-include-deleted"
              />
              <Label htmlFor="users-include-deleted" className="text-sm font-normal">
                {usersMessages.toolbar.showDeletedLabel}
              </Label>
            </div>
            <Button onClick={() => setInviteOpen(true)} data-testid="user-invite-button">
              <Plus aria-hidden className="size-4" />
              {usersMessages.toolbar.inviteButton}
            </Button>
          </div>
        </header>

        {isPending && (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              {usersMessages.list.loading}
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card>
            <CardHeader>
              <CardTitle>{usersMessages.list.loadError}</CardTitle>
              <CardDescription>{usersMessages.toast.error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isPending && !isError && rows.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              {usersMessages.list.empty}
            </CardContent>
          </Card>
        )}

        {!isPending && !isError && rows.length > 0 && (
          <UsersTable
            rows={rows}
            currentUserId={currentUserId}
            onRequestDemote={(user) => setDemoting(user)}
            onRequestDelete={(user) => setDeleting(user)}
          />
        )}

        {!isPending && !isError && totalCount > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-muted-foreground text-sm" data-testid="users-count">
              {usersMessages.list.resultCount(rows.length, totalCount)}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground text-sm tabular-nums">
                {usersMessages.list.pageOf(currentPageNumber, totalPages)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={isFirstPage || isFetching}
                data-testid="users-prev"
              >
                {usersMessages.list.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLastPage || isFetching}
                data-testid="users-next"
              >
                {usersMessages.list.next}
              </Button>
            </div>
          </div>
        )}

        <UserInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

        <UserDemoteConfirmDialog
          user={demoting}
          open={demoting !== null}
          onOpenChange={(open) => {
            if (!open) setDemoting(null)
          }}
        />

        <UserDeleteDialog
          user={deleting}
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
        />
      </section>
    </TooltipProvider>
  )
}
