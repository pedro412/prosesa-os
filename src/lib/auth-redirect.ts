// Runs once at app bootstrap, before the router mounts. If the current URL
// carries an invite or recovery token in its hash fragment (Supabase's way
// of delivering the session for those flows), we rewrite the URL so the
// router lands on /auth/update-password with the correct `flow` query
// param. The hash itself is preserved so `detectSessionInUrl` can still
// exchange the tokens — we only change the path + search.
//
// Handles the case where a dashboard invite link points at the site root
// (which the Supabase dashboard bakes in as `site_url`). Without this, the
// invited user would land on `/` inside the app shell and have no path to
// set a password.

const UPDATE_PASSWORD_PATH = '/auth/update-password'

export function redirectAuthHashToRoute(): void {
  if (typeof window === 'undefined') return

  const hash = window.location.hash
  if (!hash.startsWith('#')) return

  const params = new URLSearchParams(hash.slice(1))
  const type = params.get('type')
  if (type !== 'invite' && type !== 'recovery') return

  if (window.location.pathname === UPDATE_PASSWORD_PATH) return

  const url = new URL(window.location.href)
  url.pathname = UPDATE_PASSWORD_PATH
  url.searchParams.set('flow', type)
  window.history.replaceState(null, '', url.toString())
}
