# Migrations — RLS policy kit

Every table in `public` ships with row-level security enabled **and** policies declared in the **same migration** that creates it. This file is the working reference for authors and reviewers. It complements [`CLAUDE.md` §4](../../CLAUDE.md#4-hard-rules-for-the-agent) (rules 6 and 7) and [§7](../../CLAUDE.md#7-data-model-principles).

## Hard rules

1. **Enable RLS in the creating migration.** Not in a follow-up.
2. **At least one policy per operation you expect callers to perform.** A table with RLS on and zero policies rejects every request — that is fine when intended, surprising otherwise.
3. **End every migration that adds tables with `select public.assert_all_tables_have_rls();`.** It is cheap, idempotent, and catches the mistake of forgetting `enable row level security` on a table.
4. **Never grant anything to `anon`.** Every policy is `to authenticated` (or `to service_role` for audit inserts).
5. **No `service_role` in the frontend.** If a policy says `to service_role`, the path is a trigger, an Edge Function, or CI tooling — never the React app.
6. **Use soft deletes.** Do not add a `DELETE` policy on business tables; rely on `UPDATE` of `deleted_at`.

## Helpers

Ship with LIT-14. Use them instead of inlining the same logic in every policy.

| Helper                                         | Returns   | Use it for                                                              |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `public.is_admin()`                            | `boolean` | Admin-gated writes and admin-only reads                                 |
| `public.current_role()`                        | `text`    | Role-based dispatch beyond just admin (e.g. future `ventas`-only rules) |
| `public.assert_all_tables_have_rls(allowlist)` | `void`    | Invariant check at the tail of every schema-changing migration          |

All three are `security definer` + `set search_path = public` and are grantable only to `authenticated` (the assertion is grantless; migrations invoke it while running as the migration user).

## Naming convention

`<table>_<action>_<scope>`

- `<action>`: `select | insert | update | delete`
- `<scope>`: `self | admin | auth | service | owner | role`

Examples:

```
profiles_select_self
profiles_select_admin
profiles_update_admin
audit_logs_insert_service
work_order_status_log_select_auth
inventory_movements_insert_service
```

Consistent names make `pg_policies` readable and make it obvious in code review what a policy is for.

## Templates

Copy, adapt the table name, keep the policy names in sync with the convention above. Every template assumes the table already has `created_at`, `updated_at`, and (where relevant) `deleted_at` following [`CLAUDE.md` §7](../../CLAUDE.md#7-data-model-principles).

### 1. Admin-only write, all-authenticated read

For catalog-like data that every user needs to see but only admins maintain (e.g. `products`, `companies`, `customers`).

```sql
alter table public.<table> enable row level security;

create policy <table>_select_auth on public.<table>
for select
to authenticated
using (deleted_at is null or public.is_admin());

create policy <table>_insert_admin on public.<table>
for insert
to authenticated
with check (public.is_admin());

create policy <table>_update_admin on public.<table>
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy: soft-delete via update of deleted_at.
```

### 2. All-authenticated read (reference data)

For truly read-only reference tables (e.g. SAT régimen fiscal list, payment methods) where writes happen via a migration, not at runtime.

```sql
alter table public.<table> enable row level security;

create policy <table>_select_auth on public.<table>
for select
to authenticated
using (true);

-- No insert/update/delete policies: runtime writes are blocked. Seed via
-- migration only.
```

### 3. Insert-only (audit and log tables)

For `audit_logs`, `work_order_status_log`, `inventory_movements`, and anything else that accumulates immutable history. Updates and deletes are forbidden — defense in depth: no policy + explicit `revoke`.

```sql
alter table public.<table> enable row level security;

-- Admins can read the history.
create policy <table>_select_admin on public.<table>
for select
to authenticated
using (public.is_admin());

-- Writes only from SECURITY DEFINER triggers / Edge Functions running as
-- service_role. No client-initiated INSERT policy.
create policy <table>_insert_service on public.<table>
for insert
to service_role
with check (true);

-- Belt and suspenders: even if a future policy author adds an UPDATE/DELETE
-- policy by accident, the base privilege is already revoked.
revoke update, delete on public.<table> from authenticated, service_role;
```

Append-only is a [`CLAUDE.md` §4](../../CLAUDE.md#4-hard-rules-for-the-agent) rule 7 invariant. Audit integrity dies the moment someone can rewrite history; the `revoke` is the lock.

### 4. Owner-only

For user-scoped records where each row belongs to exactly one actor (`bug_reports` from `CLAUDE.md` §15, future user-specific preferences). Admins retain visibility for support.

```sql
alter table public.<table> enable row level security;

create policy <table>_select_owner on public.<table>
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy <table>_insert_owner on public.<table>
for insert
to authenticated
with check (user_id = auth.uid());

create policy <table>_update_owner on public.<table>
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No delete policy: admin runs cleanup via SQL editor if ever needed.
```

## End-of-migration assertion

Every migration that adds or alters tables ends with:

```sql
select public.assert_all_tables_have_rls();
```

If you intentionally ship a public table without RLS (very rare — materialized views, lookup seeds consumed by SECURITY DEFINER functions), invoke with the allowlist and explain why in a comment directly above the call:

```sql
-- public.sat_regimen_fiscal is static reference data seeded at migration
-- time. RLS off is intentional; nothing writes at runtime.
select public.assert_all_tables_have_rls(array['sat_regimen_fiscal']);
```

## Debugging a failure

```bash
# Live check against the linked project:
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -f supabase/scripts/check-rls.sql
```

Or open the Supabase SQL editor and paste `supabase/scripts/check-rls.sql`. The script returns a table of offenders with owner and row count — handy for triage.
