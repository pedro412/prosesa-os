import { createFileRoute, Outlet } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout/PageContainer'

// Layout-only wrapper for /work-orders and its children
// (/work-orders/$id). Matches the customers pattern: PageContainer caps
// page width for every subroute in one place. The index file wires the
// search-params schema; the $id file wires the detail route.
export const Route = createFileRoute('/_app/work-orders')({
  component: WorkOrdersLayout,
})

function WorkOrdersLayout() {
  return (
    <PageContainer>
      <Outlet />
    </PageContainer>
  )
}
