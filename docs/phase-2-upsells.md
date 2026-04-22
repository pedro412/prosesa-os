# Phase 2 Upsells — The "Hard to Say No" List

> **Purpose**: Capture the Phase 2 features that compound the Phase 1 wins and become natural follow-up sells once the client has lived with ProsesaOS for a few months. Not speculative product ideas — features rooted in explicit client feedback or observable pain from the first demo and operation.
>
> **Audience**: whoever runs the post-launch sales conversation (Pedro today) needs this document to frame the upsell. Agents working in the repo should respect the Phase 1 / Phase 2 boundary this file codifies.

---

## The validated wins this builds on

From the first client demo (2026-04-22) and the memory file `first_client_demo.md`, three value props landed:

1. **Time saved** at the counter vs. handwritten notes + daily Excel.
2. **No more lost clients** — customer-required-for-orders rule + mixed sales flow.
3. **No more lost track of work orders** — realtime sidebar badge, filterable list, detail page with status log, quick-status row menu.

Every Phase 2 upsell below extends one of these three wins. If a feature doesn't compound one of them, it's not in this document — it lives in `CLAUDE.md §17` as a boundary marker only.

---

## The Pattern

Each upsell captures:

- **What it is** — concrete feature description
- **Why they'll say yes** — the sales narrative, grounded in real feedback or observable pain
- **Depends on (Phase 1 deliverable)** — the data or workflow that must already exist
- **Size estimate** — rough effort, so prospects have realistic expectations

---

## 1. Motor de Comisiones por Vendedor

**What it is.** A configurable commission calculator. Per-vendor rates (fixed %, tabulator, or tiered by monto), cycle selection (monthly, per-nota, per-payment received), a "Comisiones del mes" report, and a lock/paid state so paid commissions aren't recalculated.

**Why they'll say yes.** Gustavo explicitly asked for this in the 2026-04-22 demo: _"para revisar métricas de un vendedor o comisiones etc."_ By the time Phase 1 has been live 3 months, `sales_notes.vendor_id` will have 3 months of attribution data. Dana will already be running the calculation in Excel. Offering to do it in the system — with the same column she's already been looking at — is a layup.

**Depends on.** LIT-107 (vendor attribution) must have landed and be populated. That's the enabling move — no commissions engine without the vendor_id data.

**Size.** Medium. ~1-2 weeks. Migration for rate fields + calculation engine + report UI + lock state.

---

## 2. Dashboard de Ventas por Vendedor

**What it is.** A dashboard page showing: ranking of vendedores by monto vendido in the current period, metas vs actuals if metas are configured, trend lines per vendor, top customers per vendor.

**Why they'll say yes.** Same lineage as commissions. Once Dana has `vendor_id` populated, she'll want to sort it, rank it, filter it. This is the natural "can we see this in a chart" follow-up after commissions land.

**Depends on.** LIT-107 + basic reporting infrastructure (Phase 2 #3 below).

**Size.** Medium. Needs a charting library decision + chart components.

---

## 3. Reporting Suite — "Análisis de Precios y Márgenes"

**What it is.** A reporting area with price trend per item, margin trends, items with negative or thin margin, best-sellers, slow-movers. CSV export.

**Why they'll say yes.** Demo feedback 2026-04-22: _"Debería haber un análisis de precios regularmente para tener todo en orden y actualizado."_ Phase 1 ships LIT-111 (stale-price chip) as a teaser — a single amber chip that says "this item hasn't been touched in 180 days." That's the breadcrumb. The full analysis suite is the destination. When they ask "can we see all the stale items in one view?" — the answer is this upsell.

**Depends on.** LIT-108 (cost column populated) + a couple months of writes to catalog so there's signal in the timeline.

**Size.** Large. ~2-3 weeks. Includes the charting library decision.

---

## 4. Flujo Digital de Cotización Formal

**What it is.** A quotation module: capture-it-once workflow (customer, líneas, total, anticipo sugerido, fecha propuesta), render to PDF, export via email / WhatsApp, convert-to-nota with one click when the customer accepts.

**Why they'll say yes.** Today, **both** the field vendedores **and** Gustavo when he attends walk-ins cotize by hand on WhatsApp / paper. ProsesaOS is the post-deal workbench only. That's a big gap. Field vendedores lose time reformating the same data twice; Gustavo spends time re-typing his own handwriting. A digital quotation that converts 1-click into a nota closes the loop.

**Depends on.** LIT-108 (cost column so the vendor knows their margin before sending). LIT-107 (the quotation is attributed to the vendedor at draft time).

**Size.** Large. ~3 weeks. PDF generation + sending infrastructure (email initially; WhatsApp requires Business API — defer further).

**Narrative wedge.** When a field vendedor loses a deal because they sent the wrong price, ask: "¿Cuántas veces pasa eso al mes?" Then offer this.

---

## 5. CRM Completo del Cliente — Historial Visual

**What it is.** On top of the Phase 1 `/customers/$id` history page (LIT-109), add: gallery de fotos de trabajos previos (upload + viewer), lifetime value totals, credit limit + aging if they want accounts-receivable, relationship notes, tags/segmentación.

**Why they'll say yes.** Phase 1 LIT-109 gives them the list of what the customer has bought. In conversation with a recurring customer, the natural operator question is "¿Nos mandaron foto de esa última lona? ¿Cómo quedó?" The gallery + notes transform ProsesaOS from "record of transactions" to "memory of the relationship." Ties directly into the "no more lost clients" value prop.

**Depends on.** LIT-109 landed. Supabase Storage already in the stack (CLAUDE.md §2).

**Size.** Medium-Large. ~2 weeks. Upload flow + gallery + CRM fields.

---

## 6. WhatsApp Notifications

**What it is.** Automatic message to the customer when: anticipo received, work order advanced to "Terminado," entrega promised date approaches, saldo pendiente reminder after delivery.

**Why they'll say yes.** The shop already uses WhatsApp as the primary comm channel. Today the operator manually sends updates (or forgets). Automating the "your order is ready" message alone saves dozens of operator minutes per week and visibly improves customer perception.

**Depends on.** WhatsApp Business API account (business decision + vendor onboarding), Supabase Edge Function for sending. LIT-39 status log already captures the transition events that would trigger messages.

**Size.** Medium. ~1-2 weeks after the API access is cleared.

**Caveat.** Requires the client to agree to WhatsApp Business API costs and compliance review. Timing this upsell: after the realtime unread badge (LIT-103) has earned trust — the "your app already knows about the order" story makes "your app should tell the customer" feel natural.

---

## 7. CFDI 4.0 Invoicing Automation — Deferred Indefinitely

**What it is.** Automatic CFDI generation via Facturapi, replacing the manual Contpaqi workflow Dana runs today.

**Why they'd say yes.** Eliminates the Contpaqi round-trip. But see caveat.

**Caveat (important).** Per CLAUDE.md §17 this is **deferred indefinitely** because Dana has explicitly said she wants to keep Contpaqi permanently. **Do not pitch this** unless Dana initiates the conversation. The `sales_notes.invoice_id` FK slot is kept in the schema for if that decision ever reverses; LIT-90 handles the pre-invoice data workbench + manual ledger as the Phase 1 answer.

**Listed here only** so the possibility doesn't get lost if circumstances change.

---

## 8. Workshop Station Screens

**What it is.** Dedicated, always-on screen in producción that shows the active work-orders Kanban, auto-refreshes via the LIT-103 realtime infrastructure. Producción can tap "Tomar" on a card to claim an order, "Mover a instalación" to advance stage.

**Why they'll say yes.** Phase 1 closes the front-desk loop. Production still operates "blind" — they hear about orders when Gustavo walks them a printed note. A workshop screen gives them the same visibility the sidebar badge gave Gustavo, for the same reason.

**Depends on.** LIT-41 (work orders list), LIT-42 (detail), LIT-103 (realtime channel). All Phase 1 deliverables.

**Size.** Medium. Kanban view (which was a Phase 1 stretch already per M7 description) + touch-optimized interactions.

---

## 9. Purchase Order Workflow + Material Auto-deduction

**What it is.** When a vendor supplies material to the shop, admin enters a purchase order; stock inflows hit inventory. When a work order lists materials, the commit auto-deducts stock (already scoped in M5 actually — this is more about the PO side).

**Why they'll say yes.** Closes the supply-side loop. The inventory module (M5) tracks stock on hand; the PO flow tracks stock coming in. Eliminates the "we ran out and nobody noticed" problem at the shop.

**Depends on.** M5 Inventory shipping first. `purchase_order_id` FK slot already exists per CLAUDE.md §7 foresight.

**Size.** Medium.

---

## 10. Time-per-Stage Metrics & Rework Cause Tracking

**What it is.** Derived from the LIT-39 status log: "average time from Anticipo Recibido to Terminado across the last 60 days," "work orders that went backward and why," "overdue-at-promised rate."

**Why they'll say yes.** Operational metrics the shop has never been able to see. The data is already captured by LIT-39; this is just aggregation + display.

**Depends on.** LIT-39 log populated for enough time to have signal (≥ 60 days ideal).

**Size.** Small-Medium. Mostly queries + charts.

---

## How to use this document in a sales conversation

1. Start with the Phase 1 wins the client is **already experiencing** ("no more lost clients, no more lost work orders").
2. Point at the data they've been generating ("you have 3 months of vendor attribution, 400 customers with history, 600 work orders tracked through 7 stages").
3. Ask the question where they already feel the pain ("when was the last time you calculated commissions?").
4. Propose the upsell that answers **that specific question**.

Do **not** lead with the upsell. Lead with the pain they're feeling now that they have Phase 1. The upsell is the obvious next step they come up with on their own — you're just naming it.

---

## Maintenance

- When Phase 1 scope shifts, revisit the "Depends on" line of each upsell. If the dependency breaks, either adjust or drop the upsell.
- When a new pain signal arrives (feedback call, support ticket pattern, observed workaround), add to this list — don't just log it in Linear. Feedback → upsell narrative is the chain this document keeps alive.
- Keep this out of CLAUDE.md. CLAUDE.md is for agent instructions in the current repo; this file is for humans running the sales conversation.
