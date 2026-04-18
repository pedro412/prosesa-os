import { createFileRoute } from '@tanstack/react-router'

import { PrinterSettings } from '@/features/settings/PrinterSettings'

export const Route = createFileRoute('/_app/settings/printer')({
  component: PrinterSettings,
})
