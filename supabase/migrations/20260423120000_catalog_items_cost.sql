-- LIT-108: cost + cost_updated_at on catalog_items.
--
-- Today cost data lives on paper and in Gustavo's head. Surfacing it
-- in the system gives Dana one master-list and lets the POS nudge
-- against under-cost pricing for catalog-linked lines.
--
-- Nullable with default 0. An empty / zero cost is read as "no cost
-- data" (margin helper treats both as 'unknown') so Dana can backfill
-- as she touches items without a giant one-shot audit.
--
-- No snapshot on sales_note_lines yet — explicit Phase 1 deferral.
-- Historical notas pick up future cost changes; that's wrong for
-- formal accounting, right for a list-of-products MVP. Snapshot lands
-- when reporting does.

alter table public.catalog_items
  add column cost numeric(12, 2) null default 0,
  add column cost_updated_at timestamptz;

alter table public.catalog_items
  add constraint catalog_items_cost_non_negative
  check (cost is null or cost >= 0);

-- Stamps cost_updated_at only when cost actually changes. Keeps
-- routine non-cost edits (name, description, is_active toggle) from
-- polluting the freshness signal LIT-111 will use for the stale-cost
-- chip.
create or replace function public.catalog_items_stamp_cost_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.cost is distinct from old.cost then
    new.cost_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger catalog_items_cost_updated_at
before update of cost on public.catalog_items
for each row
execute function public.catalog_items_stamp_cost_updated_at();

select public.assert_all_tables_have_rls();
