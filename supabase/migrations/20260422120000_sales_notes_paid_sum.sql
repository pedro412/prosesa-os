-- LIT-41 / M4-6 — Denormalize paid_sum + saldo_pendiente on sales_notes.
--
-- The work-order list needs to render saldo per row without joining +
-- aggregating payments for every entry. Same for future reports (Dana's
-- invoicing workbench, overdue dashboards). Computing it server-side
-- via a join would cost N+1 on every list, so we denormalize:
--
--   * paid_sum           numeric(12,2) default 0 — maintained by the
--                        existing payments trigger.
--   * saldo_pendiente    numeric(12,2) GENERATED ALWAYS AS (total -
--                        paid_sum) STORED — Postgres recomputes on any
--                        write that changes total or paid_sum.
--
-- The trigger stays the sole writer of paid_sum; it runs SECURITY
-- DEFINER so it bypasses the admin-only UPDATE policy on sales_notes.
-- Extended here to maintain both status and paid_sum in a single UPDATE
-- (one write per mutation, no extra round trip).
--
-- Backfill: existing rows get paid_sum computed from their payments,
-- then saldo_pendiente follows automatically.

alter table public.sales_notes
  add column paid_sum numeric(12, 2) not null default 0;

update public.sales_notes s
set paid_sum = coalesce(p.sum_amount, 0)
from (
  select sales_note_id, sum(amount) as sum_amount
  from public.payments
  group by sales_note_id
) p
where p.sales_note_id = s.id;

alter table public.sales_notes
  add column saldo_pendiente numeric(12, 2)
    generated always as (total - paid_sum) stored;

-- Supports overdue / saldo-aware queries without extra joins.
create index sales_notes_saldo_pendiente_idx
  on public.sales_notes (saldo_pendiente)
  where saldo_pendiente > 0 and status <> 'cancelada';

-- ============================================================================
-- Extend the existing recompute trigger to maintain paid_sum alongside status
-- ============================================================================
create or replace function public.payments_recompute_note_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(new.sales_note_id, old.sales_note_id);
  note_total numeric(12, 2);
  note_status text;
  -- Prefix locals so unqualified identifiers in WHERE clauses can't
  -- accidentally resolve to the variable instead of the column
  -- (PL/pgSQL variable shadowing).
  v_paid_sum numeric(12, 2);
  v_next_status text;
begin
  select s.total, s.status
    into note_total, note_status
  from public.sales_notes s
  where s.id = target_id;

  if note_status is null then
    -- Parent disappeared mid-flight (FK is RESTRICT, so this shouldn't
    -- happen — defensive no-op).
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
    into v_paid_sum
  from public.payments
  where sales_note_id = target_id;

  if note_status = 'cancelada' then
    -- A cancelled nota's paid_sum is still real (refund tracking lives
    -- on `payments` with negative amounts per CLAUDE.md §8), so we
    -- keep maintaining it even after cancellation. Status itself is
    -- frozen.
    update public.sales_notes
       set paid_sum = v_paid_sum
     where id = target_id
       and paid_sum is distinct from v_paid_sum;

    return coalesce(new, old);
  end if;

  if v_paid_sum = 0 then
    v_next_status := 'pendiente';
  elsif v_paid_sum < note_total then
    v_next_status := 'abonada';
  else
    v_next_status := 'pagada';
  end if;

  update public.sales_notes
     set status = v_next_status,
         paid_sum = v_paid_sum
   where id = target_id
     and (status is distinct from v_next_status
          or paid_sum is distinct from v_paid_sum);

  return coalesce(new, old);
end;
$$;

select public.assert_all_tables_have_rls();
