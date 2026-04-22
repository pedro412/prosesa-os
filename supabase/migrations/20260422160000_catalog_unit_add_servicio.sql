-- LIT-110: extend catalog_items.unit enum with 'servicio'.
--
-- Gustavo asked for "Servicio" as a unit option alongside pieza / m2 /
-- etc. for flat-priced services that don't fit the time-based `hora`
-- unit (e.g., "instalación de lona en camioneta" isn't naturally
-- priced per hour).
--
-- Only `catalog_items` enforces the unit enum at the DB level;
-- `sales_note_lines.unit` is plain text with no CHECK, so free-form
-- lines with unit='servicio' (typed client-side via CatalogUnit) flow
-- through unchanged. The CHECK is a superset — existing rows remain
-- valid during the swap.

alter table catalog_items
  drop constraint catalog_items_unit_check;

alter table catalog_items
  add constraint catalog_items_unit_check
  check (unit in ('pieza', 'm2', 'm', 'litro', 'rollo', 'hora', 'servicio'));
