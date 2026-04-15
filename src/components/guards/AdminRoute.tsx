import { type ReactNode, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { authMessages } from '@/features/auth/messages'
import { useSession } from '@/hooks/useAuth'
import { isAdmin, useCurrentProfile } from '@/lib/queries/profiles'

import { AuthenticatedRoute } from './AuthenticatedRoute'

interface AdminRouteProps {
  children: ReactNode
}

// Admin gate on top of AuthenticatedRoute. Non-admin sessions are bounced to
// '/' with a toast. RLS rejects their queries anyway; this keeps the UI
// honest. Only renders children after the profile has loaded and the role is
// confirmed, to avoid flashing admin chrome to a ventas user.
export function AdminRoute({ children }: AdminRouteProps) {
  return (
    <AuthenticatedRoute>
      <AdminGate>{children}</AdminGate>
    </AuthenticatedRoute>
  )
}

function AdminGate({ children }: AdminRouteProps) {
  const session = useSession()
  const profile = useCurrentProfile()
  const navigate = useNavigate()
  const bouncedRef = useRef(false)

  // AuthenticatedRoute already guarantees session.data is truthy when we
  // render, but TS doesn't know that — keep the guard explicit.
  const allowed = Boolean(session.data) && profile.data !== undefined && isAdmin(profile.data)
  const denied = profile.isSuccess && !isAdmin(profile.data)

  useEffect(() => {
    if (denied && !bouncedRef.current) {
      bouncedRef.current = true
      toast.error(authMessages.routeGuards.adminOnly)
      void navigate({ to: '/', replace: true })
    }
  }, [denied, navigate])

  if (profile.isPending) return null
  if (denied) return <Navigate to="/" replace />
  if (!allowed) return null

  return <>{children}</>
}
