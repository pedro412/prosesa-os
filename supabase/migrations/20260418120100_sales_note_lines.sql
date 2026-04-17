-- Sales note line items for LIT-29 / M3-2.
--
-- Line items on a sales note. A line may be catalog-linked (the
-- operator picked an item from the POS search) or free-form (the
-- operator typed a concept directly — SPEC §4.3 allows both).
--
-- Design notes:
--   * `concept`, `unit`, `quantity`, `unit_price` are captured on the
--     line so the historical render survives catalog edits: if an
--     admin renames the catalog item or changes its price next week,
--     the printed note still shows what the customer saw.
--   * `dimensions` and `material` are free text, nullable. Relevant
--     for print/signage work. They're not structured because R-1
--     (work-order line-item shape) is still open; when that lands we
--     can migrate known shapes into structured columns without
--     rewriting historical rows.
--   * `line_total` is computed in the app and stored (ticket spec).
--     A BEFORE trigger recomputes the expected value and raises if
--     the stored number diverges by more than 0.01 — that's the
--     DB-side assertion the ticket asks for, with tolerance for
--     numeric rounding.
--   * No `created_by` / `updated_by` here. Lines belong to a parent
--     sales_note's lifecycle; actor attribution lives on the header.
--   * No audit trigger. CLAUDE.md §7 lists the tables that get
--     audited (`sales_notes`, `work_orders`, `work_order_status_log`,
--     `inventory_movements`, `pos_sales`). Lines aren't in that list;
--     their mutation signal is implicit in the parent's audit row.
--   * RLS has no literal policy inheritance in Postgres — emulate via
--     EXISTS against the parent. Lines on a cancelled note are
--     immutable for non-admins (matches the "cancellation freezes
--     the document" rule).

create table public.sales_note_lines (
  id uuid primary key default gen_random_uuid(),
  sales_note_id uuid not null references public.sales_notes (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  concept text not null,
  dimensions text,
  material text,
  unit text not null,
  quantity numeric(12, 3) not null,
  unit_price numeric(12, 2) not null,
  discount_type text not null default 'none',
  discount_value numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_note_lines_concept_not_blank
    check (length(trim(concept)) > 0),
  constraint sales_note_lines_discount_type_check
    check (discount_type in ('none', 'percent', 'fixed')),
  constraint sales_note_lines_discount_percent_cap
    check (discount_type <> 'percent' or discount_value <= 100),
  constraint sales_note_lines_amounts_non_negative
    check (
      quantity > 0
      and unit_price >= 0
      and discount_value >= 0
      and line_total >= 0
    )
);

-- Ordered retrieval of lines within a note (POS ticket + detail view).
create index sales_note_lines_parent_sort_idx
  on public.sales_note_lines (sales_note_id, sort_order, id);

-- ============================================================================
-- Triggers: updated_at + line_total assertion
-- ============================================================================
create trigger sales_note_lines_set_updated_at
before update on public.sales_note_lines
for each row
execute function public.set_updated_at();

-- Verifies the stored line_total matches quantity * unit_price minus
-- the discount. Tolerance of 0.01 absorbs rounding divergence between
-- the JS / Postgres decimal implementations without letting wildly
-- wrong numbers slip through. Uses round(..., 2) to match the column
-- scale.
--
-- The computation happens BEFORE INSERT OR UPDATE so a bad value
-- raises at write time, not at read time.
create or replace function public.sales_note_lines_assert_line_total()
returns trigger
language plpgsql
as $$
declare
  gross numeric(14, 4);
  discount numeric(14, 4);
  expected numeric(12, 2);
begin
  gross := new.quantity * new.unit_price;
  if new.discount_type = 'percent' then
    discount := gross * (new.discount_value / 100);
  elsif new.discount_type = 'fixed' then
    discount := new.discount_value;
  else
    discount := 0;
  end if;

  expected := round(greatest(gross - discount, 0)::numeric, 2);

  if abs(expected - new.line_total) > 0.01 then
    raise exception
      'sales_note_lines.line_total mismatch: stored=% expected=% (qty=%, unit_price=%, discount_type=%, discount_value=%)',
      new.line_total, expected, new.quantity, new.unit_price, new.discount_type, new.discount_value
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger sales_note_lines_assert_line_total
before insert or update on public.sales_note_lines
for each row
execute function public.sales_note_lines_assert_line_total();

-- ============================================================================
-- RLS (inherits visibility from parent sales_note)
-- ============================================================================
alter table public.sales_note_lines enable row level security;

-- SELECT: visible whenever the parent note is visible. sales_notes
-- itself is SELECT-open to all authenticated, so effectively every
-- authenticated user sees every line.
create policy sales_note_lines_select_auth on public.sales_note_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
  )
);

-- INSERT: any authenticated user creating lines on a non-cancelled
-- parent (POS flow writes all lines alongside the header). Admins can
-- still add lines to a cancelled note if they ever need to, but ventas
-- cannot.
create policy sales_note_lines_insert_auth on public.sales_note_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
);

-- UPDATE / DELETE: same gate as insert. Lines on a cancelled note are
-- frozen for non-admins.
create policy sales_note_lines_update_auth on public.sales_note_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
);

create policy sales_note_lines_delete_auth on public.sales_note_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.sales_notes s
    where s.id = sales_note_id
      and (s.status <> 'cancelada' or public.is_admin())
  )
);

select public.assert_all_tables_have_rls();
