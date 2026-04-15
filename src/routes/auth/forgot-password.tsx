import { type FormEvent, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translateForgotPasswordError } from '@/features/auth/errors'
import { authMessages } from '@/features/auth/messages'
import { supabase } from '@/lib/supabase'

const forgotPasswordSchema = z.object({
  email: z.string().email(authMessages.forgotPassword.errors.invalidEmail),
})

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordRoute,
})

function ForgotPasswordRoute() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const messages = authMessages.forgotPassword

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? messages.errors.invalidEmail)
      return
    }

    setEmailError(null)
    setSubmitting(true)

    try {
      const redirectTo = `${window.location.origin}/auth/update-password?flow=recovery`
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo,
      })
      if (error) throw error
      // Always report success to avoid leaking which addresses have accounts.
      setSent(true)
      toast.success(messages.success)
    } catch (error) {
      toast.error(translateForgotPasswordError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-background text-foreground grid min-h-svh place-items-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{messages.title}</CardTitle>
          <CardDescription>{sent ? messages.success : messages.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/login" data-testid="forgot-password-back-to-login">
                {messages.backToLogin}
              </Link>
            </Button>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">{messages.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={messages.emailPlaceholder}
                  aria-invalid={emailError ? true : undefined}
                  disabled={submitting}
                  data-testid="forgot-password-email"
                />
                {emailError && <p className="text-destructive text-sm">{emailError}</p>}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                data-testid="forgot-password-submit"
              >
                {submitting ? messages.submitting : messages.submit}
              </Button>

              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">{messages.backToLogin}</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
