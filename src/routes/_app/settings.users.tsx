import { createFileRoute } from '@tanstack/react-router'

import { UsersSettings } from '@/features/users/UsersSettings'

export const Route = createFileRoute('/_app/settings/users')({
  component: UsersSettings,
})
