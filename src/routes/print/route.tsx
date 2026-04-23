import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AuthenticatedRoute } from '@/components/guards'

import '../../features/print/detailed-note.css'

// Pathless layout for the print surfaces (LIT-43). Deliberately has no
// AppShell / sidebar / header — the user opens these pages to print,
// not to navigate. Auth gate still applies so a leaked print URL
// doesn't expose a nota to someone without a session.
export const Route = createFileRoute('/print')({
  component: PrintLayout,
})

function PrintLayout() {
  return (
    <AuthenticatedRoute>
      <Outlet />
    </AuthenticatedRoute>
  )
}
