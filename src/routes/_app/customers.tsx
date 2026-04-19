import { createFileRoute, Outlet } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout/PageContainer'

// Minimal layout wrapper. The two subroutes (index = active list,
// papelera = admin-only trash) carry their own chrome — there's no
// shared header or tabs to factor out yet, unlike /settings.
// `PageContainer` caps page width for both subroutes in one place.
export const Route = createFileRoute('/_app/customers')({
  component: CustomersLayout,
})

function CustomersLayout() {
  return (
    <PageContainer>
      <Outlet />
    </PageContainer>
  )
}
