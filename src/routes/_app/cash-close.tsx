import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/cash-close')({
  component: () => (
    <PlaceholderPage title={layoutMessages.nav.cashClose} testId="page-cash-close" />
  ),
})
