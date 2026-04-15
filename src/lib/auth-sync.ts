import type { QueryClient } from '@tanstack/react-query'

import { profileKeys } from './queries/profiles'
import { supabase } from './supabase'

export const sessionQueryKey = ['auth', 'session'] as const

// Wire Supabase's auth events to the React Query cache. Call once at app
// bootstrap. Subsequent calls are no-ops so hot reloads don't stack listeners.
let initialized = false

export function initAuthSync(queryClient: QueryClient) {
  if (initialized) return
  initialized = true

  supabase.auth.onAuthStateChange((_event, session) => {
    queryClient.setQueryData(sessionQueryKey, session)
    void queryClient.invalidateQueries({ queryKey: profileKeys.all })
  })
}
