import { type FormEvent, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translateLoginError } from '@/features/auth/errors'
import { authMessages } from '@/features/auth/messages'
import { useSession, useSignIn } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email(authMessages.login.errors.invalidEmail),
  password: z.string().min(1, authMessages.login.errors.passwordRequired),
})

type FieldErrors = Partial<Record<'email' | 'password', string>>

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

function LoginRoute() {
  const navigate = useNavigate()
  const router = useRouter()
  const session = useSession()
  const signIn = useSignIn()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // If a session already exists (e.g. back button after login), bounce home.
  if (session.data) {
    void navigate({ to: '/', replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'email' || field === 'password') errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    try {
      await signIn.mutateAsync(parsed.data)
      toast.success(authMessages.login.success)
      await router.invalidate()
      await navigate({ to: '/', replace: true })
    } catch (error) {
      toast.error(translateLoginError(error))
    }
  }

  return (
    <main className="bg-background text-foreground grid min-h-svh place-items-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{authMessages.login.title}</CardTitle>
          <CardDescription>{authMessages.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{authMessages.login.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={authMessages.login.emailPlaceholder}
                aria-invalid={fieldErrors.email ? true : undefined}
                disabled={signIn.isPending}
                data-testid="login-email"
              />
              {fieldErrors.email && <p className="text-destructive text-sm">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{authMessages.login.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMessages.login.passwordPlaceholder}
                aria-invalid={fieldErrors.password ? true : undefined}
                disabled={signIn.isPending}
                data-testid="login-password"
              />
              {fieldErrors.password && (
                <p className="text-destructive text-sm">{fieldErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={signIn.isPending}
              data-testid="login-submit"
            >
              {signIn.isPending ? authMessages.login.submitting : authMessages.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
