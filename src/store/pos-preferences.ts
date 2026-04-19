import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Persisted per-workstation POS preferences. Counter workstations are
// physically shared by clerks, so per-workstation (localStorage) is the
// right granularity — not per-user. See LIT-86.

interface PosPreferencesState {
  lastCompanyId: string | null
  setLastCompanyId: (id: string | null) => void
}

export const usePosPreferencesStore = create<PosPreferencesState>()(
  persist(
    (set) => ({
      lastCompanyId: null,
      setLastCompanyId: (lastCompanyId) => set({ lastCompanyId }),
    }),
    {
      name: 'prosesa-pos-preferences',
      partialize: (state) => ({
        lastCompanyId: state.lastCompanyId,
      }),
    }
  )
)
