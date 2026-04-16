import type { ReactNode } from 'react'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { settingsMessages } from '@/features/settings/messages'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <AdminRoute>
      <div className="space-y-6" data-testid="page-settings">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{settingsMessages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{settingsMessages.page.description}</p>
        </header>
        <nav className="border-b" aria-label={settingsMessages.page.title}>
          <ul className="flex gap-1">
            <SettingsTab to="/settings/companies" testId="settings-tab-companies">
              {settingsMessages.tabs.companies}
            </SettingsTab>
            <SettingsTab to="/settings/users" testId="settings-tab-users">
              {settingsMessages.tabs.users}
            </SettingsTab>
          </ul>
        </nav>
        <Outlet />
      </div>
    </AdminRoute>
  )
}

interface SettingsTabProps {
  to: '/settings/companies' | '/settings/users'
  testId: string
  children: ReactNode
}

function SettingsTab({ to, testId, children }: SettingsTabProps) {
  return (
    <li>
      <Link
        to={to}
        data-testid={testId}
        className="-mb-px inline-block border-b-2 border-transparent px-3 pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        activeProps={{
          className:
            '-mb-px inline-block border-b-2 border-foreground px-3 pb-2 text-sm font-medium text-foreground',
        }}
      >
        {children}
      </Link>
    </li>
  )
}
