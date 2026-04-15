// Hand-typed Profile shape mirroring public.profiles. Temporary: when the
// profiles migration is applied to staging and `supabase gen types` is run,
// `src/types/database.ts` will provide the source of truth and this file can
// re-export from there (or be deleted if the Row alias suffices).

export type ProfileRole = 'admin' | 'ventas'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: ProfileRole
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}
