# ProsesaOS — Agent Instructions

> This file is the source of truth for Claude Code (and other AI agents) working on this repo. It consolidates the business spec and the technical decisions into a single working contract.
>
> **Full references** (read these for deep context, do not duplicate here):
> - Business & product: [`PROSESA-SYSTEM-SPEC.md`](./PROSESA-SYSTEM-SPEC.md)
> - Technical rationale: [`ProsesaOS-technical-decisions.md`](./ProsesaOS-technical-decisions.md)
>
> `AGENTS.md` is a stub that points here — this file is the single source. Do not duplicate content.

---

## 1. What we're building

**ProsesaOS** is a web-based business management system for **Prosesa Diseño y Publicidad** (print & advertising shop, Ciudad del Carmen, Campeche, Mexico). It replaces handwritten notes, daily Excel reconciliation, and manual stock checks.

**Core capabilities (MVP):**
1. Point of Sale — counter sales and project sales
2. Product/service catalog with fixed and variable pricing
3. **Multi-company** — two legal entities (razones sociales) with shared catalog and inventory, independent folio sequences
4. Sales notes (notas de venta) with auto folio, tax breakdown, and print
5. Work orders (órdenes de trabajo) with 7-stage status tracking — **list/table view in MVP**
6. Material inventory with stock levels, minimum alerts, and movement audit log
7. Daily cash reconciliation (corte de caja) — one-click, replaces the Excel
8. User management with 2 roles: `Admin`, `Ventas/Recepción`

**Stretch (deliver only if Phase 1 scope is stable):**
- Kanban board view on top of the work orders list
- Lightweight read-only dashboard (revenue, stage counts, low stock)

**Explicitly out of Phase 1** (see SPEC §9 for details): CFDI invoicing, WhatsApp notifications, formal quotations, sales pipeline, workshop station screens, purchase orders, customer CRM, full reporting, time metrics, attendance, accounts receivable. Edge Functions (Facturapi, WhatsApp Business API) are Phase 2.

---

## 2. Tech stack (locked)

| Layer | Choice |
|---|---|
| Build tool | Vite |
| Framework | React (latest stable that ships with Vite) + TypeScript |
| Styling | Tailwind CSS |
| UI primitives | shadcn/ui — components live in `src/components/ui/`, we own them |
| Router | TanStack Router (type-safe routes + params) |
| Server state | TanStack Query |
| Client state | React context or Zustand (only when Query is not appropriate) |
| Drag & drop | dnd-kit (only if Kanban stretch ships) |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) |
| DB client | `@supabase/supabase-js` |
| Env validation | zod |
| Hosting (frontend) | Vercel Pro |
| Hosting (backend) | Supabase Pro (prod) + Supabase Free (staging) |
| DNS / proxy | Cloudflare — **deferred** until domain is decided |
| PDF generation | TBD per need — prefer server-side (Edge Function) for detailed notes, browser print for thermal tickets |

No custom backend. The Supabase SDK is called directly from the frontend, gated by RLS.

---

## 3. Project structure

```
src/
  components/
    ui/                ← shadcn primitives (Button, Input, Badge, Card, Modal, Table, …)
    features/
      pos/
      projects/        ← work orders
      inventory/
      catalog/
      customers/
      sales-notes/
      cash-close/      ← corte de caja
      companies/
  hooks/               ← custom hooks, prefixed with `use`
  lib/
    supabase.ts        ← single Supabase client instance
    env.ts             ← zod-validated env vars
    queries/           ← ALL Supabase calls live here (one file per domain)
      projects.ts
      inventory.ts
      sales-notes.ts
      customers.ts
      catalog.ts
      companies.ts
      cash-close.ts
  types/
    database.ts        ← auto-generated from Supabase schema — do not edit by hand
  routes/              ← TanStack Router route tree
supabase/
  functions/           ← Edge Functions (Phase 2: invoicing, WhatsApp)
  migrations/          ← versioned SQL migrations
CLAUDE.md
AGENTS.md
```

---

## 4. Hard rules for the agent

These are non-negotiable. Violations should be fixed on sight.

1. **UI primitives**: never write raw `<button>`, `<input>`, `<select>`, `<dialog>` in a feature component. Import from `src/components/ui/`. If the primitive doesn't exist yet, add it via shadcn first.
2. **Supabase access**: no raw SDK calls inside components or hooks. All queries and mutations live in `src/lib/queries/<domain>.ts` and are consumed via TanStack Query.
3. **No `useEffect` for data fetching**: use TanStack Query. `useEffect` is reserved for subscriptions, DOM sync, and cleanup.
4. **No `any`**: `@typescript-eslint/no-explicit-any` is an error. Use generics, `unknown`, or generate proper types. Regenerate `src/types/database.ts` after every schema change.
5. **Never use `service_role` in the frontend.** The anon key is the only key that ships with the client.
6. **RLS is mandatory** on every table — no exceptions. If a table is added without RLS policies, it's a bug.
7. **Audit is append-only**: `audit_logs` and equivalent log tables accept `INSERT` only — no `UPDATE` or `DELETE`, enforced by RLS.
8. **Don't install a library without checking first.** Prefer what's already in `package.json`. When new deps are needed, justify them in the PR.
9. **Money**: `NUMERIC(12,2)` in Postgres, MXN only. Never use `float`.
10. **Timestamps**: `timestamptz`, stored UTC, displayed in `America/Mexico_City`.
11. **Soft deletes**: never hard-delete business records — use `deleted_at` or `is_active`.
12. **Folio sequences are per-company and monotonic.** Never reuse a folio, even after cancellation.

---

## 5. Language policy

- **Code, filenames, identifiers, git commits, comments, docs**: English.
- **All user-facing UI strings**: Spanish (Mexico) — labels, buttons, placeholders, toasts, error messages, empty states, tooltips.
- **Printed documents** (thermal tickets, detailed notes, corte de caja): Spanish (Mexico).
- Keep UI copy in a localization-friendly shape (e.g., a `messages.ts` per feature) so we can extract to i18n later without a rewrite. Do not install an i18n library yet.

Use Mexican Spanish vocabulary from SPEC §12 (nota de venta, orden de trabajo, anticipo, corte de caja, razón social, folio, etc.).

---

## 6. Multi-company (critical)

Two legal entities (razones sociales), one business, one workspace, one catalog, one inventory.

- Every `sales_notes` and `work_orders` row has a non-null `company_id`.
- Folio sequences are per-company (e.g., `A-0001`, `B-0001`). Implement via a per-company sequence table or `generate_next_folio(company_id)` DB function inside a transaction.
- The active company is part of the app's session state and is required before any transactional action. Block the sale if no company is selected.
- The company selector must be visible in the header/nav at all times; a sale cannot be transferred between companies after creation.
- Catalog, inventory, customers, and users are shared.
- All reports and lists support per-company filtering and a consolidated view.

---

## 7. Data model principles

These are principles, not a frozen schema. Design actual tables from these.

- Every business table has `created_at`, `updated_at`, `created_by`, `updated_by`, and (where applicable) `deleted_at`.
- Status changes on `work_orders` go into an append-only log: `old_status`, `new_status`, `changed_at`, `changed_by`, optional `note`. Backward transitions are allowed (rework).
- Inventory movements are append-only. Types: `entrada`, `salida_por_orden`, `salida_manual`, `ajuste`. Each movement links to the work order if applicable and always to a user.
- A sales note has 0..1 work order. A work order belongs to exactly one sales note and inherits `company_id` and `customer_id`.
- Customers: `"Público en general"` is a seeded sentinel row per company settings, using the Mexican SAT generic RFC `XAXX010101000`. Counter sales default to this customer when none is selected.
- Leave nullable FK space for things coming in Phase 2: `invoice_id` on sales notes, `purchase_order_id` on inventory entradas, `quotation_id` on sales notes.
- **Work order line-item shape is an open research item** (see Linear ticket `R-1`): structured fields (dimensions, material, finishes) vs. freeform text vs. hybrid. Do not lock the schema without resolving this ticket — investigate how comparable shops model it and pick an approach that preserves future analytics.
- **Audit log**: single `audit_logs` table + generic Postgres trigger attached to `sales_notes`, `work_orders`, `work_order_status_log`, `inventory_movements`, `pos_sales`. Schema per tech decisions:
  ```sql
  id uuid pk, table_name text, record_id uuid, action text,
  old_data jsonb, new_data jsonb, user_id uuid, user_role text, created_at timestamptz
  ```
  RLS: admin read-only; no one writes or deletes (only the trigger inserts).

---

## 8. Business rules to honor

(Full list in SPEC §10. Highlights the code must respect:)

- **IVA**: prices are **tax-inclusive** by default but the breakdown is always displayed explicitly in the UI and on printed documents (never hidden). The rate is **configurable** — store it per company in settings, default 16%. Back-calculation: `subtotal = total / (1 + rate)`, `iva = total - subtotal`.
- Sales can be split across multiple payment methods (`mixto`): cash, transfer, card.
- Advance (`anticipo`) creates a pending balance; additional payments can be recorded later.
- Only admins cancel sales notes, and a reason is required.
- Discounts apply per line item (percent or fixed), not only at the total.
- Work order status flow (7 stages):
  `Cotizado → Anticipo recibido → En diseño → En producción → En instalación → Terminado → Entregado`
  `En instalación` is skippable. Backward transitions are allowed and must be logged.
- An order should warn (not block) when marked `Entregado` while unpaid. Admin can override.
- Stock can go negative — warn but allow.
- Counter sales don't generate work orders; project sales do (toggle: *"Genera orden de trabajo"*).
- **Corte de caja reconciles** (cash drawer model): the day opens with a declared opening cash amount; the end-of-day report computes expected cash = opening + cash sales − cash payouts, compares it to a declared counted amount, and surfaces the difference.

---

## 9. Roles & auth

MVP roles (stored in `profiles.role`):

| Role | Capabilities |
|---|---|
| `admin` | Full access. Cancel sales notes, adjust inventory, generate corte de caja, manage users/catalog/companies. |
| `ventas` | Create sales notes and work orders, update work order status, record payments, read inventory, read customers. Cannot cancel notes or generate corte de caja. |

- Auth: Supabase Auth (email + password). Public signup **disabled** in the Supabase dashboard.
- RLS: enforce role checks on every table.
- MFA for admin: TOTP via Supabase, enforced in the route guard.
- Brute force: Supabase rate limiting + Cloudflare Turnstile (enable once Cloudflare is in place).
- Design the role column as a scalar string now; extensible to `producción`, `diseño`, `instalación`, `facturación`, `gerencia` in future phases without a migration.

---

## 10. Printing

- **Thermal ticket** (80mm, counter sales): browser `window.print()` with a dedicated print stylesheet. Keep it terse: logo, folio, date, line items abbreviated, total, payment method, thank-you.
- **Detailed note** (letter size, project sales + work orders): PDF generation preferred — start client-side (e.g., `jspdf` / `react-pdf`) if feasible, move to an Edge Function only if layout complexity demands it.
- **Corte de caja**: printable HTML, letter size.

All printed documents in Spanish (Mexico), with the correct razón social, RFC, régimen fiscal, and folio for the selected company.

---

## 11. Environment & configuration

```
.env.development   → staging Supabase project (prosesa-os-staging, free plan)
.env.production    → prod Supabase project (prosesa-os-prod, Pro plan)
```

- Env vars are loaded and validated through `src/lib/env.ts` using zod — never access `import.meta.env` directly in feature code.
- Never commit `.env*` files. `.env.example` is the documented surface.

Required vars (MVP):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## 12. Code quality & workflow

- **ESLint v9 + typescript-eslint + Prettier** (config per tech decisions). `no-explicit-any` and `no-unused-vars` are errors; `no-console` is a warning.
- **Prettier**: no semicolons, single quotes, 2-space tabs, `trailingComma: es5`, `printWidth: 100`.
- **Conventional Commits** enforced via commitlint + Husky: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`. ESLint runs pre-commit and blocks on errors.
- **Supabase types** regenerated after every schema change:
  ```bash
  supabase gen types typescript --project-id <id> > src/types/database.ts
  ```
- **No half-finished work**: don't leave dead code, commented-out blocks, or TODOs without an owner and a reason.

---

## 13. Testing

Approach is deliberately light in Phase 1 — UI churns fast early and brittle E2E tests become a tax.

- **TypeScript** is the first line of defense.
- **Manual QA** on staging is owned by **Karina**.
- **Playwright E2E**: TBD. When we add it, start with 4 critical flows:
  1. Login by role respects permissions.
  2. Create sale → appears in list view.
  3. Work order status change reflects in list (and Kanban if shipped).
  4. Inventory auto-deducts when materials are linked to a production order.
- **Unit tests**: only for pure logic that's hard to validate by eye (tax math, folio generation, cash close totals).

---

## 14. Security

- RLS on every table.
- Anon key only in the frontend; `service_role` stays in Edge Functions / CI.
- HTTPS everywhere (Vercel + Cloudflare once it's in place).
- Audit log is immutable (see §7).
- LFPDPPP (Mexico) compliance: publish a Privacy Notice (Aviso de Privacidad), restrict customer data export to admin, rely on Supabase Pro daily backups.

---

## 15. Observability

- **Bug report button**: floating action button → modal capturing description, URL, user id, role, timestamp, user agent. Persist to a `bug_reports` table; screenshot via `html2canvas` optional, stored in Supabase Storage.
- **Error monitoring**: Sentry (free tier) is a Phase 2 upgrade.

---

## 16. Deployment

```
prosesaos.com (TBD)
      ↓
Cloudflare proxy (once domain is ready)
      ↓
Vercel Pro (Vite build — production)
      ↓
Supabase Pro (prosesa-os-prod)


PR preview URL (Vercel) → Supabase Free (prosesa-os-staging) → Karina QA
```

- One Vercel project, branch previews per PR.
- `main` → production. Feature branches → preview + staging Supabase.

---

## 17. What's NOT in this repo (yet)

If the user asks for any of these, confirm they want it in Phase 1 before implementing — by default they are Phase 2+:

- CFDI 4.0 invoicing (Facturapi)
- WhatsApp Business API notifications
- Formal quotations (PDF + sending)
- Sales pipeline / funnel
- Workshop station screens
- Purchase order workflow
- Full customer CRM (gallery, credit limits, segmentation)
- Full reporting suite
- Time-per-stage metrics
- Attendance / clock-in
- Accounts receivable / aging
- Rework cause tracking

See SPEC §9 for scoping detail on each.

---

## Changelog

Tracks changes to this agent contract only (rules, scope decisions, stack locks). Product/release changes live in the root [`README.md`](./README.md#changelog).

| Date | Change |
|---|---|
| 2026-04-14 | Initial agent contract for Phase 1. |
