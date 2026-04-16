import { Link, useRouterState } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { useCurrentProfile, isAdmin } from '@/lib/queries/profiles'
import { cn } from '@/lib/utils'

import { layoutMessages } from './messages'
import { navItems, type NavItem } from './nav-items'

export function AppSidebar() {
  const profile = useCurrentProfile()
  const admin = isAdmin(profile.data)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const visibleItems = navItems.filter((item) => (item.adminOnly ? admin : true))

  return (
    <aside
      className="border-border/60 bg-card sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r md:block"
      data-testid="app-sidebar"
    >
      <nav className="flex h-full flex-col gap-1 p-3" aria-label={layoutMessages.nav.groupLabel}>
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium tracking-wider uppercase">
          {layoutMessages.nav.groupLabel}
        </p>
        {visibleItems.map((item) => (
          <SidebarLink key={item.path} item={item} active={isActive(pathname, item.path)} />
        ))}
      </nav>
    </aside>
  )
}

function isActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.path}
      data-testid={item.testId}
      className={cn(
        'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground font-medium'
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badgeSlot === 'low-stock' && (
        // Slot wired by M5-4. Hidden until a count > 0 is provided.
        <Badge
          variant="destructive"
          className="hidden"
          data-testid="nav-inventory-low-stock-badge"
        />
      )}
    </Link>
  )
}
