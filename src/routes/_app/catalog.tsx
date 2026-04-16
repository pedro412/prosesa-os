import { createFileRoute } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { CatalogPage } from '@/features/catalog/CatalogPage'

export const Route = createFileRoute('/_app/catalog')({
  component: CatalogRoute,
})

function CatalogRoute() {
  return (
    <AdminRoute>
      <CatalogPage />
    </AdminRoute>
  )
}
