import type { ReactNode } from 'react'

import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

interface AppShellProps {
  children: ReactNode
}

// Persistent layout for the authenticated app: header on top, sidebar on
// the left (visible at md: ≥ 768px per LIT-18 scope), main content scrolls.
// Below 768px the sidebar is hidden — a mobile drawer is a future
// enhancement, not required for tablet/desktop workflow.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-x-auto p-6 pb-24 md:p-8 md:pb-24" data-testid="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
