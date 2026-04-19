import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { isDraftEmpty, type PosFormState } from '@/features/pos/pos-form-state'

// Persisted POS draft — the whole counter sale in progress — so a
// navigation, refresh, or tab-close doesn't wipe the operator's work.
// Per-workstation (localStorage); cross-device sync is Phase 2+.
//
// `version: 1` is the migration hook for the first time `PosFormState`
// or `PosLine` changes shape in a breaking way.
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
      version: 1,
      partialize: (state) => ({ draft: state.draft }),
    }
  )
)
