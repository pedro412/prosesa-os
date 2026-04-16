# Auth bootstrap

How to create the first admin in each environment. The same flow applies to **local**, **staging**, and **production**: dashboard invite → password set → manual promotion to `admin`. No environment is allowed to create admins without human action.

## Roles recap

Per [`CLAUDE.md` §9](../CLAUDE.md#9-roles--auth):

| Role     | Default? | How to grant                                                        |
| -------- | -------- | ------------------------------------------------------------------- |
| `ventas` | Yes      | `handle_new_user` trigger assigns this on every `auth.users` INSERT |
| `admin`  | No       | Manual `UPDATE public.profiles SET role='admin' WHERE email=...`    |

Public signup stays disabled in the Supabase dashboard. Every user comes in via invite.

## Local development

```bash
supabase start
# Supabase Studio → Authentication → Users → "Add user"
#   email:    admin@prosesa.local
#   password: (set something memorable)
supabase db reset
# seed.sql promotes admin@prosesa.local to 'admin'
```

If you want to iterate without a full reset, run the promote script directly:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -v admin_email="'admin@prosesa.local'" \
  -f supabase/scripts/promote-admin.sql
```

## Staging (`prosesa-os-staging`) and production (`prosesa-os-prod`)

1. **Invite** the admin via Supabase dashboard → Authentication → Users → _Invite user_. Supabase sends an email with a one-time link.
2. **Recipient clicks the link.** The browser lands at `site_url`, and `src/lib/auth-redirect.ts` rewrites the URL to `/auth/update-password?flow=invite` while preserving the hash tokens. The user sees a Spanish "Bienvenido — define tu contraseña" form, sets a password, and is redirected to `/` logged in.
3. **Verify** the profile row:
   ```sql
   select id, email, role, is_active from public.profiles where email = '<their-email>';
   ```
   The row should show `role = 'ventas'`.
4. **Promote** to admin using the SQL editor:
   ```sql
   \set admin_email '''their-email@example.com'''
   \i supabase/scripts/promote-admin.sql
   ```
   Or paste the body of `supabase/scripts/promote-admin.sql` into the SQL editor after replacing `:admin_email` with the quoted email.
5. **Audit**: the promotion triggers a row in `audit_logs` once the table is attached to `profiles`. Until then, keep a manual note in the handover log.

### Forgot / recover a password

Users can initiate recovery themselves from the `/login` page via the **¿Olvidaste tu contraseña?** link, which opens `/auth/forgot-password`. They enter their email; Supabase sends a recovery email; the link brings them to `/auth/update-password?flow=recovery` (via the same `auth-redirect` hook).

### Last-resort admin override (rarely needed)

If an invite link is lost or a user is locked out, an admin can set a password directly in the Supabase SQL editor:

```sql
update auth.users
set encrypted_password = crypt('<new-password>', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = '<user-email>';
```

Use sparingly — normal flow is dashboard invite → self-service password. This bypasses the email-confirmation round trip.

## Demoting or deactivating

- Demote: `UPDATE public.profiles SET role='ventas' WHERE email='...';`
- Deactivate (login still works but RLS can key off `is_active`): `UPDATE public.profiles SET is_active=false WHERE email='...';`
- Soft delete: `UPDATE public.profiles SET deleted_at=now() WHERE email='...';` — also consider disabling the `auth.users` row via the dashboard so they can't log in.

Never `DELETE` from `profiles` or `auth.users` for a real user — it breaks historical references from sales notes, work orders, and audit logs.

## In-app user management (admins)

Once the staging deploy of LIT-65 lands, admins manage day-to-day users directly from `/settings/users` instead of the SQL paths above. The SQL paths stay as the **last-resort recovery** when no admin can log in.

### What the UI does

- **Invite** — calls the Edge Function `invite-user`, which authenticates the caller, validates the body, and forwards to `auth.admin.inviteUserByEmail` with the service-role key. The `handle_new_user` trigger creates the profile with `role='ventas'`; if the inviter chose `admin`, the function bumps the role afterward.
- **Change role / toggle active / soft delete / restore** — direct UPDATEs against `public.profiles` via the existing admin RLS policies.
- **List** — calls `public.list_admin_profiles(p_include_deleted, p_limit, p_offset)`, a SECURITY DEFINER function that joins `profiles` with `auth.users.last_sign_in_at` so the UI can show "último acceso" without exposing `auth.users` to the client.

### Server-enforced invariants (migration `20260416195226_profiles_admin_extras.sql`)

- **Self-mutation guard** — an admin cannot demote, deactivate, or soft-delete their own profile through the app. Migrations bypass via `auth.uid() = null`.
- **Last-admin protection** — any UPDATE that would leave zero usable admins (active, non-deleted, role='admin') is rejected with a Spanish error.
- **Audit** — `audit.attach('profiles')` records every role / `is_active` / `deleted_at` change in `public.audit_logs`.

### Deploying the Edge Function

Supabase auto-injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into the function environment — no extra secrets to set.

```bash
# Local (against `supabase start`)
supabase functions serve invite-user

# Staging
supabase functions deploy invite-user --project-ref comfhqhigiighmwuxfbb

# Production (when LIT-59 provisions the prod project)
supabase functions deploy invite-user --project-ref <prod-ref>
```

The function reads the request `Origin` header to construct the invite's `redirectTo` (`<origin>/auth/update-password?flow=invite`), so invites from staging route back to staging and prod routes to prod without per-environment config.

### Recovery paths still apply

If every admin loses access, fall back to the SQL editor + `promote-admin.sql`. The in-app guards explicitly forbid demoting the last admin to prevent that scenario, but the recovery script remains the documented escape hatch.
