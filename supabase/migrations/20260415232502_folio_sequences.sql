-- Per-company folio sequence infrastructure for LIT-23.
--
-- Folios are per-company, monotonic, and never reused — including
-- after cancellation (CLAUDE.md §4 rule 12, §6). This migration ships
-- the sequence table and the `next_folio(company_id, doc_type)`
-- function that M3/M4 callers will use when inserting sales_notes and
-- work_orders.
--
-- Design notes:
--   * Composite pk (company_id, doc_type). doc_type is free text
--     constrained to snake_case identifiers so a casing typo can't
--     accidentally fork a counter ("sales_note" vs "Sales_Note").
--   * No pre-seeding. `next_folio` uses INSERT ... ON CONFLICT DO
--     UPDATE RETURNING, which atomically handles both the first-call
--     case (insert at 1) and subsequent calls (row-lock + increment).
--     Equivalent concurrency safety to the FOR UPDATE pattern the
--     ticket suggested, without the manual transaction dance.
--   * RLS is on but there are no policies, and base privileges are
--     revoked from authenticated/service_role — clients MUST go
--     through next_folio(). The function is SECURITY DEFINER so it
--     writes as the migration owner.
--   * Not audited. folio_sequences is an internal counter, not a
--     business record, and audit.attach() requires a uuid `id` column.

create table public.folio_sequences (
  company_id uuid not null references public.companies (id) on delete restrict,
  doc_type text not null,
  current_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, doc_type),
  constraint folio_sequences_doc_type_check check (doc_type ~ '^[a-z_]{1,40}$'),
  constraint folio_sequences_current_value_check check (current_value >= 0)
);

create trigger folio_sequences_set_updated_at
before update on public.folio_sequences
for each row
execute function public.set_updated_at();

alter table public.folio_sequences enable row level security;

-- No policies by design. The function below is the only sanctioned
-- path. Revoke base privileges as belt-and-suspenders: even if a
-- future policy author adds something by accident, clients still
-- can't touch this table directly.
revoke all on public.folio_sequences from authenticated, service_role;

-- Mints the next folio for the given (company, doc_type). Returns a
-- string like 'A-0001'. Raises a foreign_key_violation if the
-- company is unknown or soft-deleted.
create or replace function public.next_folio(
  p_company_id uuid,
  p_doc_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_next bigint;
begin
  -- Resolve the code up front so callers get a precise error rather
  -- than a confusing "null in concatenation" result.
  select c.code
    into v_code
  from public.companies c
  where c.id = p_company_id
    and c.deleted_at is null;

  if v_code is null then
    raise exception 'next_folio: unknown or deleted company %', p_company_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Atomic increment. ON CONFLICT DO UPDATE acquires a row lock on
  -- the existing (company_id, doc_type) row, serializing concurrent
  -- callers for the same sequence. Each caller walks away with a
  -- distinct, monotonically increasing value.
  insert into public.folio_sequences (company_id, doc_type, current_value)
  values (p_company_id, p_doc_type, 1)
  on conflict (company_id, doc_type)
  do update set current_value = folio_sequences.current_value + 1
  returning current_value into v_next;

  -- FM0000 = minimum-four-digit padding, no cap. First 9999 folios
  -- render as A-0001 .. A-9999; overflow continues as A-10000 …
  return v_code || '-' || to_char(v_next, 'FM0000');
end
$$;

revoke all on function public.next_folio(uuid, text) from public;
grant execute on function public.next_folio(uuid, text) to authenticated;

select public.assert_all_tables_have_rls();
