import {
  Boxes,
  ClipboardList,
  Coins,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { layoutMessages } from './messages'

// SPEC §8.2 order. The `key` matches a nav label in messages.ts so copy can
// be swapped in one place. `adminOnly` gates the item for ventas users (the
// server RLS is the real enforcement — the nav just avoids dead links).
// `badgeSlot` flags items that will later carry a status indicator (M5-4
// wires the low-stock badge onto `inventory`).

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  adminOnly: boolean
  badgeSlot?: 'low-stock'
  testId: string
}

export const navItems: readonly NavItem[] = [
  {
    path: '/pos',
    label: layoutMessages.nav.pos,
    icon: ShoppingCart,
    adminOnly: false,
    testId: 'nav-pos',
  },
  {
    path: '/work-orders',
    label: layoutMessages.nav.workOrders,
    icon: ClipboardList,
    adminOnly: false,
    testId: 'nav-work-orders',
  },
  {
    path: '/inventory',
    label: layoutMessages.nav.inventory,
    icon: Boxes,
    adminOnly: false,
    badgeSlot: 'low-stock',
    testId: 'nav-inventory',
  },
  {
    path: '/sales-notes',
    label: layoutMessages.nav.salesNotes,
    icon: Receipt,
    adminOnly: false,
    testId: 'nav-sales-notes',
  },
  {
    path: '/cash-close',
    label: layoutMessages.nav.cashClose,
    icon: Coins,
    adminOnly: false,
    testId: 'nav-cash-close',
  },
  {
    path: '/customers',
    label: layoutMessages.nav.customers,
    icon: Users,
    adminOnly: false,
    testId: 'nav-customers',
  },
  {
    path: '/catalog',
    label: layoutMessages.nav.catalog,
    icon: Tags,
    adminOnly: false,
    testId: 'nav-catalog',
  },
  {
    path: '/settings',
    label: layoutMessages.nav.settings,
    icon: Settings,
    adminOnly: true,
    testId: 'nav-settings',
  },
] as const
