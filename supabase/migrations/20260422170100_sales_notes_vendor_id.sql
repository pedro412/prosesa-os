-- LIT-107: attach vendor_id to sales_notes.
--
-- Nullable FK. null means either "Gustavo closed the walk-in himself"
-- or "Gustavo forgot to attribute." Both are legitimate data states;
-- display as "Sin vendedor" in the UI.
--
-- ON DELETE SET NULL is the intentional semantic: if a vendor row is
-- ever deleted (which RLS forbids for non-admin; still belt-and-
-- suspenders), historical notas survive as "Sin vendedor" rather
-- than the whole nota cascading away. We prefer a vendorless nota to
-- a missing nota.

alter table public.sales_notes
  add column vendor_id uuid references public.vendors (id) on delete set null;

-- Filter-by-vendor on the sales-notes list is expected to be the
-- dominant query after launch. Partial index skips null-vendor rows
-- which aren't indexable usefully (filtering "Sin vendedor" scans
-- within the company/status window).
create index sales_notes_vendor_id_idx
  on public.sales_notes (vendor_id)
  where vendor_id is not null;
