-- LIT-89: add the two fiscal fields that a complete CFDI 4.0 pre-invoice
-- dataset needs but the customer schema didn't capture.
--
--   * direccion_fiscal — free-form fiscal address (calle, número,
--     colonia, municipio). Kept as text, not decomposed into
--     street/colonia/etc. — Dana needs to copy-paste one block into
--     Contpaqi, so preserving her original formatting is more
--     useful than a normalized multi-field shape.
--
--   * uso_cfdi — SAT catalog code (G01, G03, P01, ...). Stored as
--     free text; validation lives at the form level. A CHECK against
--     the SAT list is tempting but brittle — the catalog gets quiet
--     revisions every couple of years, and a typo on a rare code
--     shouldn't block a sale.
--
-- Both columns are nullable. Existing customers may not have this
-- info (walk-ins captured with phone-only); completeness is a
-- read-time concept surfaced by `customerFiscalStatus(customer)`, not
-- a write-time constraint.
--
-- No data backfill — historical rows stay null until someone edits
-- them through `/clientes` or the new inline edit from POS.

alter table public.customers
  add column direccion_fiscal text,
  add column uso_cfdi text;

select public.assert_all_tables_have_rls();
