import { useState } from 'react'
import { Plus } from 'lucide-react'

import {
  ListEmptyCard,
  ListErrorCard,
  ListLoadingCard,
  ListPagination,
} from '@/components/layout/list-primitives'
import { Button } from '@/components/ui/button'
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

        {isPending && <ListLoadingCard skeleton={{ rows: PAGE_SIZE, columns: 5 }} />}

        {isError && (
          <ListErrorCard
            title={usersMessages.list.loadError}
            description={usersMessages.toast.error}
          />
        )}

        {!isPending && !isError && rows.length === 0 && (
          <ListEmptyCard message={usersMessages.list.empty} />
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
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            shownCount={rows.length}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            disabled={isFetching}
            messages={{
              resultCount: usersMessages.list.resultCount,
              pageOf: usersMessages.list.pageOf,
              previous: usersMessages.list.previous,
              next: usersMessages.list.next,
            }}
            testIds={{ count: 'users-count', prev: 'users-prev', next: 'users-next' }}
          />
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
