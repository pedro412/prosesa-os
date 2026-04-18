-- Adds `card_type` to payments for LIT-33 / M3-6. Bookkeeping needs the
-- crédito vs débito split on corte de caja; the `method` axis stays
-- unchanged (it's what the recompute trigger and future reports group
-- by). A separate nullable column plus a CHECK invariant is cleaner
-- than widening `method` into `tarjeta_credito` / `tarjeta_debito` —
-- that would force every "pagos con tarjeta" query to coalesce two
-- values back together, and any future card metadata (brand, last 4)
-- would still need a sibling column.

alter table public.payments
  add column card_type text;

alter table public.payments
  add constraint payments_card_type_check
  check (
    (method = 'tarjeta' and card_type in ('credito', 'debito'))
    or (method <> 'tarjeta' and card_type is null)
  );

comment on column public.payments.card_type is
  'Only set when method=tarjeta; one of credito|debito. Used by corte de caja.';

select public.assert_all_tables_have_rls();
