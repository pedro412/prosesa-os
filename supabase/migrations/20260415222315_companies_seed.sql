-- Seed the two razones sociales for LIT-21.
--
-- Both rows need to exist on day one so the company selector has
-- something to pick and so M2-4 can hang folio sequences off the
-- short code. Real fiscal data (razón social, régimen fiscal,
-- address, etc.) is still pending confirmation with Dana — seeded
-- values are placeholders and the admin settings page (shipped in
-- this same ticket) is how they get corrected before go-live.
--
-- Schema changes:
--   * Adds companies.code — 1–4 uppercase chars used as a folio prefix
--     (e.g., A-0001, B-0001). Unique among live rows.
--
-- Idempotency note: migrations run once, so we don't need ON CONFLICT
-- here. The unique index on code would catch a double-insert anyway.

alter table public.companies
  add column code text not null;

alter table public.companies
  add constraint companies_code_check check (code ~ '^[A-Z]{1,4}$');

create unique index companies_code_unique
  on public.companies (code)
  where deleted_at is null;

-- Placeholder seed. Fake-but-well-formed RFCs (3 letters + YYMMDD + 3
-- alphanumerics = SAT "moral" format). razón social mirrors the nombre
-- comercial for now; Dana will correct both via the admin settings UI.
insert into public.companies (
  code, nombre_comercial, razon_social, rfc,
  iva_rate, iva_inclusive, is_active
)
values
  ('A', 'Prosesa', 'Prosesa', 'PRO850101AB1', 0.16, true, true),
  ('B', 'Publicidad e Imagen', 'Publicidad e Imagen', 'PEI850101CD2', 0.16, true, true);

select public.assert_all_tables_have_rls();
