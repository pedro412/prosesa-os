import { useCallback, useEffect, useState } from 'react'

import { useSession } from '@/hooks/useAuth'

// Persisted per-user on this device. Keyed by auth uid so that two users
// sharing a workstation don't step on each other's last choice.
//
// POS will wire this up so each new sale/quotation pre-selects whichever
// company the cashier used last. It's a convenience only — the sale
// creation form still requires an explicit confirmation before a folio is
// generated, and nothing else in the app reads from here.

const STORAGE_PREFIX = 'prosesa:lastCompanyId:'

function readFromStorage(storageKey: string | null): string | null {
  if (!storageKey) return null
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

export interface UseLastUsedCompanyResult {
  companyId: string | null
  setCompanyId: (next: string | null) => void
}

export function useLastUsedCompany(): UseLastUsedCompanyResult {
  const session = useSession()
  const userId = session.data?.user.id ?? null
  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null

  const [companyId, setState] = useState<string | null>(() => readFromStorage(storageKey))

  // Re-sync when the active user changes (login, logout, switch account).
  useEffect(() => {
    setState(readFromStorage(storageKey))
  }, [storageKey])

  const setCompanyId = useCallback(
    (next: string | null) => {
      if (!storageKey) return
      try {
        if (next === null) {
          window.localStorage.removeItem(storageKey)
        } else {
          window.localStorage.setItem(storageKey, next)
        }
      } catch {
        // Storage may be unavailable (private mode, quota) — silently fall
        // back to in-memory state so the UI stays usable.
      }
      setState(next)
    },
    [storageKey]
  )

  return { companyId, setCompanyId }
}
