import { createClient } from '@supabase/supabase-js'

import { env } from './env'

// Singleton Supabase client. Everything in the frontend — auth, queries, mutations —
// funnels through this one instance so session state stays coherent.
//
// TODO(lit-13): once the profiles migration lands on staging and
// `src/types/database.ts` is regenerated, swap to `createClient<Database>(...)`
// and delete the hand-typed fallbacks in `src/types/profile.ts`.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
