import { createFileRoute } from '@tanstack/react-router'

import { VendorsSettings } from '@/features/settings/VendorsSettings'

export const Route = createFileRoute('/_app/settings/vendors')({
  component: VendorsSettings,
})
