import { createFileRoute } from '@tanstack/react-router'

import { CompaniesSettings } from '@/features/settings/CompaniesSettings'

export const Route = createFileRoute('/_app/settings/companies')({
  component: CompaniesSettings,
})
