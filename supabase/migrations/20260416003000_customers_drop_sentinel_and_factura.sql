-- Undo two wrong-placement bugs from LIT-24 / LIT-25 (tracked as
-- LIT-67). Both treated per-document concerns as customer attributes:
--
-- 1. The "Público en general" sentinel row + its protection trigger
--    and is_publico_general flag. In Mexico, when a customer doesn't
--    provide an RFC, the PRINTED sales note / quotation / work order
--    uses the SAT generic XAXX010101000 as a document-level fallback.
--    The customers registry doesn't need a synthetic row for this;
--    M3-1 and M4-3 will COALESCE(customer.rfc, 'XAXX010101000') at
--    render time.
--
-- 2. customers.requiere_factura. Whether a factura is issued is a
--    per-transaction decision (same customer can want one on order #1
--    and skip it on order #2). The column moves to sales_notes /
--    work_orders / quotations when those tables land.
--
-- This migration is purely subtractive — no new columns, no data
-- migration needed beyond deleting the one synthetic sentinel row.

-- Step 1: drop the protection trigger so we can delete the sentinel.
drop trigger if exists customers_prevent_sentinel_mutation on public.customers;

-- Step 2: hard-delete the sentinel. Intentional deviation from the
-- soft-delete convention (CLAUDE.md §4 rule 11) — the row is
-- synthetic, not archivable data.
delete from public.customers where is_publico_general = true;

-- Step 3: drop the now-unused protection function.
drop function if exists public.prevent_customer_sentinel_mutation();

-- Step 4: drop the column. The partial unique index
-- customers_publico_general_unique is dropped implicitly with the
-- column it was built on.
alter table public.customers drop column is_publico_general;

-- Step 5: requiere_factura moves to the document tables (M3-1 /
-- M4-3). Dropping the column here prevents future client code from
-- relying on a customer-level flag.
alter table public.customers drop column requiere_factura;

select public.assert_all_tables_have_rls();
