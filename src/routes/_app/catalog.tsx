import { createFileRoute } from '@tanstack/react-router'

import { AuthenticatedRoute } from '@/components/guards'
import { CatalogPage } from '@/features/catalog/CatalogPage'

export const Route = createFileRoute('/_app/catalog')({
  component: CatalogRoute,
})

function CatalogRoute() {
  return (
    <AuthenticatedRoute>
      <CatalogPage />
    </AuthenticatedRoute>
  )
}
