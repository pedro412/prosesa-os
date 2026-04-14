# Prosesa - Print & Advertising Business Management System

> **IMPORTANT**: All user-facing UI, labels, messages, notifications, and printed documents must be in **Spanish (Mexico)**. This document is written in English for development purposes only.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Context](#2-business-context)
3. [Phase 1 — MVP Scope (Current Sprint)](#3-phase-1--mvp-scope)
4. [Module Specifications](#4-module-specifications)
5. [Data Model Guidelines](#5-data-model-guidelines)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Printing Requirements](#7-printing-requirements)
8. [UI/UX Guidelines](#8-uiux-guidelines)
9. [Future Modules (Post-MVP)](#9-future-modules-post-mvp)
10. [Business Rules & Edge Cases](#10-business-rules--edge-cases)
11. [Technical Decisions](#11-technical-decisions)
12. [Glossary](#12-glossary)

---

## 1. Project Overview

### What is this?

A web-based business management system built specifically for **Prosesa Diseño y Publicidad**, a print and advertising shop located in Ciudad del Carmen, Campeche, Mexico. The business produces custom signage, banners, stickers, vehicle wraps, laser engraving, digital printing, and related services.

### Why does it exist?

The business currently operates with handwritten sales notes, a daily Excel spreadsheet for cash reconciliation, no visibility into production status, no inventory alerts, and no tracking of quotes or follow-ups. This causes lost sales, wasted materials, billing errors, and the owner having to physically walk to the workshop to check on every order.

### Who owns the business?

**Sr. Rolando** and **Sra. Guiguiola**. They operate under **two separate legal entities** (razones sociales) for tax purposes but run as a single business with shared inventory, catalog, staff, and workspace.

### Who are the users?

At launch: 4-5 users across admin, sales, and reception roles. The system must be extensible to support more users and roles (workshop operators, accounting, design) in future phases.

---

## 2. Business Context

This section captures critical business knowledge gathered from multiple on-site visits. Claude Code should reference this when making implementation decisions.

### 2.1 How the business operates today

**Sales channels**: Customers arrive via WhatsApp, walk-in at the front desk, or through the sales team. Reception can quote simple jobs immediately. Complex jobs require Dana (the administrator) to review pricing because costs depend on current material prices from suppliers.

**Two types of sales**:
- **Counter sales (venta de mostrador)**: Fixed-price items sold and paid immediately — business cards, copies, small prints, stickers. Quick transaction, receipt, done.
- **Project sales (venta por proyecto)**: Custom work requiring a quote, approval, possible advance payment, design, production across multiple stations, and delivery. This is the majority of the business revenue.

**Pricing reality**: Not everything has a fixed price. There are three pricing models coexisting:
- **Fixed catalog prices**: Stickers, business cards, standard prints — set price per unit.
- **Variable cost pricing**: Structures, special banners, vehicle wraps — price depends on material type, current supplier cost, dimensions, and complexity. Dana must review these.
- **Negotiated prices**: Discounts are common. Sales staff negotiate with customers, especially for large or repeat orders.

**Payment schemes**:
- Full payment upfront
- Advance payment (anticipo) — typically 50%, balance on delivery
- Partial payments (parcialidades) — multiple installments
- Credit (15 days) — for trusted large companies only

**Payment methods**: Cash, bank transfer, card terminal.

**The two companies**: Both share the same catalog, inventory, staff, and workspace. The distinction is purely fiscal — separate RFC, tax regime, invoice series, and folio sequences. Generally, one company is used for large enterprise clients and the other for daily retail sales, but the operator must be able to choose at the moment of sale which company the transaction belongs to.

**Production workflow**: Once a job is approved and paid (or advance received), it flows through:
1. **Design** — either the customer provides artwork or the in-house team creates it. Requires customer approval before production.
2. **Production** — printing, cutting, vinyl work, laser engraving, etc. The workshop has 2-3 stations.
3. **Quality check at production** — if production finds issues with the design files, they send it back to design. This creates a rework cycle (diseño ↔ impresión).
4. **Finishing/Installation** — if the job requires on-site installation (e.g., vehicle wraps, storefront signage).
5. **Delivery** — customer picks up or delivery is arranged.

**The material problem (real case)**: An advance was collected for a job under the assumption that materials were in stock. After 10+ days, they discovered the material wasn't available and had to be purchased. The customer was upset, the job was delayed, and cash was tied up. This directly motivated the need for inventory alerts.

**Current pain with cash reconciliation**: Every day, someone manually creates an Excel spreadsheet, prints it, and compares it against handwritten notes. This is the single most hated daily task.

**Rework tracking**: When production returns work to design, there's no record of how many rounds occurred, who caused the issue, or time lost. Reworks caused by the business are absorbed as cost. Reworks caused by customer changes are billed separately. The system needs to support this distinction eventually (future module), but the order status flow in MVP should at minimum allow backward movement (e.g., from Production back to Design).

### 2.2 People and their roles

| Person | Role | What they do today |
|--------|------|--------------------|
| Rolando | Owner/Admin | Oversees everything, checks production status by walking to workshop, reviews cash reconciliation |
| Guiguiola | Owner/Admin | Co-owner, involved in business decisions and financial oversight |
| Dana | Administrator | Reviews pricing for complex jobs, manages purchases, checks material stock manually with production team, handles supplier quotes |
| Reception staff | Front desk | Receives customers, creates handwritten notes, collects payments, handles phone/WhatsApp inquiries |
| Sales staff | Sales | Visits clients, generates quotes, negotiates prices, follows up on pending quotes |

### 2.3 Key business metrics they want (future, but shapes data model now)

- Time per production stage (how long does design take? printing? cutting?)
- Quote conversion rate (how many quotes become orders?)
- Revenue by company, by period, by payment method
- Material consumption per project (to calculate real margins)
- Rework frequency and causes
- Overdue orders and bottlenecks

> **Implication for MVP**: Even though we don't build dashboards or metrics in Phase 1, the data model must capture timestamps on every status change and link materials to orders so these metrics are possible later.

---

## 3. Phase 1 — MVP Scope

### 3.1 What we're building

A functional system with these capabilities:
1. **Point of Sale (POS)** — for counter sales and project-based sales
2. **Product/Service Catalog** — with fixed prices and manual/custom pricing
3. **Multi-company selector** — two legal entities, shared catalog and inventory
4. **Sales notes (notas de venta)** — with automatic folio, tax breakdown, and print
5. **Work orders (órdenes de trabajo)** — with status tracking by stage
6. **Material inventory** — with stock levels and minimum alerts
7. **Daily cash reconciliation (corte de caja)** — automatic, replaces the Excel
8. **User management** — basic roles (admin, sales/reception)

### 3.2 What we're NOT building in Phase 1

- Formal PDF quotes with WhatsApp/email sending
- Sales pipeline / follow-up tracking
- Workshop station screens (pantallas de taller)
- CFDI invoicing (facturación fiscal)
- Purchase orders / material request workflow
- Customer CRM with history and gallery
- Dashboards and reports
- Time metrics per stage
- Attendance/clock-in module
- Credit/accounts receivable management (basic advance tracking IS included)

### 3.3 Definition of done for Phase 1

The system is considered delivered when:
- [ ] A user can log in and see only what their role allows
- [ ] A counter sale can be completed: select products, set quantities, apply discount, select payment method, select company, generate and print sales note with folio
- [ ] A project sale can be entered: customer info, line items with description/dimensions/materials/manual price, tax calculation, advance payment recorded, work order created
- [ ] Work orders appear in a list view with filters by status
- [ ] Work order status can be advanced (and moved backward when rework occurs)
- [ ] Materials can be added to inventory with stock quantities and minimum thresholds
- [ ] When stock falls below minimum, a visual alert is displayed (red indicators)
- [ ] Stock is automatically decremented when linked to a work order (with manual adjustment also available)
- [ ] All inventory movements are logged (audit trail)
- [ ] At end of day, a cash reconciliation report can be generated with one click showing: total by payment method, list of all transactions, comparison totals
- [ ] Sales notes can be printed on thermal printer (ticket format) AND on regular printer (detailed format)
- [ ] Everything works in the browser (Chrome) on desktop and tablet

---

## 4. Module Specifications

### 4.1 Multi-Company Configuration

**Purpose**: Allow all operations to be attributed to one of two legal entities.

**Requirements**:
- Store two company profiles with: business name (nombre comercial), legal name (razón social), RFC, tax regime (régimen fiscal), fiscal address, logo, contact info
- Every sale note and work order must be linked to exactly one company
- Folio sequences are independent per company (e.g., Company A: A-0001, A-0002... Company B: B-0001, B-0002...)
- A **company selector** must be visible and accessible when creating any transaction — the operator chooses which company the transaction belongs to
- Catalog and inventory are shared across both companies
- Reports must be filterable by company and also support consolidated view

**UI detail**: The company selector should be prominent but not intrusive. Consider a persistent indicator in the header/nav showing which company is currently active, with easy toggle.

### 4.2 Product & Service Catalog

**Purpose**: Maintain a catalog of products and services with pricing to speed up sales and quotes.

**Requirements**:
- Each item has: name, description, category, unit of measure, base price, tax configuration
- Categories examples: "Lonas", "Vinil", "Papelería", "Stickers", "Grabado láser", "Rotulación", "Diseño", "Impresión", "Estructuras"
- Units of measure: piece (pieza), square meter (m²), linear meter (m), liter (litro), roll (rollo), hour (hora)
- Items can have a **fixed price** (stickers at $X per unit) or be marked as **variable/quote** (price entered manually at sale time)
- For variable-price items, the catalog entry serves as a template — the name, category, and unit are pre-filled, but the operator enters the price
- Support **discounts** at the line-item level: by percentage or fixed amount
- Items can be marked as active/inactive (soft delete)

**Important**: The catalog is NOT a strict constraint. The sales screen must allow adding **free-form line items** that don't exist in the catalog — a description, unit, quantity, and manual price. This is essential because many jobs are unique and won't match any catalog entry.

### 4.3 Point of Sale (POS)

**Purpose**: Register sales — both quick counter sales and project-based sales.

**Two modes, one interface**: The POS should handle both counter sales and project sales. The difference is:
- Counter sale: select items, charge, print note, done. No work order generated.
- Project sale: enter detailed line items (descriptions, dimensions, materials), charge full or advance payment, generate work order for production.

**A toggle or flag** (e.g., "Genera orden de trabajo" checkbox) determines whether a work order is created from the sale.

**POS screen requirements**:
- **Company selector** — which legal entity this sale belongs to
- **Customer field** — optional for counter sales ("Público en general"), required for project sales. Searchable by name, phone, or RFC. Quick-add new customer inline.
- **Line items area**:
  - Search catalog by name, code, or category to add items
  - OR add free-form line item with: concept/description, dimensions (optional text field), material (optional text field), unit, quantity, unit price
  - Each line shows subtotal
  - Discount per line (% or fixed amount)
  - Remove/edit lines
- **Totals area**:
  - Subtotal
  - IVA (16%) — calculated automatically. All prices are treated as tax-inclusive by default; the system back-calculates the tax. Confirm this with client, but design for configurability.
  - Total
- **Payment area**:
  - Payment method: Efectivo, Transferencia, Tarjeta, Mixto
  - For Mixto: allow splitting across methods (e.g., $5,000 cash + $3,000 transfer)
  - For project sales: field for "Anticipo" (advance) amount. The rest becomes "Saldo pendiente" (pending balance).
  - Mark if customer will require invoice later ("Requiere factura" flag)
- **Actions**:
  - "Cobrar y generar nota" — completes the sale, generates the sales note with folio
  - If "Genera orden de trabajo" is checked, also creates the work order
  - Print options: thermal ticket, detailed note, or both

**Important UX**: The POS must be fast. Reception deals with walk-in customers who are waiting. Minimize clicks. Keyboard shortcuts are a plus. Search must be instant.

### 4.4 Sales Notes (Notas de Venta)

**Purpose**: Formal internal receipt for every sale. Replaces the handwritten notes.

**Data captured**:
- Auto-generated folio (per company: A-0001, B-0001, etc.)
- Date and time
- Company (razón social, RFC, address, logo)
- Customer name (or "Público en general")
- Customer RFC and fiscal data (if provided / if invoice required)
- Line items: quantity, unit, concept/description, unit price, discount, line total
- Subtotal, IVA, Total
- Payment method(s) and amounts
- Advance paid vs pending balance (for project sales)
- "Requiere factura" flag
- Notes/observations field
- Status: Pagada, Pendiente, Abonada, Cancelada
- User who created it
- Linked work order ID (if applicable)

**Status transitions**:
- `Pagada` — fully paid
- `Pendiente` — no payment yet or only advance
- `Abonada` — partial payments made, balance remaining
- `Cancelada` — voided (requires admin authorization)

**Actions on notes**:
- View / print (thermal or detailed)
- Record additional payment (moves from Pendiente/Abonada toward Pagada)
- Cancel (admin only, with reason)
- View linked work order

### 4.5 Work Orders (Órdenes de Trabajo)

**Purpose**: Track custom jobs from receipt through production to delivery.

**Data captured**:
- Auto-generated folio (separate sequence from sales notes, also per company)
- Linked sales note
- Customer info (inherited from sale)
- Company (inherited from sale)
- Detailed description of the work
- Line items with: description, dimensions, materials, quantities, finishes/specs
- Attached files (future: for now, a notes field where they can reference file names)
- Assigned area or responsible person (optional in MVP)
- Dates: created, promised delivery date, actual delivery date
- Current status with timestamp log
- Internal notes (visible only to staff)
- Priority flag (normal, urgent)

**Status flow** (kept simple but extensible):

```
Cotizado → Anticipo recibido → En diseño → En producción → En instalación* → Terminado → Entregado
                                    ↑              |
                                    └──────────────┘
                                     (rework cycle)
```

*"En instalación" only applies to certain jobs (e.g., storefront signs, vehicle wraps). It should be skippable.

**Statuses in detail**:

| Status | Meaning | Who changes it |
|--------|---------|----------------|
| Cotizado | Quote generated, waiting for customer approval/payment | Auto on creation without payment |
| Anticipo recibido | Advance payment received, job is greenlit | Auto when advance is recorded |
| En diseño | Design team is working on the artwork | Admin/Sales |
| En producción | In the workshop: printing, cutting, etc. | Admin/Sales |
| En instalación | Being installed on-site (optional, skippable) | Admin/Sales |
| Terminado | Work is done, ready for pickup/delivery | Admin/Sales |
| Entregado | Delivered to customer, job closed | Admin/Sales |

**Critical requirements**:
- **Backward movement is allowed**: Production can send back to Design (rework). The system must log every status change with timestamp, user, and optional note explaining the change.
- **Status change log** is an append-only audit trail. Every change records: old status, new status, timestamp, user, note.
- **List view with filters**: Filter by status, by company, by date range, by customer, by priority. Sort by date or promised delivery date.
- **Visual indicators**: Overdue orders (past promised date) should be visually flagged.
- **Simple but clear**: In MVP, this is a list/table view with filters and a detail panel — NOT a full kanban board (that's a future module).

### 4.6 Material Inventory

**Purpose**: Track stock of production materials and alert when running low.

**What is tracked**:
- Material name (e.g., "Lona 13oz", "Vinil blanco", "Tinta magenta Epson", "Acrílico 3mm")
- Category (e.g., Lonas, Vinil, Tintas, Sustratos, Papel, Estructura)
- Unit of measure (metros, litros, piezas, rollos, hojas, kg)
- Current stock quantity
- Minimum threshold (reorder point)
- Location or notes (optional)

**Stock movement types**:
- **Entrada** (stock in): Purchase received, manual adjustment
- **Salida por orden** (stock out - order): Automatic decrement linked to a work order
- **Salida manual** (stock out - manual): Adjustment, damage, internal use
- **Ajuste** (adjustment): Correction after physical count

**Every movement is logged** with: date, type, quantity, work order reference (if applicable), user, notes. This is a non-deletable audit trail.

**Automatic decrement flow**:
- When a work order is created or moved to "En producción", materials can be linked to it
- The operator selects which materials and quantities are being used
- Stock is decremented and the movement is logged with the work order reference
- If stock would go below zero, show a warning but allow it (materials might already be physically used)

**Manual adjustment**:
- Admin can manually adjust stock (e.g., after physical count)
- Requires a reason/note

**Alerts**:
- Materials below minimum threshold are visually highlighted (red badge, icon, etc.)
- A dedicated "Stock bajo" view/filter shows all materials below minimum
- This view should be accessible from the main navigation — it's one of the highest-value features for the client

### 4.7 Daily Cash Reconciliation (Corte de Caja)

**Purpose**: Replace the daily Excel spreadsheet. Generate end-of-day cash report with one click.

**Report contents**:
- Date
- List of all sales notes created that day with: folio, customer, total, payment method, status
- Summary totals by payment method: cash, transfer, card
- Grand total
- Count of transactions
- Advances received (separate line)
- Company breakdown (how much attributed to Company A vs Company B)
- User who generated the report

**Behavior**:
- "Generar corte de caja" button — generates the report for the current day (or selectable date)
- Can be printed
- Historical cortes are saved and viewable
- Only admin can generate the corte (or configurable permission)

### 4.8 Customer Registry

**Purpose**: Store customer information to avoid re-entering it on every sale.

**MVP scope** (minimal — full CRM is a future module):
- Name (or business name)
- Phone / WhatsApp
- Email
- RFC (optional)
- Razón social (optional)
- Régimen fiscal (optional)
- Código postal fiscal (optional)
- Internal notes
- "Requiere factura" default flag
- Created date

**Searchable** by name, phone, RFC. Quick-add from the POS without leaving the sales screen.

**Future expansion**: Full customer profile with purchase history, gallery of completed works, total billed per company, credit limits, commercial follow-up notes. Design the data model to accommodate this.

---

## 5. Data Model Guidelines

These are guidelines, not a rigid schema. Claude Code should design the actual schema based on these principles.

### 5.1 Core principles

- **Every transaction has a company_id**: Sales notes, work orders, folios — all scoped to a company.
- **Folio sequences are per company**: Company A has its own incrementing sequence, Company B has its own.
- **Timestamps everywhere**: created_at, updated_at on every table. Status changes get their own timestamped log entries.
- **Soft deletes**: Never hard-delete records. Use a `deleted_at` or `is_active` flag.
- **Audit trail**: Inventory movements and work order status changes are append-only logs.
- **User attribution**: Every record tracks which user created/modified it.
- **Currency**: Mexican Pesos (MXN). Store amounts in decimal with 2 decimal places.
- **Timezone**: America/Mexico_City (CST/CDT). Store timestamps in UTC, display in local time.

### 5.2 Key relationships

```
Company (1) ←→ (N) Sales Notes
Company (1) ←→ (N) Work Orders
Customer (1) ←→ (N) Sales Notes
Sales Note (1) ←→ (0..1) Work Order
Work Order (1) ←→ (N) Status Changes (log)
Work Order (1) ←→ (N) Inventory Movements
Material (1) ←→ (N) Inventory Movements
Sales Note (1) ←→ (N) Payments
Sales Note (1) ←→ (N) Line Items
Work Order (1) ←→ (N) Line Items (can be inherited from sales note)
User (1) ←→ (N) Sales Notes (created_by)
```

### 5.3 Design for future

Even though these modules aren't built yet, the data model should not block them:
- **Quotes (cotizaciones)**: Will be similar to sales notes but with status (draft, sent, approved, rejected, expired). Consider shared line-item structure.
- **CFDI invoicing**: Sales notes will eventually link to invoices. Leave room for invoice_id FK.
- **Purchase orders**: Will link to materials and work orders. Inventory "Entrada" movements will eventually link to purchase orders.
- **Time tracking**: Status change log already captures timestamps. Future modules can calculate durations from these.
- **Customer gallery**: Future file storage linked to work orders / customers.

---

## 6. User Roles & Permissions

### 6.1 MVP Roles

| Role | Access |
|------|--------|
| **Admin** | Everything. Create/edit/cancel sales notes. Manage work orders. Manage inventory (including adjustments). Generate corte de caja. Manage users. Manage catalog. Manage companies. |
| **Ventas/Recepción** | Create sales notes. Create work orders. View and update work order status. View inventory (read-only, cannot adjust). Record payments. View customers. Cannot cancel notes (admin only). Cannot generate corte de caja. |

### 6.2 Future roles (design for extensibility)

- **Producción/Diseño**: View and update work order status only. No access to financial data (prices, payments, totals). Can view material stock relevant to their work.
- **Facturación**: Create invoices, manage fiscal data. Read-only on everything else.
- **Gerencia**: Read-only access to everything plus reports and dashboards.

### 6.3 Auth approach

- Email + password login via Supabase Auth
- Row Level Security (RLS) policies based on user role stored in a profiles/users table
- Session management handled by Supabase

---

## 7. Printing Requirements

### 7.1 Thermal ticket (impresora térmica)

- Used for: counter sales receipts, quick confirmation tickets
- Width: 80mm (standard thermal)
- Content: company name/logo (small), folio, date, line items (abbreviated), total, payment method, a thank you message
- Must be printable directly from the browser (using `window.print()` with a thermal-optimized CSS, or a lightweight print library)
- Keep it concise — this is a receipt, not a detailed document

### 7.2 Detailed printed note (impresora normal)

- Used for: project sales, work orders, detailed customer copies
- Letter size (carta) or half-letter
- Content: full company header with logo, customer info, detailed line items with descriptions/dimensions/materials, subtotal, IVA, total, payment breakdown, work order number if applicable, observations, signature lines
- PDF generation is ideal for consistent printing

### 7.3 Corte de caja print

- Regular printer, letter size
- Summary format with all daily transactions and totals

---

## 8. UI/UX Guidelines

### 8.1 General principles

- **Speed over beauty** — the POS must be fast. Reception has customers waiting.
- **Spanish throughout** — all labels, buttons, messages, placeholders, error messages in Spanish.
- **Mobile-friendly is a plus, desktop-first is the priority** — primary use is on desktop computers at reception and admin office. Tablet support (for future workshop screens) is a bonus.
- **Minimal training required** — Rolando's team is not tech-savvy. UI should be self-explanatory.
- **Visual alerts for stock** — red badges/indicators for materials below minimum. This should be visible without navigating to the inventory screen (e.g., a counter badge in the nav).

### 8.2 Navigation structure (suggested)

```
├── POS (Punto de venta)           ← Primary screen, most used
├── Órdenes de trabajo             ← List with filters
├── Inventario                     ← Materials list with stock indicators
│   └── Stock bajo                 ← Filtered view of low-stock items
├── Notas de venta                 ← History and search
├── Corte de caja                  ← Generate and view history
├── Clientes                       ← Customer registry
├── Catálogo                       ← Products and services (admin)
└── Configuración                  ← Companies, users, settings (admin)
```

### 8.3 Key UX flows to optimize

1. **Counter sale** (target: under 30 seconds): Open POS → search/add items → select payment method → Cobrar → ticket prints
2. **Project sale** (target: under 3 minutes): Open POS → set/search customer → add line items with details → toggle "Genera orden de trabajo" → record advance → Cobrar → note prints + work order created
3. **Check low stock** (target: 2 clicks): Nav badge shows count → click → see all low-stock materials
4. **Update work order status** (target: 3 clicks): Open orders list → click order → change status → save (with optional note)
5. **Daily cash close** (target: 1 click): Open corte → "Generar corte de hoy" → review → print

---

## 9. Future Modules (Post-MVP)

These are documented here so the MVP architecture doesn't block them. Each will be scoped and quoted separately.

### 9.1 Formal Quotations (Cotizaciones)
- Generate professional PDF quotes
- Send via WhatsApp or email
- Convert approved quote to sales note + work order with one click
- Status tracking: borrador, enviada, aprobada, rechazada, vencida
- Validity period / expiration

### 9.2 Sales Pipeline & Follow-up
- Visual pipeline (kanban or funnel): enviada → en negociación → aprobada → perdida
- Automatic reminders for pending quotes
- Lost reason tracking for analytics
- Conversion rate metrics

### 9.3 Workshop Station Screens (Pantallas de taller)
- Simplified view per station (corte, impresión, acabados)
- Shows only orders assigned to that station
- Single "Finalizar tarea" button to advance order to next stage
- Daily progress bar (gamification: X of Y completed today)
- Designed for TV screens or tablets mounted in workshop
- No financial data visible — only job specs and status

### 9.4 CFDI Invoicing (Facturación fiscal)
- Integration with a PAC (timbrado provider)
- Issue invoices from either company
- Link invoices to sales notes
- Generate PDF + XML
- Cancellation flow
- Folio and certificate management per company

### 9.5 Purchase Orders & Material Requests
- Formal request workflow: who requests, what material, for which project/folio, urgency, authorization
- Link purchases to work orders for cost tracking
- Supplier management
- Purchase history per material

### 9.6 Customer CRM
- Full customer profile with purchase history
- Gallery of completed works (photos)
- Total billed per company
- Credit limits and terms
- Commercial follow-up notes and reminders
- Customer segmentation (new, frequent, inactive, VIP)

### 9.7 Reports & Dashboard
- Sales by period, user, payment method, company
- Production metrics: time per stage, bottlenecks, overdue orders
- Inventory: consumption trends, material costs
- Financial: revenue, margins per project (material cost vs price charged)
- Quote conversion rates
- Comparative reports between the two companies

### 9.8 Time Metrics & Productivity
- Automatic calculation of time per production stage (from status change timestamps)
- Average times by job type
- Delay detection and alerting
- Worker productivity metrics (when station screens are implemented)
- Historical data to promise realistic delivery times to customers

### 9.9 Attendance & Clock-in
- Portal for staff to register check-in/check-out
- Limited access: each person only sees their own attendance module
- Admin dashboard for attendance overview

### 9.10 Rework Tracking
- Formal rework logging when orders move backward in status
- Categorize cause: internal error vs customer change request
- Track cost impact: reworks absorbed by business vs billed to customer
- Rework frequency reports

### 9.11 Accounts Receivable & Credit Management
- Credit terms per customer (e.g., 15-day credit for large companies)
- Aging reports (saldos vencidos)
- Payment reminders
- Customer statement of account

---

## 10. Business Rules & Edge Cases

These rules come directly from conversations with the client and must be respected in the implementation.

### Sales & Payments
- A sale can be split across multiple payment methods (mixto)
- An advance (anticipo) creates a pending balance. Additional payments can be recorded later until the note is fully paid.
- Only admins can cancel a sales note. Cancellation requires a reason.
- "Público en general" is a valid customer for counter sales (no customer record required)
- Discounts can be applied per line item, not just at the total level
- IVA (16%) is included in prices by default. The system should back-calculate: subtotal = total / 1.16, IVA = total - subtotal. Confirm this with client but build it configurable.

### Work Orders
- A work order is always linked to a sales note
- Status can move forward AND backward (rework cycle)
- "En instalación" is optional — not all jobs require it. The status can be skipped.
- An order should not be marked "Entregado" unless it's fully paid (warning, not hard block — admin can override)
- Every status change is logged with timestamp and user

### Inventory
- Stock can go negative (warn but allow — material might be physically consumed before being registered)
- All movements are auditable — no movement can be deleted
- Automatic stock decrement happens when materials are linked to a work order entering production
- Manual adjustments require a reason
- The minimum threshold is per material, set by admin

### Multi-company
- A sales note belongs to exactly one company — it cannot be transferred after creation
- The company is selected before/during the sale, not after
- If no company is selected, the system should not allow the sale to proceed
- Folios are sequential per company and never reused, even after cancellation

### Users
- Users cannot delete their own account
- Only admins can create users and assign roles
- All actions are attributed to the logged-in user
- Session timeout: configurable, suggest 8 hours for reception workstations

---

## 11. Technical Decisions

### 11.1 Confirmed

- **Platform**: Web application (browser-based, Chrome primary target)
- **Hosting/Backend**: Supabase (PostgreSQL database, Auth, Storage, Edge Functions)
- **Infrastructure budget**: ~$25 USD/month on Supabase Pro plan

### 11.2 Suggested (open for discussion during planning)

- **Frontend framework**: React with Vite
- **Routing**: TanStack Router
- **Data fetching / server state**: TanStack Query
- **UI component library**: TBD — consider shadcn/ui, Mantine, or similar
- **Printing**: Browser print API with CSS media queries for thermal vs detailed formats. Evaluate libraries like react-to-print.
- **PDF generation**: For detailed notes — consider generating server-side (Supabase Edge Function) or client-side (jsPDF, react-pdf)
- **State management**: TanStack Query for server state, React context or Zustand for UI state
- **Styling**: TBD — Tailwind CSS is a natural fit with most component libraries
- **Deployment**: Netlify or Vercel for frontend, Supabase handles backend

### 11.3 Supabase architecture notes

- Use **Row Level Security (RLS)** for role-based access control
- Store user role in a `profiles` table linked to Supabase Auth users
- Use **database functions** for transactional operations (e.g., creating a sale note + decrementing stock + recording payment in one transaction)
- Use **Supabase Realtime** (future) for workshop screens to see live updates
- Use **Supabase Storage** (future) for file attachments and customer gallery

---

## 12. Glossary

| Term (Spanish) | English | Description |
|----------------|---------|-------------|
| Nota de venta | Sales note | Internal receipt for a sale transaction |
| Orden de trabajo | Work order | Production order for a custom job |
| Corte de caja | Cash reconciliation | End-of-day cash report |
| Anticipo | Advance payment | Partial payment before job completion |
| Saldo pendiente | Pending balance | Remaining amount owed |
| Razón social | Legal entity name | Official company name for fiscal purposes |
| RFC | Tax ID | Mexican tax identification number |
| CFDI | Digital fiscal receipt | Official electronic invoice format (SAT) |
| PAC | Timbrado provider | Third-party service that stamps CFDI invoices |
| Folio | Sequential number | Auto-incrementing document number |
| Público en general | General public | Anonymous customer for counter sales |
| Lona | Banner | Large format printed banner material |
| Vinil | Vinyl | Adhesive vinyl for stickers, wraps, etc. |
| Rotulación | Vehicle wrap/signage | Applying graphics to vehicles or surfaces |
| Grabado láser | Laser engraving | Laser cutting/engraving service |
| Tinta | Ink | Printing ink |
| Sustrato | Substrate | Base material for printing |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-14 | 1.0 | Initial consolidated document for Phase 1 MVP |

---

*This document is the single source of truth for Phase 1 development. Any scope changes must be documented here before implementation.*
