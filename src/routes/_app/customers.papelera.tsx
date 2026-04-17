import { createFileRoute } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { CustomersTrashList } from '@/features/customers/CustomersTrashList'

export const Route = createFileRoute('/_app/customers/papelera')({
  component: CustomersPapeleraPage,
})

// Admin-only. RLS also blocks the query for ventas, so even if the
// guard is bypassed the data never leaves the server — the route
// guard just avoids a broken-looking empty state for non-admins.
function CustomersPapeleraPage() {
  return (
    <AdminRoute>
      <CustomersTrashList />
    </AdminRoute>
  )
}
