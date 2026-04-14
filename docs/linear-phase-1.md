# Linear — Phase 1 MVP structure

Proposed Linear setup for tracking Phase 1 of ProsesaOS. Mirrors the scope locked in [`../CLAUDE.md`](../CLAUDE.md). Intended to be created manually or ingested by a Linear MCP later.

---

## Team & project

- **Team**: `Prosesa` (or map to whatever team the workspace uses)
- **Project**: `ProsesaOS — Phase 1 MVP`
- **Project lead**: Pedro
- **Release model**: **one external release** to the client at end of Phase 1; **incremental drops to staging** internally for Karina's QA, one per milestone

---

## Labels

### Area (one per ticket, minimum)

`area/infra`, `area/auth`, `area/companies`, `area/customers`, `area/catalog`, `area/pos`, `area/sales-notes`, `area/work-orders`, `area/inventory`, `area/cash-close`, `area/ui`, `area/print`, `area/qa`, `area/compliance`

### Type

`type/feat`, `type/bug`, `type/chore`, `type/refactor`, `type/research`, `type/docs`

### Flag

`needs-decision` (ticket blocks a scope decision)
`stretch` (Phase 1 if bandwidth allows, otherwise Phase 2)
`blocker` (blocks downstream work)

### Priority

Use Linear's native `Urgent / High / Medium / Low`.

---

## Milestones

Each milestone ends with a staging deploy and a Karina QA pass before the next milestone starts.

| #   | Milestone                   | Exit criteria                                                                                                                                                                                |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Foundation                  | Repo scaffolded; CI green; staging + prod Supabase wired; auth + 2 roles + RLS; audit log trigger; bug report button; Vercel preview per PR.                                                 |
| M2  | Core entities               | Two companies seeded with fiscal data; company selector in header; customers CRUD (incl. Público en general sentinel); catalog CRUD.                                                         |
| M3  | Counter sales POS           | Sales notes with per-company folios; catalog + freeform line items; line discounts; IVA breakdown explicit and configurable per company; mixto payments; thermal ticket print; history view. |
| M4  | Project sales & work orders | "Genera orden de trabajo" flow; advance + saldo tracking; work orders with 7-stage pipeline, status log, backward transitions; detailed note PDF; list view with filters.                    |
| M5  | Inventory                   | Materials catalog with min threshold; append-only movements (4 types); auto-deduction linked to work orders; low-stock view + nav badge; manual adjustments with reason.                     |
| M6  | Cash reconciliation         | Opening cash declaration; end-of-day report with reconciliation vs counted cash; per-company and per-method breakdown; print; history.                                                       |
| M7  | Polish & stretch            | Admin MFA enforced; Privacy Notice published; Cloudflare + domain (once decided). Stretch: Kanban work-order view, lightweight dashboard.                                                    |

---

## M1 — Foundation

**Epic**: `[M1] Foundation`

| ID    | Title                                       | Acceptance                                                                                                                                                           |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-1  | Scaffold Vite + React (latest) + TypeScript | `npm run dev` boots; strict `tsconfig`; absolute `@/` alias.                                                                                                         |
| M1-2  | Tailwind + shadcn/ui init                   | Tailwind configured; shadcn CLI configured; `Button`, `Input`, `Card`, `Dialog`, `Table`, `Badge` primitives added to `src/components/ui/`.                          |
| M1-3  | ESLint v9 + Prettier + commitlint + Husky   | Lint errors fail CI; pre-commit runs ESLint; Conventional Commits enforced.                                                                                          |
| M1-4  | TanStack Router scaffold                    | Typed route tree; root layout; 404 route; auth-protected route wrapper.                                                                                              |
| M1-5  | TanStack Query scaffold                     | `QueryClient` + provider; devtools in dev; conventions doc in README.                                                                                                |
| M1-6  | Supabase projects provisioned               | `prosesa-os-prod` (Pro) and `prosesa-os-staging` (Free) created; anon keys stored in Vercel env; CLI linked locally.                                                 |
| M1-7  | `src/lib/env.ts` with zod validation        | Fails fast on missing/invalid env vars; typed `env` export used everywhere.                                                                                          |
| M1-8  | Vercel project + preview per PR             | Main → prod; branch → preview; staging branch wired to staging Supabase.                                                                                             |
| M1-9  | Supabase Auth + profiles + roles            | Email/password login; public signup disabled; `profiles` table with `role` (`admin` \| `ventas`); seed script for initial admin.                                     |
| M1-10 | RLS baseline policy kit                     | Reusable helpers / migration templates for `role = 'admin'` and `owner = auth.uid()` patterns. Documented in `supabase/migrations/README.md`.                        |
| M1-11 | Audit log table + generic trigger           | `audit_logs` table per CLAUDE.md §7; `audit_row()` trigger function; attach helper used in later migrations.                                                         |
| M1-12 | Bug report FAB + `bug_reports` table        | FAB visible in all authenticated views; modal captures description + URL + role + timestamp + user agent; optional screenshot via `html2canvas` to Supabase Storage. |
| M1-13 | Route guards by role                        | `ventas` cannot reach admin-only routes; unauthorized redirects to a friendly view.                                                                                  |
| M1-14 | App shell / header / nav                    | Persistent header with active-company slot (filled in M2), nav with role-aware items, user menu, logout.                                                             |
| M1-15 | Supabase type generation script             | `npm run db:types` regenerates `src/types/database.ts`; documented in README.                                                                                        |

---

## M2 — Core entities

**Epic**: `[M2] Core entities (companies, customers, catalog)`

| ID   | Title                                  | Acceptance                                                                                                                                                                                                         |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M2-1 | `companies` table + settings           | Fields: `id`, `nombre_comercial`, `razon_social`, `rfc`, `regimen_fiscal`, `direccion_fiscal`, `logo_url`, `iva_rate` (default `0.16`), `iva_inclusive` (default `true`). RLS: admin write, everyone read.         |
| M2-2 | Seed the two legal entities            | Migration seeds both razones sociales. Placeholder fiscal data captured from Dana before shipping.                                                                                                                 |
| M2-3 | Active-company context + selector      | Persistent dropdown in header; choice stored in localStorage + React context; guards prevent mutations without a selected company.                                                                                 |
| M2-4 | Per-company folio sequence infra       | Per-company sequence table or DB function `next_folio(company_id, doc_type)` returning monotonic `A-0001` style folios inside a transaction. Tested against concurrent inserts.                                    |
| M2-5 | `customers` table + Público en general | Fields: `id`, `nombre`, `rfc`, `razon_social`, `regimen_fiscal`, `cp_fiscal`, `telefono`, `email`, `requiere_factura`, `notas`. Seed row per company with `rfc = 'XAXX010101000'` and name `"Público en general"`. |
| M2-6 | Customers CRUD UI                      | List, search (by name / phone / RFC), create, edit, soft delete. Quick-add modal reusable from POS.                                                                                                                |
| M2-7 | `catalog_categories` + `catalog_items` | Items have `name`, `description`, `category_id`, `unit` (enum), `price`, `pricing_mode` (`fixed` \| `variable`), `tax_mode`, `is_active`. Units per SPEC §4.2.                                                     |
| M2-8 | Catalog CRUD UI                        | Admin-only. List with filter/search; create/edit dialog; toggle active. Categories managed inline.                                                                                                                 |

---

## M3 — Counter sales POS

**Epic**: `[M3] Counter sales POS + sales notes`

| ID   | Title                         | Acceptance                                                                                                                                                                                                                 |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-1 | `sales_notes` schema          | Fields per SPEC §4.4; `company_id` non-null; `folio` unique per company; `status` enum (`pagada` \| `pendiente` \| `abonada` \| `cancelada`); `created_by`, `cancelled_by`, `cancellation_reason`. Audit trigger attached. |
| M3-2 | `sales_note_lines` schema     | `concept`, `dimensions` (text, optional), `material` (text, optional), `unit`, `quantity`, `unit_price`, `discount_type`, `discount_value`, computed `line_total`.                                                         |
| M3-3 | `payments` schema             | `sales_note_id`, `method` (`efectivo`, `transferencia`, `tarjeta`), `amount`, `paid_at`, `created_by`. Multiple rows per note supports `mixto`.                                                                            |
| M3-4 | POS layout (counter mode)     | Company selector (read-only indicator from header); catalog search; add free-form line; quantity/price/discount editing; totals panel. Target flow ≤ 30s per SPEC §8.3.                                                    |
| M3-5 | IVA breakdown UI              | Subtotal, IVA (uses `company.iva_rate`), Total all shown explicitly at all times. Back-calculation when `iva_inclusive = true`. Toggle for configurability hidden behind admin settings.                                   |
| M3-6 | Payment capture + mixto split | Single or multi-method entry; running balance; validation that sum of payments ≥ total (or records partial). Creates `payments` rows transactionally with the sale.                                                        |
| M3-7 | Thermal ticket print          | 80mm print stylesheet; logo, company razón social + RFC, folio, date, lines (abbreviated), totals, payment, thank you. Printed directly via `window.print()`.                                                              |
| M3-8 | Sales notes history view      | Paginated list filterable by date range, company, status, payment method; detail drawer; record additional payment; cancel (admin only, with reason).                                                                      |

---

## M4 — Project sales & work orders

**Epic**: `[M4] Project sales + work orders`

| ID   | Title                                      | Acceptance                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4-1 | `R-1` research: work order line-item shape | **Research ticket, labeled `type/research` + `needs-decision` + `blocker`.** Evaluate structured fields (dimensions, material, finishes) vs freeform vs hybrid. Review comparable shops / industry software. Recommend and document the chosen schema. Must land before M4-3. |
| M4-2 | "Genera orden de trabajo" POS toggle       | Checkbox in POS; when on, enables advance/saldo flow and spawns a work order on charge.                                                                                                                                                                                       |
| M4-3 | `work_orders` schema                       | Per SPEC §4.5; `company_id` and `sales_note_id` non-null; status enum with 7 values; dates (`created_at`, `promised_at`, `delivered_at`); `priority`. Line-item shape per R-1.                                                                                                |
| M4-4 | `work_order_status_log`                    | Append-only log with `old_status`, `new_status`, `changed_by`, `changed_at`, `note`. Trigger-enforced immutability.                                                                                                                                                           |
| M4-5 | Advance + saldo tracking                   | Advance captured at charge as a `payment`; UI surfaces `saldo pendiente` on the sales note and work order; additional payments roll status `pendiente` → `abonada` → `pagada`.                                                                                                |
| M4-6 | Work order list + filters                  | Table with status, company, date range, customer, priority filters; overdue rows visually flagged (past `promised_at` and not `entregado`).                                                                                                                                   |
| M4-7 | Work order detail + status change          | Drawer / page with full info; status transitions (forward and backward) with required note on backward moves; full log visible. Warn (don't block) when marking `entregado` if `saldo > 0`.                                                                                   |
| M4-8 | Detailed note PDF print                    | Letter-size PDF via client-side generator; header with company fiscal data + logo; line items with description/dimensions/materials; totals; payment breakdown; work order folio; observations; signature lines.                                                              |

---

## M5 — Inventory

**Epic**: `[M5] Materials & inventory`

| ID   | Title                              | Acceptance                                                                                                                                                        |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5-1 | `materials` schema + categories    | Fields per SPEC §4.6; `min_threshold`; `unit`; `is_active`. Shared across both companies.                                                                         |
| M5-2 | `inventory_movements` append-only  | Types: `entrada`, `salida_por_orden`, `salida_manual`, `ajuste`. Links to `work_order_id` when applicable. RLS: insert-only, no update/delete.                    |
| M5-3 | Link materials to work order       | Selector on work order (or production-status transition) that records a `salida_por_orden` movement with quantity and notes. Stock can go negative (warn, allow). |
| M5-4 | Low-stock view + nav badge         | Badge counter in nav showing count of materials below threshold; dedicated filtered view; red row highlight per SPEC §4.6.                                        |
| M5-5 | Materials CRUD + manual adjustment | Admin can adjust stock with required reason — creates an `ajuste` movement. `ventas` role is read-only.                                                           |

---

## M6 — Cash reconciliation

**Epic**: `[M6] Corte de caja`

| ID   | Title                                | Acceptance                                                                                                                                                                                             |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M6-1 | `cash_days` schema (opening + close) | Per day per company: `opening_amount`, `opened_by`, `opened_at`, `closing_counted_amount`, `closed_by`, `closed_at`, `expected_amount`, `difference`.                                                  |
| M6-2 | Open-day flow                        | Admin declares opening cash before sales start; UI shows current day status in header. If no day open, admin is prompted at first cash transaction.                                                    |
| M6-3 | Corte de caja report generation      | One-click generate: transactions list, totals by method (efectivo, transferencia, tarjeta), grand total, advance receipts, per-company breakdown, expected vs counted, difference. Saved historically. |
| M6-4 | Corte print layout + history         | Letter-size print-friendly layout; list of past cortes filterable by date and company.                                                                                                                 |

---

## M7 — Polish & stretch

**Epic**: `[M7] Polish, compliance, stretch goals`

| ID   | Title                                | Acceptance                                                                                                                          | Flag      |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------- |
| M7-1 | Admin MFA (TOTP)                     | Enforced via route guard for admin role; enrollment flow documented; backup codes generated.                                        | —         |
| M7-2 | Privacy Notice (Aviso de Privacidad) | Client-ready 1-page document per LFPDPPP; linked in app footer.                                                                     | —         |
| M7-3 | Cloudflare + domain wiring           | Once `prosesaos.com` (or `app.prosesa.com`) is decided: Cloudflare DNS, proxy enabled, SSL, Turnstile integration in Supabase Auth. | —         |
| M7-4 | Kanban view for work orders          | dnd-kit board grouped by status; optimistic updates via TanStack Query; same filters as list view.                                  | `stretch` |
| M7-5 | Lightweight dashboard                | Read-only cards: revenue today / week / month per company, count by work-order stage, low-stock count, pending saldos.              | `stretch` |
| M7-6 | Playwright smoke suite (optional)    | The 4 flows from CLAUDE.md §13 if bandwidth allows.                                                                                 | `stretch` |

---

## Ticket shape (template)

Use for any new ticket to keep quality consistent:

```
Title: <imperative, scoped>

Context:
- Why this exists (link to CLAUDE.md / SPEC section).

Scope:
- Bullet list of what's in.

Out of scope:
- Bullet list of what's explicitly deferred.

Acceptance criteria:
- [ ] …
- [ ] …

Technical notes:
- Schema / RLS / library choices worth flagging.

Links:
- CLAUDE.md §…
- SPEC §…
```

---

## Open items carried into Linear

These live as real tickets, not in-doc prose, so they surface in triage:

- `R-1` — Work order line-item shape (blocks M4-3).
- Any future scope change the client requests mid-Phase 1 → new ticket in `P2 — change requests` backlog, not silently folded in.

---

## Changelog

| Date       | Change                                         |
| ---------- | ---------------------------------------------- |
| 2026-04-14 | Initial Linear structure proposed for Phase 1. |
