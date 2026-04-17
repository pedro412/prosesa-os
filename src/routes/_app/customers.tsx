import { createFileRoute, Outlet } from '@tanstack/react-router'

// Minimal layout wrapper. The two subroutes (index = active list,
// papelera = admin-only trash) carry their own chrome — there's no
// shared header or tabs to factor out yet, unlike /settings.
export const Route = createFileRoute('/_app/customers')({
  component: CustomersLayout,
})

function CustomersLayout() {
  return <Outlet />
}
