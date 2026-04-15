import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/layout/PlaceholderPage'
import { layoutMessages } from '@/components/layout/messages'

export const Route = createFileRoute('/_app/pos')({
  component: () => <PlaceholderPage title={layoutMessages.nav.pos} testId="page-pos" />,
})
