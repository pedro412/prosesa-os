import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { isDraftEmpty, type PosFormState } from '@/features/pos/pos-form-state'

// Persisted POS draft — the whole counter sale in progress — so a
// navigation, refresh, or tab-close doesn't wipe the operator's work.
// Per-workstation (localStorage); cross-device sync is Phase 2+.
//
// `version` is the migration hook for breaking shape changes to
// `PosFormState` / `PosLine`. Current versions:
//   1 — initial (LIT-87)
//   2 — LIT-37: adds `orders: PosOrder[]` and `orderClientId` on each
//       line. v1 drafts migrate by seeding an empty orders array and
//       null `orderClientId` on existing lines (all counter lines).
//   3 — LIT-107: adds `vendorId: string | null`. v2 drafts migrate by
//       seeding null (Sin vendedor) — the previous draft was captured
//       before attribution was possible, so that's the accurate state.
//
// Auto-empty: `setDraft` stores `null` when the incoming state carries
// no user-meaningful data (see `isDraftEmpty`). This is how post-Cobrar
// reset clears the draft without needing an explicit `clear()` call —
// `posFormReducer`'s `reset` keeps `companyId` but empties everything
// else, which `isDraftEmpty` treats as empty.

interface PosDraftStoreState {
  draft: PosFormState | null
  setDraft: (state: PosFormState) => void
  clear: () => void
}

export const usePosDraftStore = create<PosDraftStoreState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (state) => set({ draft: isDraftEmpty(state) ? null : state }),
      clear: () => set({ draft: null }),
    }),
    {
      name: 'prosesa-pos-draft',
      version: 3,
      partialize: (state) => ({ draft: state.draft }),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted
        let state = persisted as { draft: unknown }
        if (version < 2 && state.draft && typeof state.draft === 'object') {
          const draft = state.draft as PosFormState & { orders?: unknown }
          state = {
            draft: {
              ...draft,
              orders: Array.isArray(draft.orders) ? draft.orders : [],
              lines: (draft.lines ?? []).map((line) => ({
                ...line,
                orderClientId:
                  typeof (line as { orderClientId?: unknown }).orderClientId === 'string'
                    ? (line as { orderClientId: string }).orderClientId
                    : null,
              })),
            },
          }
        }
        if (version < 3 && state.draft && typeof state.draft === 'object') {
          const draft = state.draft as PosFormState & { vendorId?: unknown }
          state = {
            draft: {
              ...draft,
              vendorId:
                typeof draft.vendorId === 'string' && draft.vendorId.length > 0
                  ? draft.vendorId
                  : null,
            },
          }
        }
        return state
      },
    }
  )
)
