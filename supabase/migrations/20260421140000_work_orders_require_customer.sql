-- LIT-37 follow-up — work orders must have a customer attached.
--
-- Operational pain from Dana/Karina: a nota with an attached work
-- order committed without a customer means the shop has no phone to
-- call when the production timing changes. Counter sales stay
-- customer-optional (walk-in XAXX fallback on printed docs) but as
-- soon as production work is involved, a callable contact is required.
--
-- customers.telefono is already NOT NULL (20260417221500_customers_
-- telefono_required), so requiring a non-null customer_id on
-- work_orders is sufficient — any attached customer has a phone.
--
-- The FK previously used `ON DELETE SET NULL` to gracefully degrade
-- orphaned orders. With the NOT NULL constraint that behavior would
-- error out at delete time; we swap to `ON DELETE RESTRICT` so the
-- admin UI is forced to surface the linkage explicitly (matches the
-- sales_note_id FK behavior).
--
-- Data cleanup policy:
--   1. Backfill customer_id from the parent nota (happy path).
--   2. For rows where neither the order NOR the parent nota has a
--      customer, DELETE the row. Rationale: these are pre-POS-writer
--      hand-seeded test rows (work_orders landed in LIT-38 less than
--      a day ago and the POS write path ships in this very PR), they
--      are fundamentally incompatible with the new invariant (no
--      customer anywhere to attach), and leaving them blocks the
--      migration. A RAISE NOTICE surfaces the count so the operator
--      sees what was cleaned — not a silent deletion.
--
--   This DELETE is an explicit, narrow-scoped exception to
--   CLAUDE.md §4 rule 11 (never hard-delete business records): the
--   affected rows cannot be business records yet because no code
--   path creates them. Before promoting this migration to prod,
--   re-verify the count is zero on prod (it should be — prod hasn't
--   had work_orders at all).

do $$
declare
  v_backfill_count int;
  v_delete_count int;
begin
  update public.work_orders wo
  set customer_id = sn.customer_id
  from public.sales_notes sn
  where wo.sales_note_id = sn.id
    and wo.customer_id is null
    and sn.customer_id is not null;
  get diagnostics v_backfill_count = row_count;

  if v_backfill_count > 0 then
    raise notice 'LIT-37: backfilled customer_id on % work_orders rows from parent nota', v_backfill_count;
  end if;

  delete from public.work_orders
  where customer_id is null;
  get diagnostics v_delete_count = row_count;

  if v_delete_count > 0 then
    raise notice 'LIT-37: deleted % orphan work_orders rows with no resolvable customer (test-only seed data, pre-POS writer)', v_delete_count;
  end if;
end;
$$;

alter table public.work_orders
  drop constraint if exists work_orders_customer_id_fkey;

alter table public.work_orders
  alter column customer_id set not null,
  add constraint work_orders_customer_id_fkey
    foreign key (customer_id) references public.customers (id)
    on delete restrict;

select public.assert_all_tables_have_rls();
