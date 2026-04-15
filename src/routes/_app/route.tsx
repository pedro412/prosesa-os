import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AuthenticatedRoute } from '@/components/guards'
import { AppShell } from '@/components/layout/AppShell'

// Pathless layout for every authenticated route. Children mount under the
// app shell (header + sidebar) and inherit the auth gate. Routes that need
// an additional role check wrap their own content in <AdminRoute>.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AuthenticatedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthenticatedRoute>
  )
}
