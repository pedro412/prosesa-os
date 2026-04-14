# ProsesaOS

Business management system for **Prosesa Diseño y Publicidad** — a print and advertising shop in Ciudad del Carmen, Campeche, Mexico. Replaces handwritten sales notes, daily Excel reconciliation, and manual stock checks with a single web app.

> **Status:** Phase 1 (MVP) in development.
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
npm run db:types     # regenerate src/types/database.ts from Supabase schema
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

## Environments

| Env        | Frontend                   | Backend                              |
| ---------- | -------------------------- | ------------------------------------ |
| Production | Vercel Pro (`main` branch) | Supabase Pro — `prosesa-os-prod`     |
| Staging    | Vercel preview URL per PR  | Supabase Free — `prosesa-os-staging` |

Manual QA on staging is owned by Karina.

---

## Language

- **Code, commits, docs:** English.
- **All user-facing UI and printed documents:** Spanish (Mexico).

See [`CLAUDE.md` §5](./CLAUDE.md#5-language-policy) for the full policy.

---

## Contributing

- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) — enforced by commitlint + Husky.
- ESLint runs pre-commit. No `any`, no unused vars.
- Supabase types must be regenerated after every schema change.
- Agent collaborators (Claude Code, etc.) must follow [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

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

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are `YYYY-MM-DD`.

### [Unreleased]

#### Added

- Business spec (`PROSESA-SYSTEM-SPEC.md`) consolidating Phase 1 requirements.
- Technical decisions document (`ProsesaOS-technical-decisions.md`).
- Agent contract (`CLAUDE.md`) with `AGENTS.md` pointing to it.
- This README.
- Phase 1 Linear structure proposal (`docs/linear-phase-1.md`).

---

## License

Proprietary — internal system for Prosesa Diseño y Publicidad. Not for redistribution.
