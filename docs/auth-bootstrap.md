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
