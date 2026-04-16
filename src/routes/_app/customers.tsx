import { createFileRoute } from '@tanstack/react-router'

import { CustomersList } from '@/features/customers/CustomersList'

export const Route = createFileRoute('/_app/customers')({
  component: CustomersList,
})
