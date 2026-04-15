import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/work-orders')({
  component: () => (
    <PlaceholderPage title={layoutMessages.nav.workOrders} testId="page-work-orders" />
  ),
})
