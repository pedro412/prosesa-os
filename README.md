# ProsesaOS

Business management system for **Prosesa Diseño y Publicidad** — a print and advertising shop in Ciudad del Carmen, Campeche, Mexico. Replaces handwritten sales notes, daily Excel reconciliation, and manual stock checks with a single web app.

> **Status:** Phase 1 (MVP) in development. M1–M3 shipped (2026-04-15 → 2026-04-19); M4 (project sales + work orders) is next.
> **Audience:** 4–5 users at launch (admin, sales, reception), extensible to workshop and accounting roles.

---

## What's in the MVP

- **Point of Sale** — counter sales and project sales in one interface
- **Product & service catalog** — fixed and variable pricing, free-form line items
- **Multi-company** — two legal entities (razones sociales), shared catalog and inventory, independent folio sequences
- **Sales notes** — auto folio, tax breakdown, thermal and detailed print
- **Work orders** — 7-stage pipeline with backward (rework) transitions and a full status log
- **Material inventory** — stock levels, minimum-threshold alerts, auto-deduct on production, append-only movement log
- **Daily cash reconciliation (corte de caja)** — one-click report, replaces the Excel
- **User management** — two roles: `admin`, `ventas`

Stretch goals if Phase 1 scope holds: Kanban view for work orders, lightweight read-only dashboard.

Full business spec: [`PROSESA-SYSTEM-SPEC.md`](./PROSESA-SYSTEM-SPEC.md).

---

## Tech stack

| Layer        | Choice                                         |
| ------------ | ---------------------------------------------- |
| Build        | Vite                                           |
| Framework    | React (latest) + TypeScript                    |
| Styling      | Tailwind CSS + shadcn/ui                       |
| Router       | TanStack Router                                |
| Server state | TanStack Query                                 |
| Backend      | Supabase (Postgres, Auth, Storage, Realtime)   |
| Hosting      | Vercel Pro (frontend) + Supabase Pro (backend) |
| DNS/proxy    | Cloudflare (deferred until domain is decided)  |

Technical rationale: [`ProsesaOS-technical-decisions.md`](./ProsesaOS-technical-decisions.md).

---

## Getting started

> The repo is being scaffolded — commands below are the target developer experience. Update this section as each piece lands.

### Prerequisites

- Node.js (LTS)
- npm (or pnpm)
- Supabase CLI — `brew install supabase/tap/supabase`
- A Supabase staging project with its URL and anon key

### Setup

```bash
git clone <repo-url> prosesa-os
cd prosesa-os
npm install
cp .env.example .env.development
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Run

```bash
npm run dev          # start Vite dev server
npm run build        # production build
npm run preview      # preview production build locally
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

---

## Project structure

See [`CLAUDE.md` §3](./CLAUDE.md#3-project-structure). In short:

- `src/components/ui/` — shadcn primitives (we own them)
- `src/components/features/` — feature modules (pos, projects, inventory, …)
- `src/lib/queries/` — **all** Supabase calls, one file per domain
- `src/lib/env.ts` — zod-validated env vars
- `src/types/database.ts` — generated from the Supabase schema
- `supabase/migrations/` — versioned SQL migrations
- `supabase/functions/` — Edge Functions (Phase 2)

---

## Supabase

Two projects (per [`CLAUDE.md` §16](./CLAUDE.md#16-deployment)):

| Env     | Project ref            | Plan | Status                                          |
| ------- | ---------------------- | ---- | ----------------------------------------------- |
| Staging | `comfhqhigiighmwuxfbb` | Free | Provisioned                                     |
| Prod    | _TBD_                  | Pro  | Deferred — created when we get closer to deploy |

The `supabase/` directory holds `config.toml` and versioned SQL migrations. Each developer links their local checkout to staging once:

```bash
supabase login                                        # one-time per machine
supabase link --project-ref comfhqhigiighmwuxfbb      # enter the DB password when prompted
```

`supabase/.temp/` (where the link state lives) is gitignored — linking is a per-developer step.

Public signup is **disabled** in the staging project's Auth settings. Users are provisioned by an admin; see §9 of `CLAUDE.md`.

---

## Server state (TanStack Query)

- A single `QueryClient` is created in `src/lib/query-client.ts` and mounted at the app root via `QueryClientProvider`.
- Defaults: `staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`, `mutations.retry: 0`.
- **All** Supabase reads and writes live in `src/lib/queries/<domain>.ts` (see [`CLAUDE.md` §4 rule 2](./CLAUDE.md#4-hard-rules-for-the-agent)). Feature components never call the SDK directly.
- Features consume data through hooks (`useQuery`, `useMutation`) from those query files. `useEffect` is not used for data fetching.
- Devtools are enabled automatically in development only.

---

## Deployment

Vercel hosts the frontend; two Supabase projects back the app. The release model intentionally keeps `main` out of production:

| Env        | Branch / trigger                 | Frontend                                                                                                                                          | Backend Supabase project             |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Staging    | merge to `main`                  | [prosesa-os-env-staging-pedro-alvarezs-projects-6872409c.vercel.app](https://prosesa-os-env-staging-pedro-alvarezs-projects-6872409c.vercel.app/) | Supabase Free — `prosesa-os-staging` |
| Production | manual promotion to `production` | TBD (custom domain pending)                                                                                                                       | Supabase Pro — `prosesa-os-prod`     |

Per-PR preview deployments are intentionally **disabled** — Karina QAs against the `main` staging URL after merge, not on individual branches.

- **`main` never deploys to production.** It deploys to Vercel's `staging` custom environment, which tracks `main` in the Vercel project settings.
- **`production` is a protected long-lived branch.** It is advanced only by a release workflow (out of scope for Phase 1) — no direct pushes, no manual merges. Until that workflow exists, production has no automatic deploys.
- Env vars are set per Vercel environment: Preview and Staging use the staging Supabase project; Production uses the prod Supabase project.

Manual QA on staging (`main` branch deploys) is owned by Karina.

### CI

Every PR runs `lint`, `typecheck`, and `build` via GitHub Actions (`.github/workflows/ci.yml`). Branch protection on `main` requires these checks before merging.

---

## Language

- **Code, commits, docs:** English.
- **All user-facing UI and printed documents:** Spanish (Mexico).

See [`CLAUDE.md` §5](./CLAUDE.md#5-language-policy) for the full policy.

---

## Contributing

- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) — enforced by commitlint + Husky.
- ESLint runs pre-commit. No `any`, no unused vars.
- Supabase types must be regenerated after every schema change — see below.
- Agent collaborators (Claude Code, etc.) must follow [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

### Regenerating DB types

`src/types/database.ts` is generated from the live Supabase schema. Never edit by hand.

```bash
npm run db:types
```

Run this **immediately after** any of:

- `supabase db push` (a migration landed)
- Pulling `main` and noticing a new file under `supabase/migrations/`
- Switching the linked Supabase project

Override the source project with `SUPABASE_PROJECT_ID=<ref> npm run db:types` (defaults to staging). Commit the regenerated file in the same PR as the migration — there is no CI drift check yet.

---

## Documentation

| Document                                                                 | Purpose                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`PROSESA-SYSTEM-SPEC.md`](./PROSESA-SYSTEM-SPEC.md)                     | Business context, module specs, rules, glossary                            |
| [`ProsesaOS-technical-decisions.md`](./ProsesaOS-technical-decisions.md) | Technical rationale for stack and infra                                    |
| [`CLAUDE.md`](./CLAUDE.md)                                               | Agent working contract — consolidated rules                                |
| [`AGENTS.md`](./AGENTS.md)                                               | Stub pointing to `CLAUDE.md`                                               |
| [`docs/linear-phase-1.md`](./docs/linear-phase-1.md)                     | Proposed Linear structure (milestones + tickets) for Phase 1               |
| [`docs/architecture.md`](./docs/architecture.md)                         | Mermaid diagrams — module map, work order pipeline, deployment, data model |

---

## Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are `YYYY-MM-DD`. Milestone-level entries summarize what shipped; per-ticket detail lives in the Linear milestone descriptions.

### [Unreleased]

_(empty — M4 Project sales & work orders opens next; blocked on `R-1` work-order line-item shape research per `CLAUDE.md` §7.)_

### 2026-04-19 — M3: Counter sales POS

#### Added

- Schema + RPC for `sales_notes`, `sales_note_lines`, `payments`; `create_sales_note` with mixto support; generic audit trigger attached to all three.
- POS counter flow: layout, catalog search + free-form lines, per-line discounts, explicit IVA breakdown (per-company configurable, default 16%), mixto payments, thermal ticket print via WebUSB.
- Sales-notes history list + detail drawer with reprint, register-payment, and admin-only cancel; URL-driven filters and search params.
- POS polish: per-workstation sticky company picker + per-company tints (A teal / B amber), draft persistence across reloads with drift sanitize, "Descartar borrador" confirm, "Editar cliente" from POS, fiscal-completeness warning banner when `Requiere factura` is on.
- Sales-note drawer polish: `Requiere factura` badge + row, customer name opens the shared edit dialog.
- Customer schema additions: `direccion_fiscal`, `uso_cfdi` (both nullable); SAT `c_UsoCFDI` catalog constant.
- Cross-cutting UI: `PageContainer` width cap (`/pos` stays full-bleed); shared list primitives (`ListLoadingCard` w/ skeleton, `ListErrorCard`, `ListEmptyCard`, `ListPagination`) consumed by six list views.
- SAT CFDI `c_UsoCFDI` + `c_RegimenFiscal` constants under `src/lib/constants/`.

#### Changed

- SPEC §4.1 realigned — company selector is per-document, not a persistent header indicator (LIT-64).
- `customerFiscalStatus` added as the read-time fiscal-completeness check, reused by POS and queued for Dana's Contpaqi workbench (LIT-90).

#### Decided

- `CLAUDE.md` §17: Facturapi **deferred indefinitely**. Dana keeps Contpaqi permanently; ProsesaOS becomes the pre-invoice data workbench + manual status ledger.

**Exit criterion met:** a counter sale can be completed end-to-end (select items → charge → print thermal ticket) with a valid folio and an immutable record. Target was 2026-05-05; delivered ~2.5 weeks early.

### 2026-04-16 — M2: Core entities

#### Added

- Two razones sociales seeded with placeholder fiscal data (A, B); admin settings surface for companies, users, and printer.
- Customers CRUD shared across both companies; SAT `c_RegimenFiscal` catalog constant; RFC validation helper.
- Catalog CRUD (categories + items) with fixed and variable pricing modes, soft delete, reactivation toggle.
- Inline per-document company picker pattern established on transactional forms.
- In-app user management UI (admin list, invite, role toggle, active state).

#### Changed

- `customers`: dropped `is_publico_general` sentinel and `requiere_factura` flag (LIT-67). The SAT `XAXX010101000` fallback moves to document-render code; `requiere_factura` moves to `sales_notes` / `work_orders` / quotations.

### 2026-04-15 — M1: Foundation

#### Added

- Repo scaffolded (Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Router + TanStack Query).
- ESLint v9 + Prettier + commitlint + Husky + conventional commits enforced.
- Supabase staging provisioned; typed env via zod (`src/lib/env.ts`).
- Auth + `profiles` + 2 roles (`admin` / `ventas`) + baseline RLS policy kit + generic audit trigger (`audit_logs`) + bug-report FAB (`bug_reports`).
- App shell, route guards by role, password set/update route, brand theme tokens (logo, typography, teal primary).
- GitHub Actions CI running `lint`, `typecheck`, `build` on PRs against `main` / `production`.
- `production` long-lived branch for future release workflow; `main` deploys to Vercel's `staging` environment (PR previews intentionally disabled).

### 2026-04-14 — Pre-M1 scaffolding

#### Added

- Business spec (`PROSESA-SYSTEM-SPEC.md`) consolidating Phase 1 requirements.
- Technical decisions document (`ProsesaOS-technical-decisions.md`).
- Agent contract (`CLAUDE.md`) with `AGENTS.md` pointing to it.
- This README.
- Phase 1 Linear structure proposal (`docs/linear-phase-1.md`).

---

## License

Proprietary — internal system for Prosesa Diseño y Publicidad. Not for redistribution.
