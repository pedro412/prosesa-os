import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/customers')({
  component: () => <PlaceholderPage title={layoutMessages.nav.customers} testId="page-customers" />,
})
