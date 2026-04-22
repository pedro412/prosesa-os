import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Per-workstation "last time the operator looked at /work-orders".
// Anything newer than this is considered unread and drives the sidebar
// badge (LIT-103). localStorage is intentional: the counter PC is
// physically shared, and we want the badge to reflect what this
// browser has seen, not what a specific user account has seen.
//
// Cross-device sync is deferred — when we need it we add a
// `user_seen_work_orders` table and keep this store as the client
// cache layer on top.

interface OrdersUnreadState {
  lastSeenAt: string | null
  markSeen: () => void
  reset: () => void
}

export const useOrdersUnreadStore = create<OrdersUnreadState>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      markSeen: () => set({ lastSeenAt: new Date().toISOString() }),
      reset: () => set({ lastSeenAt: null }),
    }),
    {
      name: 'prosesa-orders-unread',
      partialize: (state) => ({
        lastSeenAt: state.lastSeenAt,
      }),
    }
  )
)
