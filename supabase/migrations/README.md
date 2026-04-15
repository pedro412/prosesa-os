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
| `audit.attach(table_name)`                     | `void`    | Attach the generic audit trigger to a business table (see below)        |

All are `security definer` + `set search_path = public` and are grantable only to `authenticated` (the assertion and `audit.attach` are migration-time utilities, never granted to runtime roles).

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

## Audit trail

All business tables funnel mutations through a single `public.audit_logs` table via a generic trigger. Schema + trigger ship with LIT-15; attach per table when the feature lands.

### How to attach

In the migration that creates the business table, after RLS policies:

```sql
select audit.attach('work_orders');
```

That installs an `audit_trigger` that fires after INSERT / UPDATE / DELETE and inserts one row in `public.audit_logs` with `old_data`, `new_data`, the `action`, the actor's `user_id` (`auth.uid()`), and their `user_role` at commit time.

### Uuid-pk invariant

The trigger stores `record_id uuid not null`, so **every audited table must have a uuid primary key named `id`**. That matches our data-model convention ([`CLAUDE.md` §7](../../CLAUDE.md#7-data-model-principles)). If a future table needs a different pk shape, extend `audit.audit_row` to accept the pk column via `TG_ARGV` rather than working around the invariant.

### Append-only enforcement

`public.audit_logs` ships with:

- Admin-only SELECT policy.
- **No** client INSERT/UPDATE/DELETE policies — writes happen exclusively through `audit.audit_row()`, which is `SECURITY DEFINER`.
- Explicit `revoke update, delete … from authenticated, service_role` as a second line of defense, even if a future policy author adds an unintended policy.

Do not attach `audit.attach` to `audit_logs` itself — nothing audits the auditor.

### Regression test

`supabase/scripts/test-audit.sql` creates a throwaway table inside a `BEGIN … ROLLBACK`, attaches the trigger, issues one insert / update / delete, and asserts that three corresponding `audit_logs` rows appeared. Run it after any change to `audit.audit_row` or `audit.attach`.

## Folio sequences

Folios for `sales_notes`, `work_orders`, and other per-company monotonic documents are minted by `public.next_folio(p_company_id uuid, p_doc_type text) returns text`. Ships with LIT-23; called by M3/M4 when those tables land.

### Usage

```sql
select public.next_folio('<company-uuid>', 'sales_note');  -- returns e.g. 'A-0001'
```

From the frontend:

```ts
const { data, error } = await supabase.rpc('next_folio', {
  p_company_id: companyId,
  p_doc_type: 'sales_note',
})
// data === 'A-0001'
```

Call inside the same transaction as the document insert so the folio and the row land atomically.

### How it works

- `public.folio_sequences` — a `(company_id, doc_type)`-keyed counter table. RLS on, **no policies**, and base privileges revoked from `authenticated` / `service_role`. The only sanctioned access is via `next_folio()`.
- `next_folio()` runs as `SECURITY DEFINER` and increments with `INSERT ... ON CONFLICT DO UPDATE RETURNING`. The `ON CONFLICT` path acquires a row lock on the matching sequence row, so concurrent callers serialize on the same `(company, doc_type)` and each walks away with a distinct value. Equivalent safety to a manual `SELECT … FOR UPDATE`, without the transaction dance.
- Format: `"{company_code}-{padded_number}"` with minimum four-digit padding (`A-0001` … `A-9999`, then `A-10000`).
- Unknown or soft-deleted `company_id` raises `foreign_key_violation`.

### `doc_type` vocabulary

Free text constrained by `CHECK (doc_type ~ '^[a-z_]{1,40}$')` so a casing typo ("Sales_Note") can't fork a counter. Adopt conventional snake_case names:

- `sales_note`
- `work_order`
- `quotation` (Phase 2)

New types don't need a migration — the first call for a `(company, doc_type)` pair auto-creates the row at 1.

### Guarantees

- **Unique** per `(company_id, doc_type)`.
- **Monotonic** — each call returns a strictly greater value than every previous call for the same key.
- **Never reused**, even after the document that consumed the folio is cancelled. Cancellation is a state transition on the document row; the sequence is not rolled back.

### Regression test

Concurrency can't be exercised from a single psql session, so the regression test is a Node script rather than SQL:

```bash
supabase start
node supabase/scripts/test-folios.mjs
```

It fires 1000 parallel `next_folio` RPCs against the local stack (service_role key) and asserts uniqueness + no gaps. Run it after any change to `next_folio` or `folio_sequences`. Tunable via `FOLIO_TEST_N` and `FOLIO_TEST_COMPANY` env vars.
