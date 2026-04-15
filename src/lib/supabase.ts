import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { env } from './env'

// Singleton Supabase client. Everything in the frontend — auth, queries, mutations —
// funnels through this one instance so session state stays coherent.
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
