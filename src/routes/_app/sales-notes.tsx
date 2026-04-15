import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/sales-notes')({
  component: () => (
    <PlaceholderPage title={layoutMessages.nav.salesNotes} testId="page-sales-notes" />
  ),
})
