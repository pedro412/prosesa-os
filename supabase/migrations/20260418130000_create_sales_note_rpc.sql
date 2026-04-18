-- Atomic `create_sales_note` RPC for LIT-31 (POS counter mode).
--
-- The POS form needs to insert one `sales_notes` header row plus N
-- `sales_note_lines` in a single transaction. PostgREST doesn't support
-- nested inserts, and two round trips would leave an orphan header if
-- the second fails. This function exposes one call that:
--
--   1. Validates payload shape.
--   2. Snapshots `companies.iva_rate` / `iva_inclusive` server-side —
--      single source of truth for the note's snapshot columns, so a
--      buggy client can't drift them.
--   3. Computes subtotal / iva / total from the lines using Postgres
--      numeric arithmetic. Exact decimals, matches what the BEFORE
--      trigger on `sales_note_lines` asserts at insert time (the ±0.01
--      tolerance becomes moot).
--   4. Inserts the header (folio trigger + stamp_actor both fire).
--   5. Inserts the lines with sort_order matching input order.
--   6. Returns the created `(id, folio)` so the client can toast /
--      navigate.
--
-- Security model:
--   * SECURITY DEFINER so the single transaction commits both tables
--     even if future RLS gets tighter on one side.
--   * Verifies `auth.uid() is not null` up front — bounces anonymous
--     callers with a clear 28000 error instead of a misleading FK
--     violation further down.
--   * `stamp_actor_columns()` trigger on `sales_notes` still stamps
--     `created_by = auth.uid()` — SECURITY DEFINER doesn't change
--     `auth.uid()` (verified with the existing `next_folio` pattern).
--   * `revoke all; grant execute to authenticated` — never callable by
--     anon or service_role from the client.
--
-- The companion helper `_sales_note_line_total()` factors out the
-- discount + clamp math so the RPC's line insert and the eventual
-- recompute use the exact same expression. The existing BEFORE trigger
-- from LIT-29 keeps its inline copy for now; swapping it to call this
-- helper is a tidy follow-up but not needed for correctness.

-- ============================================================================
-- Helper: deterministic line_total expression
-- ============================================================================
create or replace function public._sales_note_line_total(
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_type text,
  p_discount_value numeric
)
returns numeric
language sql
immutable
as $$
  -- Clamp at 0 so an over-large fixed discount doesn't produce a
  -- negative line_total — mirrors the `line_total >= 0` CHECK on
  -- sales_note_lines.
  select greatest(
    round(p_quantity * p_unit_price, 2)
      - case p_discount_type
          when 'percent' then round(round(p_quantity * p_unit_price, 2) * (p_discount_value / 100), 2)
          when 'fixed' then round(p_discount_value, 2)
          else 0
        end,
    0
  );
$$;

revoke all on function public._sales_note_line_total(numeric, numeric, text, numeric) from public;
-- Used by the RPC below. Not exposed to clients.

-- ============================================================================
-- RPC
-- ============================================================================
create or replace function public.create_sales_note(payload jsonb)
returns table (id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_company_id uuid;
  v_customer_id uuid;
  v_notes text;
  v_requires_invoice boolean;
  v_iva_rate numeric(5, 4);
  v_iva_inclusive boolean;
  v_lines jsonb;
  v_sum_line_total numeric(14, 4);
  v_subtotal numeric(12, 2);
  v_iva numeric(12, 2);
  v_total numeric(12, 2);
  v_note_id uuid;
  v_folio text;
begin
  if v_caller is null then
    raise exception 'create_sales_note: not authenticated'
      using errcode = '28000';
  end if;

  -- Extract + coerce payload fields. `nullif('','')::uuid` turns an
  -- empty-string customer_id into null (the web form sends '' when no
  -- customer is picked).
  v_company_id := (payload ->> 'company_id')::uuid;
  v_customer_id := nullif(payload ->> 'customer_id', '')::uuid;
  v_notes := nullif(payload ->> 'notes', '');
  v_requires_invoice := coalesce((payload ->> 'requires_invoice')::boolean, false);
  v_lines := payload -> 'lines';

  if v_company_id is null then
    raise exception 'create_sales_note: company_id is required'
      using errcode = '22023';
  end if;

  if v_lines is null or jsonb_typeof(v_lines) <> 'array' then
    raise exception 'create_sales_note: lines must be an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'create_sales_note: at least one line is required'
      using errcode = '22023';
  end if;

  -- Snapshot the active IVA config. Unknown / inactive / soft-deleted
  -- company: refuse with a foreign_key_violation so the UI can surface
  -- a stale-selection message.
  select c.iva_rate, c.iva_inclusive
    into v_iva_rate, v_iva_inclusive
  from public.companies c
  where c.id = v_company_id
    and c.deleted_at is null
    and c.is_active;

  if v_iva_rate is null then
    raise exception 'create_sales_note: unknown or inactive company %', v_company_id
      using errcode = '23503';
  end if;

  -- Sum of line totals, computed from the payload. Using the helper
  -- keeps the RPC's math identical to what the BEFORE trigger on
  -- sales_note_lines will recompute on each inserted row.
  select coalesce(
    sum(
      public._sales_note_line_total(
        (elem ->> 'quantity')::numeric,
        (elem ->> 'unit_price')::numeric,
        coalesce(elem ->> 'discount_type', 'none'),
        coalesce((elem ->> 'discount_value')::numeric, 0)
      )
    ),
    0
  )
  into v_sum_line_total
  from jsonb_array_elements(v_lines) as elem;

  -- Tax-inclusive: sum IS the total; back-calc subtotal and derive iva
  -- as (total - subtotal) to preserve the `subtotal + iva = total`
  -- identity on awkward totals (mirrors src/lib/tax.ts).
  -- Tax-exclusive: sum IS the subtotal; iva added on top.
  if v_iva_inclusive then
    v_total := round(v_sum_line_total, 2);
    v_subtotal := round(v_total / (1 + v_iva_rate), 2);
    v_iva := v_total - v_subtotal;
  else
    v_subtotal := round(v_sum_line_total, 2);
    v_iva := round(v_subtotal * v_iva_rate, 2);
    v_total := v_subtotal + v_iva;
  end if;

  -- Header. Folio is left null on purpose — sales_notes_assign_folio
  -- BEFORE trigger mints it. stamp_actor_columns sets created_by and
  -- updated_by from auth.uid() (preserved under SECURITY DEFINER).
  insert into public.sales_notes (
    company_id, customer_id, status,
    subtotal, iva, total,
    iva_rate_snapshot, iva_inclusive_snapshot,
    requires_invoice, notes
  )
  values (
    v_company_id, v_customer_id, 'pendiente',
    v_subtotal, v_iva, v_total,
    v_iva_rate, v_iva_inclusive,
    v_requires_invoice, v_notes
  )
  returning sales_notes.id, sales_notes.folio into v_note_id, v_folio;

  -- Lines. sort_order comes from the input order (ordinality).
  insert into public.sales_note_lines (
    sales_note_id, catalog_item_id, concept, dimensions, material,
    unit, quantity, unit_price, discount_type, discount_value,
    line_total, sort_order
  )
  select
    v_note_id,
    nullif(elem ->> 'catalog_item_id', '')::uuid,
    elem ->> 'concept',
    nullif(elem ->> 'dimensions', ''),
    nullif(elem ->> 'material', ''),
    elem ->> 'unit',
    (elem ->> 'quantity')::numeric(12, 3),
    (elem ->> 'unit_price')::numeric(12, 2),
    coalesce(elem ->> 'discount_type', 'none'),
    coalesce((elem ->> 'discount_value')::numeric(12, 2), 0),
    public._sales_note_line_total(
      (elem ->> 'quantity')::numeric,
      (elem ->> 'unit_price')::numeric,
      coalesce(elem ->> 'discount_type', 'none'),
      coalesce((elem ->> 'discount_value')::numeric, 0)
    ),
    (ord - 1)::int
  from jsonb_array_elements(v_lines) with ordinality as e(elem, ord);

  id := v_note_id;
  folio := v_folio;
  return next;
end;
$$;

revoke all on function public.create_sales_note(jsonb) from public;
grant execute on function public.create_sales_note(jsonb) to authenticated;

select public.assert_all_tables_have_rls();
