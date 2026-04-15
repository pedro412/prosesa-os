import { UserMenu } from '@/features/auth/UserMenu'

import logoUrl from '@/assets/brand/prosesa-logo.png'

import { layoutMessages } from './messages'

export function AppHeader() {
  return (
    <header
      className="bg-background/90 border-border/60 sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-4 backdrop-blur md:px-6"
      data-testid="app-header"
    >
      <div className="flex items-center gap-3">
        {/*
         * PNG crop of the full logo — good enough for an internal tool at
         * 32px; swap for a dedicated SVG mark when an export arrives.
         */}
        <img src={logoUrl} alt="" aria-hidden className="size-8 shrink-0 object-contain" />
        <span className="font-display text-base font-semibold tracking-tight">
          {layoutMessages.app.title}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}
