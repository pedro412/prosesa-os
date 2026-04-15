import { AuthError } from '@supabase/supabase-js'

import { authMessages } from './messages'

// Translate a Supabase auth error into a user-facing Spanish message for each
// of the three auth surfaces (login, updatePassword, forgotPassword). Copy
// changes live in messages.ts so we only touch one place.

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

export function translateUpdatePasswordError(error: unknown): string {
  const e = authMessages.updatePassword.errors

  if (error instanceof AuthError) {
    switch (error.code) {
      case 'same_password':
        return e.samePassword
      case 'weak_password':
        return e.weakPassword
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return e.rateLimited
      default:
        break
    }
    if (error.status === 429) return e.rateLimited
    if (error.message.toLowerCase().includes('weak')) return e.weakPassword
  }

  if (error instanceof TypeError) return e.network
  return e.generic
}

export function translateForgotPasswordError(error: unknown): string {
  const e = authMessages.forgotPassword.errors

  if (error instanceof AuthError) {
    if (
      error.code === 'over_request_rate_limit' ||
      error.code === 'over_email_send_rate_limit' ||
      error.status === 429
    ) {
      return e.rateLimited
    }
  }

  if (error instanceof TypeError) return e.network
  return e.generic
}
