# ProsesaOS — Technical Decisions Summary

> Advertising company business automation system  
> Pipeline management, POS, Inventory, and real-time visibility  
> Solo developer project — optimized for fast delivery

---

## Client Context

- **Company:** Prosesa (advertising/signage business)
- **Team size:** 5–20 people, potential multi-branch
- **Starting point:** Zero (Excel, paper, WhatsApp)
- **Key insight:** Owner already runs daily standups writing project status in a notebook — the Kanban board directly replaces that habit

---

## Project Name

**ProsesaOS** — communicates that this is the operating system of the business.

```
Repo:           prosesa-os
Supabase prod:  prosesa-os-prod
Supabase stg:   prosesa-os-staging
```

---

## Business Pipeline (Core Flow)

```
Quotation → Design → Cut / Print* → Installation → Evidence & Close
                          ↑
                     * fork: Cut OR Print depending on project type
```

Each stage has defined system actions, role-based access, and real-time visibility on the Kanban board.

---

## Core Modules (MVP Scope)

| Module            | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| **Kanban Board**  | Visual project pipeline with drag and drop                                |
| **POS**           | Counter sales, partial payments, daily cash close                         |
| **Inventory**     | Materials tracking, auto-deduction on production orders, low stock alerts |
| **Dashboard**     | Real-time project visibility, revenue, stage distribution                 |
| **Users & Roles** | Salesperson, Designer, Production, Installer, Admin                       |

---

## Out of Scope (Quoted Separately)

- **CFDI 4.0 Invoicing** — via Facturapi, requires Edge Function (API key must stay server-side)
- **WhatsApp Notifications** — via WhatsApp Business API, has per-conversation cost (explained to client)

---

## Infrastructure

### Supabase

- **Production:** Pro plan — $25/month
- **Staging:** Free plan — $0 (pauses after 1 week of inactivity, acceptable for QA)
- **Why Supabase over Railway:** Auth + RLS out of the box, Storage for evidence photos, Realtime for live Kanban updates — all without writing a backend
- **No custom backend needed** — Supabase SDK called directly from the frontend

### Vercel

- **Plan:** Pro — $20/month (already paid)
- **Benefits:** Preview deployments per PR (useful for Karina's QA), environment variables per environment

### Cloudflare

- **Domain registrar** — cost price, no markup
- **Benefits:** DNS management, DDoS protection, proxy hides real IP, free SSL
- **Recommended domain:** `prosesaos.com` or `app.prosesa.com` if they have a corporate domain

### Monthly Infrastructure Cost

```
Vercel Pro      $20/month
Supabase Pro    $25/month
Cloudflare       $0/month  (+~$10/year for domain)
─────────────────────────
Total           $45/month + domain
```

> ⚠️ Bill infrastructure separately from development fee — it's the client's system cost, not your service.

---

## Frontend Stack

| Tool                | Decision                                                   |
| ------------------- | ---------------------------------------------------------- |
| **Build tool**      | Vite (SSR not needed)                                      |
| **Framework**       | React 19 + TypeScript                                      |
| **Styling**         | Tailwind CSS + shadcn/ui                                   |
| **Router**          | TanStack Router (fully type-safe routes and params)        |
| **Data fetching**   | TanStack Query (cache, loading states, optimistic updates) |
| **Drag and drop**   | dnd-kit (replaces unmaintained react-beautiful-dnd)        |
| **Database client** | Supabase JS SDK                                            |

### Why shadcn/ui

Solves the component consistency problem from motoisla-platform — components live in your repo under `src/components/ui/`, you own them, no overriding external library styles. Prevents duplicated/inconsistent UI components across the project.

---

## Project Structure

```
src/
  components/
    ui/           ← shadcn primitives (Button, Input, Badge, Card, Modal, Table)
    features/
      projects/
      inventory/
      pos/
  hooks/          ← custom hooks (prefixed with `use`)
  lib/
    supabase.ts   ← single Supabase client instance
    env.ts        ← typed + validated env vars (zod)
    queries/
      projects.ts
      inventory.ts
      clients.ts
  types/
    database.ts   ← auto-generated from Supabase schema
supabase/
  functions/      ← Edge Functions (invoicing, WhatsApp — phase 2)
  migrations/     ← versioned SQL migrations
CLAUDE.md
AGENTS.md
```

### Rule

Never write a raw `<button>` or `<input>` directly in a feature component. Always import from `src/components/ui/`.

---

## Environment Configuration

```bash
# .env.development
VITE_SUPABASE_URL=https://xxxx-staging.supabase.co
VITE_SUPABASE_ANON_KEY=...

# .env.production
VITE_SUPABASE_URL=https://xxxx-prod.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Typed env vars with Zod

```ts
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = envSchema.parse(import.meta.env)
```

---

## TypeScript & Code Quality

### ESLint v9 + typescript-eslint + Prettier

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

Key rules enforced:

- `@typescript-eslint/no-explicit-any: error` — no `any` allowed
- `@typescript-eslint/no-unused-vars: error`
- `no-console: warn`
- `react-hooks/rules-of-hooks` enforced

### Prettier config

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Conventional Commits (Husky + commitlint)

```bash
npm install -D @commitlint/cli @commitlint/config-conventional husky
```

Format: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`  
Husky runs ESLint before every commit — blocks push if errors exist.

---

## Supabase Type Generation

Add to `package.json` scripts and run after every schema change:

```bash
supabase gen types typescript --project-id xxx > src/types/database.ts
```

---

## AI Agent Configuration

Two files in repo root — Claude Code reads `CLAUDE.md` first:

**`CLAUDE.md` / `AGENTS.md`** should include:

- Full stack declaration
- Folder structure rules
- Component rules (always use `src/components/ui/`)
- Supabase rules (queries only in `src/lib/queries/`, never raw SDK calls in components)
- No `useEffect` for data fetching — use TanStack Query
- No `any` casting
- No installing libraries without checking first
- Commit message format

---

## Automated Testing (Playwright)

**Don't start with full E2E coverage** — UI changes too fast early on and broken tests become a maintenance burden.

**Start with 4 critical flow tests only:**

1. Login by role → sees only what their role allows
2. Create quotation → appears on Kanban board
3. Move project between stages → reflects in real-time on board
4. Inventory deduction when production order is created

Complement with:

- **Karina** doing manual exploratory QA on staging
- **TypeScript** catching errors before any test runs

---

## Audit Log

Single table + generic Postgres trigger applied to all important tables.

```sql
-- Central audit table (INSERT only — never update or delete)
create table audit_logs (
  id          uuid default gen_random_uuid() primary key,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null,  -- INSERT, UPDATE, DELETE
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid references auth.users(id),
  user_role   text,
  created_at  timestamptz default now()
);
```

Apply trigger to: `projects`, `inventory_movements`, `pos_sales`, `project_stages`  
RLS: Admin read-only, no one can modify or delete audit records.

---

## Bug Report Button

Floating action button in the UI → modal with description field + auto-captured context (current URL, user role, timestamp, browser).

Storage: `bug_reports` table in Supabase + optional screenshot via `html2canvas` uploaded to Supabase Storage.

**Future upgrade:** Sentry free tier for real stack traces.

---

## Security

### Brute Force Protection

| Layer                 | Implementation                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| Rate limiting         | Supabase Auth built-in (configurable in dashboard)                               |
| CAPTCHA               | Cloudflare Turnstile — native Supabase integration, free up to 1M requests/month |
| Disable public signup | Supabase → Authentication → disable "Allow new users to sign up"                 |
| MFA for admin role    | Supabase TOTP — enforce via TanStack Router middleware                           |

### General Security

- RLS enabled on all tables — no exceptions
- Never use `service_role` key in frontend
- HTTPS enforced by default (Vercel + Cloudflare)
- Env vars never committed to repo
- Audit log is immutable

---

## Compliance (Mexico)

**Not required for this client:** SOC 2, ISO 27001, HIPAA — these apply to large enterprises or sensitive data (health, finance).

**Required by Mexican law:**

- **LFPDPPP** (Ley Federal de Protección de Datos Personales) — applies because the system stores personal data (client names, phones, emails)

**Practical implications:**

- Publish a Privacy Notice (Aviso de Privacidad) for Prosesa's end clients
- RLS ensures each role only sees what they need
- Client data exports restricted to admin role only
- Supabase Pro includes daily automatic backups — document this for the client

**Recommended deliverable:** 1-page data protection document for the client explaining where data is stored, who has access, and how it's protected.

---

## Deployment Architecture

```
prosesaos.com
     ↓
Cloudflare Proxy (DDoS protection, SSL, hides origin IP)
     ↓
Vercel Pro (Vite app — Production)
     ↓
Supabase Pro (prosesa-os-prod)


PR/Branch preview URL (Vercel)
     ↓
Supabase Free (prosesa-os-staging)
     ↑
Karina QA
```

---

## Phase 2 (Post-MVP)

- Edge Function: CFDI 4.0 invoicing via Facturapi
- Edge Function: WhatsApp Business API stage change notifications
- Sentry error monitoring
- Advanced dashboard analytics
