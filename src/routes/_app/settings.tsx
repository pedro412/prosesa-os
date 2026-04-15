import { createFileRoute } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <AdminRoute>
      <PlaceholderPage title={layoutMessages.nav.settings} testId="page-settings" />
    </AdminRoute>
  )
}
