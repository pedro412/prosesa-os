import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

const parsed = EnvSchema.safeParse(import.meta.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(
    `Invalid environment variables. Check your .env file against .env.example:\n${issues}`
  )
}

export const env = parsed.data

export const isDev = import.meta.env.DEV
