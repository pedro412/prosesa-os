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

1. **Invite** the admin via Supabase dashboard → Authentication → Users → _Invite user_. Set the email. Supabase sends a sign-in magic link; the recipient sets a password.
2. **Verify** that the profile row exists:
   ```sql
   select id, email, role, is_active from public.profiles where email = '<their-email>';
   ```
   The row should show `role = 'ventas'`.
3. **Promote** to admin using the SQL editor:
   ```sql
   \set admin_email '''their-email@example.com'''
   \i supabase/scripts/promote-admin.sql
   ```
   Or paste the body of `supabase/scripts/promote-admin.sql` into the SQL editor after replacing `:admin_email` with the quoted email.
4. **Audit**: the promotion triggers a row in `audit_logs` once that table is wired up (LIT-1\_). Until then, keep a manual note in the handover log.

## Demoting or deactivating

- Demote: `UPDATE public.profiles SET role='ventas' WHERE email='...';`
- Deactivate (login still works but RLS can key off `is_active`): `UPDATE public.profiles SET is_active=false WHERE email='...';`
- Soft delete: `UPDATE public.profiles SET deleted_at=now() WHERE email='...';` — also consider disabling the `auth.users` row via the dashboard so they can't log in.

Never `DELETE` from `profiles` or `auth.users` for a real user — it breaks historical references from sales notes, work orders, and audit logs.
