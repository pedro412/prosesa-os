import { type FormEvent, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translateUpdatePasswordError } from '@/features/auth/errors'
import { authMessages, type AuthFlow } from '@/features/auth/messages'
import { useSession } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Min length mirrors supabase/config.toml [auth] minimum_password_length.
const MIN_PASSWORD_LENGTH = 6

const flowSchema = z.enum(['invite', 'recovery', 'change']).catch('change')

const updatePasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, authMessages.updatePassword.errors.minLength),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: authMessages.updatePassword.errors.mismatch,
    path: ['confirm'],
  })

type FieldErrors = Partial<Record<'password' | 'confirm', string>>

export const Route = createFileRoute('/auth/update-password')({
  component: UpdatePasswordRoute,
  validateSearch: (search): { flow: AuthFlow } => ({
    flow: flowSchema.parse(search.flow),
  }),
})

function UpdatePasswordRoute() {
  const { flow } = Route.useSearch()
  const navigate = useNavigate()
  const session = useSession()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const messages = authMessages.updatePassword
  const title = messages.titles[flow]
  const description = messages.descriptions[flow]

  if (session.isPending) return null

  if (!session.data) {
    return (
      <main className="bg-background text-foreground grid min-h-svh place-items-center p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{messages.invalidLink.title}</CardTitle>
            <CardDescription>{messages.invalidLink.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">{messages.invalidLink.backToLogin}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = updatePasswordSchema.safeParse({ password, confirm })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'password' || field === 'confirm') errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
      if (error) throw error
      toast.success(messages.success)
      await navigate({ to: '/', replace: true })
    } catch (error) {
      toast.error(translateUpdatePasswordError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-background text-foreground grid min-h-svh place-items-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">{messages.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={messages.passwordPlaceholder}
                aria-invalid={fieldErrors.password ? true : undefined}
                disabled={submitting}
                data-testid="update-password-password"
              />
              {fieldErrors.password && (
                <p className="text-destructive text-sm">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">{messages.confirmLabel}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={messages.passwordPlaceholder}
                aria-invalid={fieldErrors.confirm ? true : undefined}
                disabled={submitting}
                data-testid="update-password-confirm"
              />
              {fieldErrors.confirm && (
                <p className="text-destructive text-sm">{fieldErrors.confirm}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="update-password-submit"
            >
              {submitting ? messages.submitting : messages.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
