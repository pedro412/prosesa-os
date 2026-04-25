# M5 — Materials & Inventory Design

> **Purpose**: Resolve architectural questions for M5 before ticket carving. Companion to [`docs/linear-phase-1.md`](./linear-phase-1.md) (M5 epic) and [`PROSESA-SYSTEM-SPEC.md` §4.6](../PROSESA-SYSTEM-SPEC.md).

> **Status**: Design proposal, pending two client confirmations (see §6). Schema and ticket carve are ready to implement; the open questions can be back-patched cheaply if the answers change.

---

## 1. Context

Phase 1's M5 ships material tracking with low-stock alerts and an audit trail of movements. The original SPEC describes "automatic decrement when a work order moves to en_produccion" _and_ "operator selects which materials and quantities are being used" — these read like two separate flows because they are.

Field interviews with the client clarified the real shop operating model:

- **Dana (administration) is the inventory operator-of-record.** All material movements pass through her, not through production. Today she keeps an Excel sheet for inks because production was disorderly with them; the rest of the materials are tracked by ad-hoc memory.
- **The cotization flow is freeform.** Gustavo at reception quotes from experience without consulting stock. The order is then handed to Dana, who reviews "do we have everything?" — typically by walking to the workshop. When something is missing (e.g., the galvanized sheet for a sign), she places the supplier order. This is where the SPEC §2.1 incident originated: an advance was collected, no one verified stock, the material was missing, the job was delayed 10 days.
- **The material problem the system must solve is not "auto-deduct on production transition." It is "give Dana 10-second visibility into stock so she can answer the viability question without leaving her desk."** Once stock is visible and current, manual deductions are cheap; automatic deduction is over-engineering for a make-to-order shop with freeform line items.

That reframing carries through every design decision below.

---

## 2. Scope

### In scope (M5 — MVP)

1. `materials` registry with categories, unit, `current_stock`, `min_threshold` (admin-side CRUD)
2. `inventory_movements` append-only log of four types (`entrada`, `salida_por_orden`, `salida_manual`, `ajuste`)
3. Manual adjustment UI (admin) with required reason
4. Low-stock view + nav badge
5. Linking individual salidas to a work order folio (operator-driven, not automatic)

### Out of scope (Phase 2)

- **BOM** (bill of materials linking `catalog_items` to expected `materials` consumption). Enables "this quote needs X, you have Y" automatically. Sells well as a follow-up module.
- **Purchase orders** (formal supplier workflow, receipt, link to `entrada` movements). SPEC §9.5.
- **Stock reservation** (committing material to an order before physical pull). Implies the `work_order_materials` table we are explicitly not building.
- **Workshop station screens** that let production register consumption from the bench. SPEC §9.3.
- **Multi-unit** (e.g., purchase a rollo of 50 m, consume in m). One unit per material in MVP — see §6 for the open question.
- **Per-company inventory.** Materials are shared across both razones sociales (CLAUDE.md §6).

---

## 3. Design decisions

### 3.1 `materials` and `catalog_items` are separate, no bridge

`catalog_items` is what Prosesa **sells** (pricing templates for services and finished products). `materials` is what they **consume** (vinyl rolls, inks, sheets). They are distinct domains and stay distinct in MVP.

The case "I sell a roll of vinyl as-is" is handled with a `salida_manual` post-sale, not by joining the two tables. Any structural bridge — flag on `catalog_items`, FK to `materials`, or an intermediate `catalog_item_materials` table — _is_ the BOM module under another name. Building it now scopes M5 into something it isn't.

### 3.2 Stock decrement is operator-driven, not event-driven

No trigger fires on work order status transitions. There is no "moving to `en_produccion` decrements anything."

Rationale:

- Auto-decrement requires knowing what to decrement, which requires BOM.
- Dana (the actual operator) does not work from a status board; she works from material requests and physical movement.
- Status changes belong to producción/sales; material movements belong to administration. Coupling them couples two roles that don't share a workflow today.

### 3.3 No `work_order_materials` table

A separate table to list "materials planned for this work order" is a budget/plan structure, which is BOM-shaped. Skipped.

The relationship between materials and work orders is captured directly on `inventory_movements.work_order_id`. Querying `inventory_movements` grouped by `work_order_id` yields the full per-order consumption ledger — no second table needed.

### 3.4 The operator UX lives in the inventory module, not on the work order

The primary path to record a `salida_por_orden` is in the inventory module: Dana picks the material, the quantity, and types/picks the work order folio. Secondary path: a button on the work order detail ("Materiales consumidos en esta orden") that opens the same dialog with the folio prefilled.

This matches Dana's workflow ("alguien me pide tinta roja, descuento") rather than imposing a workflow ("when I open the work order I should think about materials").

### 3.5 Reposition for Phase 2 without migration

The schema reserves `inventory_movements.purchase_order_id` (nullable, no FK in MVP) so when POs ship in Phase 2 they can backfill the column without a data migration. No other forward-compat slots are needed; BOM, when it lands, is additive (new tables only).

---

## 4. Proposed schema

> All naming and conventions follow [`CLAUDE.md` §7](../CLAUDE.md#7-data-model-principles) and the migration policy kit in [`supabase/migrations/README.md`](../supabase/migrations/README.md).

### 4.1 `material_categories`

Top-level grouping for the materials list (mirrors `catalog_categories`). Seeded with the six categories from SPEC §4.6; Dana can edit.

```sql
create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint material_categories_name_not_blank check (length(trim(name)) > 0)
);

create unique index material_categories_name_unique
  on public.material_categories (lower(name))
  where deleted_at is null;
```

Triggers: `set_updated_at`, `stamp_actor_columns`, `audit.attach('material_categories')`.

Seed (in the same migration):

```sql
insert into public.material_categories (name) values
  ('Lonas'),
  ('Vinil'),
  ('Tintas'),
  ('Sustratos'),
  ('Papel'),
  ('Estructura');
```

### 4.2 `materials`

```sql
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid references public.material_categories (id) on delete set null,
  unit text not null,
  current_stock numeric(12,2) not null default 0,
  min_threshold numeric(12,2) not null default 0,
  is_active boolean not null default true,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint materials_name_not_blank check (length(trim(name)) > 0),
  constraint materials_unit_check check (unit in (
    'pieza', 'm', 'm2', 'litro', 'rollo', 'kg', 'hoja', 'cartucho'
  )),
  constraint materials_min_threshold_nonneg check (min_threshold >= 0)
  -- No NOT NULL guard or non-negativity on current_stock.
  -- Stock can go negative per CLAUDE.md §8.
);

create unique index materials_name_unique
  on public.materials (lower(name))
  where deleted_at is null;

create index materials_category_idx
  on public.materials (category_id)
  where deleted_at is null;

-- Cheap source for the low-stock view and nav badge (M5-5).
create index materials_low_stock_idx
  on public.materials (id)
  where current_stock <= min_threshold and is_active and deleted_at is null;
```

Notes:

- No `company_id`. Inventory is shared across razones sociales (CLAUDE.md §6).
- `unit` is a CHECK list, not an enum, so adding units later is a one-line ALTER (same pattern as `catalog_items.unit`). Confirm the eight values with the client.
- `location` is a free-form text field for "estante 3", "bodega chica", etc. — Dana asked for it implicitly when she said she walks to the workshop to check. Optional.

Triggers: `set_updated_at`, `stamp_actor_columns`, `audit.attach('materials')`.

### 4.3 `inventory_movements`

```sql
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete restrict,
  movement_type text not null,
  quantity numeric(12,2) not null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  purchase_order_id uuid,  -- reserved for Phase 2 POs; no FK yet
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint inventory_movements_type_check check (movement_type in (
    'entrada', 'salida_por_orden', 'salida_manual', 'ajuste'
  )),
  constraint inventory_movements_quantity_nonzero check (quantity != 0),
  constraint inventory_movements_sign_aligned check (
    (movement_type = 'entrada' and quantity > 0) or
    (movement_type in ('salida_por_orden', 'salida_manual') and quantity < 0) or
    (movement_type = 'ajuste')
  ),
  constraint inventory_movements_salida_por_orden_has_wo check (
    movement_type != 'salida_por_orden' or work_order_id is not null
  ),
  constraint inventory_movements_salida_manual_has_reason check (
    movement_type != 'salida_manual' or (reason is not null and length(trim(reason)) > 0)
  ),
  constraint inventory_movements_ajuste_has_reason check (
    movement_type != 'ajuste' or (reason is not null and length(trim(reason)) > 0)
  )
);

create index inventory_movements_material_idx
  on public.inventory_movements (material_id, created_at desc);

create index inventory_movements_work_order_idx
  on public.inventory_movements (work_order_id)
  where work_order_id is not null;
```

Design choices:

- **Signed quantity.** Entradas positive, salidas negative, ajustes either. Makes `current_stock = SUM(quantity)` true by construction; the AFTER INSERT trigger that updates `materials.current_stock` is a one-liner.
- **No `updated_at`, no `deleted_at`.** Append-only. RLS forbids UPDATE/DELETE.
- **`reason` required for `salida_manual` and `ajuste`.** Both are anomaly events — Dana writes "merma por accidente" or "ajuste post conteo físico". `salida_por_orden` has the work order folio as context, doesn't need a reason. `entrada` is usually obvious (recibo de proveedor) but `reason` is available for notes like "Pedido a Acme, factura 1234" until Phase 2 PO module ships.
- **`purchase_order_id` is a UUID column with no FK in MVP.** When the PO module ships, add the FK constraint via migration; existing rows have NULL and remain valid.
- **Salidas can target cancelled or `entregado` orders.** No constraint on the parent order's status — Dana may legitimately backfill consumption that already happened, or record a salida and have the order cancelled later. The salida is real either way.

#### Stock-update trigger

```sql
create or replace function public.apply_inventory_movement_to_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.materials
  set current_stock = current_stock + NEW.quantity,
      updated_at = now()
  where id = NEW.material_id;
  return NEW;
end
$$;

revoke all on function public.apply_inventory_movement_to_stock() from public;

create trigger inventory_movements_apply_to_stock
after insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement_to_stock();
```

Other triggers on `inventory_movements`:

- `stamp_actor_columns` for `created_by` (INSERT side only — table has no UPDATE path).
- `audit.attach('inventory_movements')` for the audit trail.

### 4.4 RLS policies

| Table                 | SELECT        | INSERT | UPDATE | DELETE                                |
| --------------------- | ------------- | ------ | ------ | ------------------------------------- |
| `material_categories` | authenticated | admin  | admin  | (none — soft delete via `deleted_at`) |
| `materials`           | authenticated | admin  | admin  | (none — soft delete via `deleted_at`) |
| `inventory_movements` | authenticated | admin  | (none) | (none)                                |

Per SPEC §6.1: `ventas` role is read-only on inventory. Per CLAUDE.md soft-delete principle: no hard DELETE policies on business tables. The trigger function runs as `security definer`, so it can update `materials.current_stock` even though `ventas` cannot UPDATE `materials` directly — but `ventas` cannot INSERT into `inventory_movements` in the first place, so the trigger only fires for admin-initiated movements.

### 4.5 Migration shape

Single migration `YYYYMMDDHHMMSS_materials.sql` for M5-1 + M5-2 (the two schema tickets land together — splitting them creates a migration with no consumers and risks RLS-baseline assertion drift). End with `select public.assert_all_tables_have_rls();`.

Run `npm run db:types` immediately after `supabase db push` and commit `src/types/database.ts` in the same PR.

---

## 5. Refined ticket carve

Numbering matches `docs/linear-phase-1.md` M5-1..M5-5 where possible. Acceptance criteria are refined where the original draft glossed over the operator model. One ticket added (M5-6) to represent the explicit "link salida to work order" UI, which the original M5-3 conflated with a planning step we are not building.

| ID                    | Title                                               | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M5-1**              | `material_categories` + `materials` schema + RLS    | Tables per §4.1, §4.2. Six categories seeded. RLS per §4.4. Triggers attached: `set_updated_at`, `stamp_actor_columns`, `audit.attach`. Migration ends with `assert_all_tables_have_rls()`.                                                                                                                                                                                                                                                                                                                                |
| **M5-2**              | `inventory_movements` schema + stock-update trigger | Table per §4.3 in the same migration as M5-1. RLS: SELECT authenticated, INSERT admin, no UPDATE/DELETE policies. AFTER INSERT trigger updates `materials.current_stock`. `audit.attach`. Reserved `purchase_order_id` column with no FK.                                                                                                                                                                                                                                                                                  |
| **M5-3**              | Materials CRUD UI (admin) + `ventas` read-only view | Mirrors catalog UI patterns (`src/features/catalog/`). List with filter by category, search by name, toggle active, soft-delete. Form: name, description, category, unit, `current_stock` (set on create only — subsequent changes must go through movements), `min_threshold`, location. `ventas` role sees a read-only list — no create/edit/delete buttons.                                                                                                                                                             |
| **M5-4**              | Manual adjustment UI (admin only)                   | "Ajustar existencia" dialog accessible from material detail. Fields: tipo (`entrada`, `salida_manual`, `ajuste`), cantidad (positive number; sign applied by tipo before insert), reason (required for `salida_manual` and `ajuste`). Writes one `inventory_movements` row. Trigger updates `current_stock`.                                                                                                                                                                                                               |
| **M5-5**              | Low-stock view + nav badge                          | Realtime subscription pattern from LIT-103. Badge in nav: count of `materials where current_stock <= min_threshold and is_active and deleted_at is null` (uses partial index from §4.2). Dedicated filtered view of the same set, with red row highlight per SPEC §4.6.                                                                                                                                                                                                                                                    |
| **M5-6**              | Link salida to work order                           | "Registrar salida por orden" dialog accessible from (a) inventory module material detail, (b) work order detail "Materiales consumidos" tab. Fields: material (preselected if entered from material detail), cantidad, work_order folio (preselected if entered from order detail; otherwise typeahead over non-cancelled `work_orders`), optional reason. Writes one `inventory_movements` row of type `salida_por_orden`. Stock can go negative — show inline warning "Esta salida deja el stock en X" but do not block. |
| **LIT-98** (existing) | "Sin stock" warning in POS                          | Depends on M5-1 so the POS can join `catalog_items` to `materials.current_stock` _if_ a future BOM bridge exists. In MVP this ticket renders only as: "if the line description matches a material name (case-insensitive substring), show its `current_stock` inline." Soft hint, no blocking. Keep as-is — the existing scope is fine.                                                                                                                                                                                    |

**Implementation order**: M5-1 → M5-2 → M5-3 → M5-4 → M5-5 → M5-6 (→ LIT-98 last).

M5-3 (CRUD) ships first after schema so Dana can populate the inventory by migrating from her Excel; without data, M5-5 (low-stock view) and M5-6 (link to order) have nothing to render.

> **Note**: this re-orders one ticket and adds one (M5-6) relative to `docs/linear-phase-1.md`. Update that file in the same PR as M5-1 lands so the public roadmap reflects the carve.

---

## 6. Open client questions

Two items to confirm with Rolando and Dana before M5-1 lands. Neither blocks starting the migration; the answers can be back-patched cheaply.

1. **Material categories.** Are the six from SPEC §4.6 (Lonas, Vinil, Tintas, Sustratos, Papel, Estructura) the right grouping, or does Dana use a different one in her current Excel? If she has the Excel, copy the categories from there. Recommended approach: ship M5-1 with the six defaults, and Dana edits/adds via M5-3 once the CRUD lands. Categories are not load-bearing — the badge and low-stock view don't depend on them.
2. **Single unit per material.** Confirm that "you buy a rollo of 50 m and consume in m" is _not_ a problem the system needs to model in Phase 1 — i.e., either (a) Prosesa converts mentally, or (b) materials are tracked in the unit they're consumed (m, not rollos). If the client pushes back and wants both units, escalate before M5-1 lands: it changes the schema (add `purchase_unit`, `consumption_unit`, `conversion_factor` to `materials`).

---

## 7. Forward path to BOM (informational)

Recording where M5 deliberately stops so the next quote is easy to draft.

When BOM ships post-MVP, it adds:

- A `bom_recipes` table linking `catalog_items.id → materials.id` with expected quantity per unit of catalog item.
- A "materiales necesarios" panel on the work order that joins through `bom_recipes` over the order's nota lines.
- Optional pre-flight check at quote/order creation: "esta cotización requiere X, tienes Y, falta Z."
- Optional "reservar stock para esta orden" workflow that, if built, introduces a `work_order_material_reservations` table (the structure we explicitly skip in MVP).

None of these require migrating M5 data. Materials, movements, and the operator UX stay as designed; BOM is purely additive.
