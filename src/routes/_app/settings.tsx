import { createFileRoute } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { CompaniesSettings } from '@/features/settings/CompaniesSettings'
import { settingsMessages } from '@/features/settings/messages'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <AdminRoute>
      <div className="space-y-6" data-testid="page-settings">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{settingsMessages.page.title}</h1>
          <p className="text-muted-foreground text-sm">{settingsMessages.page.description}</p>
        </header>
        <CompaniesSettings />
      </div>
    </AdminRoute>
  )
}
