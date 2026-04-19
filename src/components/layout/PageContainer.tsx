import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  // Pages add their own vertical spacing / grid / flex layouts on top.
  className?: string
}

// Shared width cap for every authenticated page except `/pos` (counter
// mode is intentionally full-bleed — it uses every pixel for the
// catalog + cart side-by-side).
//
// `max-w-7xl` = 1280px. Chosen because it keeps forms and lists from
// sprawling on 1440/1920/2560 monitors while still leaving room for
// two-column layouts (sales-note detail drawer, catalog edit dialogs).
// If staging QA finds this tight or loose, tune the one number below —
// callers don't need to change.
//
// Lives in `components/layout/` alongside `AppShell` / `AppHeader`
// because it's shell-adjacent, not a generic UI primitive like the
// ones in `components/ui/`.
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn('mx-auto w-full max-w-7xl', className)}>{children}</div>
}
