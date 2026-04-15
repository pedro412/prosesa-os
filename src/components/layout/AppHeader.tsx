import { UserMenu } from '@/features/auth/UserMenu'

import { ActiveCompanySelector } from './ActiveCompanySelector'
import { layoutMessages } from './messages'

export function AppHeader() {
  return (
    <header
      className="bg-background/90 border-border/60 sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-4 backdrop-blur md:px-6"
      data-testid="app-header"
    >
      <div className="flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-semibold">
          P
        </span>
        <span className="text-base font-semibold tracking-tight">{layoutMessages.app.title}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ActiveCompanySelector />
        <UserMenu />
      </div>
    </header>
  )
}
