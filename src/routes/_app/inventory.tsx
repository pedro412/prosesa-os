import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/inventory')({
  component: () => <PlaceholderPage title={layoutMessages.nav.inventory} testId="page-inventory" />,
})
