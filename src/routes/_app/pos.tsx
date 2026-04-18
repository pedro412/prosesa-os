import { createFileRoute } from '@tanstack/react-router'

import { PosPage } from '@/features/pos/PosPage'

export const Route = createFileRoute('/_app/pos')({
  component: PosPage,
})
