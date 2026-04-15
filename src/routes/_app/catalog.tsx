import { createFileRoute } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/catalog')({
  component: CatalogRoute,
})

function CatalogRoute() {
  return (
    <AdminRoute>
      <PlaceholderPage title={layoutMessages.nav.catalog} testId="page-catalog" />
    </AdminRoute>
  )
}
