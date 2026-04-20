-- M3 cleanup for LIT-38 / M4-3.
--
-- The `sales_notes.work_order_id` column was added in LIT-28 as a
-- hook for the original 0..1 cardinality (one work order per sales
-- note). Per the 2026-04-20 M4 pre-planning decisions, cardinality
-- is now 1 nota → 0..N work orders with the line → order link
-- moved to `sales_note_lines.work_order_id`. This column is
-- therefore obsolete and never populated in staging.
--
-- Separated from the `work_orders` creation migration so the
-- cleanup is visible on its own line in history — if we ever need
-- to reintroduce a header-level hook it's a distinct revert.

alter table public.sales_notes
  drop column work_order_id;
