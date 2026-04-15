import type { Session } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { profileKeys } from '@/lib/queries/profiles'
import { sessionQueryKey } from '@/lib/auth-sync'
import { supabase } from '@/lib/supabase'

export function useSession() {
  return useQuery<Session | null>({
    queryKey: [...sessionQueryKey],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: Infinity,
  })
}

interface SignInInput {
  email: string
  password: string
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: SignInInput) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null)
      void queryClient.invalidateQueries({ queryKey: profileKeys.all })
    },
  })
}
