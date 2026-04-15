import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'

import { useSession } from '@/hooks/useAuth'

interface AuthenticatedRouteProps {
  children: ReactNode
}

// Client-side gate: redirects to /login when no session is present. RLS is
// still the authoritative enforcement — this guard just keeps signed-out
// users from staring at empty screens while their requests get rejected.
export function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  const session = useSession()

  if (session.isPending) return null
  if (!session.data) return <Navigate to="/login" replace />

  return <>{children}</>
}
