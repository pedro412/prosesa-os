import { AuthError } from '@supabase/supabase-js'

import { authMessages } from './messages'

// Translate a Supabase auth error into a user-facing Spanish message.
// We lean on error codes where Supabase provides them and fall back to
// HTTP status heuristics, so copy changes live in one place (messages.ts).
export function translateLoginError(error: unknown): string {
  const e = authMessages.login.errors

  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid_credentials':
        return e.invalidCredentials
      case 'email_not_confirmed':
        return e.emailNotConfirmed
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return e.rateLimited
      default:
        break
    }
    if (error.status === 429) return e.rateLimited
    if (error.status === 400) return e.invalidCredentials
  }

  if (error instanceof TypeError) return e.network

  return e.generic
}
