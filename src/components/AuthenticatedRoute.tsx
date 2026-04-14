import type { ReactNode } from 'react'

interface AuthenticatedRouteProps {
  children: ReactNode
}

/**
 * Placeholder auth gate — real redirect/role logic lands in M1-13
 * (Supabase Auth). For now it's a passthrough so feature tickets can
 * wrap gated route components without churn later.
 */
export function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  return <>{children}</>
}
