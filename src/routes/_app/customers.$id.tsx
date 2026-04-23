import { createFileRoute } from '@tanstack/react-router'

import { CustomerDetail } from '@/features/customers/CustomerDetail'

export const Route = createFileRoute('/_app/customers/$id')({
  component: CustomerDetailRoute,
})

function CustomerDetailRoute() {
  const { id } = Route.useParams()
  return <CustomerDetail customerId={id} />
}
