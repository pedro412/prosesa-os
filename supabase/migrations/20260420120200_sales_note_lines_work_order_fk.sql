-- Per-line work-order link for LIT-38 / M4-3.
--
-- Extends sales_note_lines with the per-line toggle that routes a
-- line either directly onto the nota (counter item) or to a work
-- order (production item). Adds `entregado` to track line-level
-- delivery status.
--
-- Design notes:
--   * work_order_id is nullable; null → counter line, not null →
--     order-attached. ON DELETE SET NULL: if a work order were ever
--     force-deleted (shouldn't happen under soft-cancel), the line
--     degrades to a counter-style line on the same nota.
--   * entregado is bool default false. Per M4 pre-planning:
--       - Counter lines should auto-true on sale commit.
--       - Order lines flip true when the parent work_order reaches
--         stage 'entregado'. Manual per-line override is allowed
--         for partial deliveries within an order.
--     The auto-flip trigger is OUT OF SCOPE here — shipped in the
--     separate per-line entregado ticket. This migration only adds
--     the column + default; writes are whatever the caller supplies.
--   * sales_note_lines_enforce_work_order_parent() is a DB-level
--     belt against a client attaching a line to a work order that
--     belongs to a different nota. FKs alone can't express this
--     cross-table parent match.

alter table public.sales_note_lines
  add column work_order_id uuid references public.work_orders (id) on delete set null,
  add column entregado boolean not null default false;

-- "Which lines belong to this order?" — the hot path for work-order
-- detail views (M4-7).
create index sales_note_lines_work_order_idx
  on public.sales_note_lines (work_order_id)
  where work_order_id is not null;

-- ============================================================================
-- Trigger: enforce work_order.sales_note_id matches line.sales_note_id
-- ============================================================================
-- A line attached to a work order must share the work order's
-- parent nota. Postgres FKs can't express this cross-table constraint;
-- this trigger closes the gap so a buggy RPC or hand-crafted SQL
-- can't create a line that silently belongs to someone else's nota.
create or replace function public.sales_note_lines_enforce_work_order_parent()
returns trigger
language plpgsql
as $$
begin
  if new.work_order_id is not null then
    if not exists (
      select 1
      from public.work_orders wo
      where wo.id = new.work_order_id
        and wo.sales_note_id = new.sales_note_id
    ) then
      raise exception
        'sales_note_lines.work_order_id must reference a work_order with matching sales_note_id (line sales_note_id=%, work_order_id=%)',
        new.sales_note_id, new.work_order_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger sales_note_lines_enforce_work_order_parent
before insert or update on public.sales_note_lines
for each row
execute function public.sales_note_lines_enforce_work_order_parent();

select public.assert_all_tables_have_rls();
