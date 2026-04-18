-- Extends `create_sales_note` to accept an optional `payments` array
-- in the jsonb payload (LIT-33 / M3-6). The counter POS needs to
-- capture the note + its payments in one transaction — two round
-- trips would leave a window where the note is `pendiente` but the
-- cashier already rang up a mixto split.
--
-- Shape added to the payload:
--   payments: [
--     { method: 'efectivo' | 'transferencia' | 'tarjeta',
--       card_type: 'credito' | 'debito' | null,
--       amount: number }
--   ]
--
-- Rules enforced here (belt for the DB-level CHECKs):
--   * amount > 0
--   * method ∈ ('efectivo','transferencia','tarjeta')
--   * card_type required iff method='tarjeta' (mirrors
--     payments_card_type_check from 20260418140000)
--   * if any payments are supplied, sum(amount) must cover total.
--     Over-payment is allowed (operator may capture tendered cash on
--     a single efectivo row; the recompute trigger still lands
--     status='pagada'). Zero payments stays legal so the LIT-31
--     create-without-payments path continues to work.
--
-- The existing triggers handle the rest:
--   * payments_stamp_created_by → fills created_by = auth.uid()
--   * payments_recompute_note_status → flips sales_notes.status to
--     'pagada' after the last row insert
--
-- Signature and return shape are unchanged (`returns table(id, folio)`).

create or replace function public.create_sales_note(payload jsonb)
returns table (id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_company_id uuid;
  v_customer_id uuid;
  v_notes text;
  v_requires_invoice boolean;
  v_iva_rate numeric(5, 4);
  v_iva_inclusive boolean;
  v_lines jsonb;
  v_payments jsonb;
  v_payment_elem jsonb;
  v_payment_index int;
  v_payment_method text;
  v_payment_card_type text;
  v_payment_amount numeric(12, 2);
  v_paid_sum numeric(14, 4) := 0;
  v_sum_line_total numeric(14, 4);
  v_subtotal numeric(12, 2);
  v_iva numeric(12, 2);
  v_total numeric(12, 2);
  v_note_id uuid;
  v_folio text;
begin
  if v_caller is null then
    raise exception 'create_sales_note: not authenticated'
      using errcode = '28000';
  end if;

  v_company_id := (payload ->> 'company_id')::uuid;
  v_customer_id := nullif(payload ->> 'customer_id', '')::uuid;
  v_notes := nullif(payload ->> 'notes', '');
  v_requires_invoice := coalesce((payload ->> 'requires_invoice')::boolean, false);
  v_lines := payload -> 'lines';
  v_payments := coalesce(payload -> 'payments', '[]'::jsonb);

  if v_company_id is null then
    raise exception 'create_sales_note: company_id is required'
      using errcode = '22023';
  end if;

  if v_lines is null or jsonb_typeof(v_lines) <> 'array' then
    raise exception 'create_sales_note: lines must be an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'create_sales_note: at least one line is required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_payments) <> 'array' then
    raise exception 'create_sales_note: payments must be an array'
      using errcode = '22023';
  end if;

  select c.iva_rate, c.iva_inclusive
    into v_iva_rate, v_iva_inclusive
  from public.companies c
  where c.id = v_company_id
    and c.deleted_at is null
    and c.is_active;

  if v_iva_rate is null then
    raise exception 'create_sales_note: unknown or inactive company %', v_company_id
      using errcode = '23503';
  end if;

  select coalesce(
    sum(
      public._sales_note_line_total(
        (elem ->> 'quantity')::numeric,
        (elem ->> 'unit_price')::numeric,
        coalesce(elem ->> 'discount_type', 'none'),
        coalesce((elem ->> 'discount_value')::numeric, 0)
      )
    ),
    0
  )
  into v_sum_line_total
  from jsonb_array_elements(v_lines) as elem;

  if v_iva_inclusive then
    v_total := round(v_sum_line_total, 2);
    v_subtotal := round(v_total / (1 + v_iva_rate), 2);
    v_iva := v_total - v_subtotal;
  else
    v_subtotal := round(v_sum_line_total, 2);
    v_iva := round(v_subtotal * v_iva_rate, 2);
    v_total := v_subtotal + v_iva;
  end if;

  -- Per-row payment validation. Loops with ordinality so error
  -- messages can cite the offending index for a clear client error.
  v_payment_index := 0;
  for v_payment_elem in select elem from jsonb_array_elements(v_payments) as elem loop
    v_payment_method := v_payment_elem ->> 'method';
    v_payment_card_type := nullif(v_payment_elem ->> 'card_type', '');
    v_payment_amount := (v_payment_elem ->> 'amount')::numeric(12, 2);

    if v_payment_method is null
       or v_payment_method not in ('efectivo', 'transferencia', 'tarjeta') then
      raise exception 'create_sales_note: invalid payment method at index %', v_payment_index
        using errcode = '22023';
    end if;

    if v_payment_amount is null or v_payment_amount <= 0 then
      raise exception 'create_sales_note: payment amount must be > 0 at index %', v_payment_index
        using errcode = '22023';
    end if;

    if v_payment_method = 'tarjeta' then
      if v_payment_card_type is null
         or v_payment_card_type not in ('credito', 'debito') then
        raise exception 'create_sales_note: card_type (credito|debito) required for tarjeta at index %', v_payment_index
          using errcode = '22023';
      end if;
    else
      if v_payment_card_type is not null then
        raise exception 'create_sales_note: card_type must be null for non-tarjeta payment at index %', v_payment_index
          using errcode = '22023';
      end if;
    end if;

    v_paid_sum := v_paid_sum + v_payment_amount;
    v_payment_index := v_payment_index + 1;
  end loop;

  if v_paid_sum > 0 and v_paid_sum < v_total then
    raise exception 'create_sales_note: payments (%) do not cover total (%)', v_paid_sum, v_total
      using errcode = '22023';
  end if;

  insert into public.sales_notes (
    company_id, customer_id, status,
    subtotal, iva, total,
    iva_rate_snapshot, iva_inclusive_snapshot,
    requires_invoice, notes
  )
  values (
    v_company_id, v_customer_id, 'pendiente',
    v_subtotal, v_iva, v_total,
    v_iva_rate, v_iva_inclusive,
    v_requires_invoice, v_notes
  )
  returning sales_notes.id, sales_notes.folio into v_note_id, v_folio;

  insert into public.sales_note_lines (
    sales_note_id, catalog_item_id, concept, dimensions, material,
    unit, quantity, unit_price, discount_type, discount_value,
    line_total, sort_order
  )
  select
    v_note_id,
    nullif(elem ->> 'catalog_item_id', '')::uuid,
    elem ->> 'concept',
    nullif(elem ->> 'dimensions', ''),
    nullif(elem ->> 'material', ''),
    elem ->> 'unit',
    (elem ->> 'quantity')::numeric(12, 3),
    (elem ->> 'unit_price')::numeric(12, 2),
    coalesce(elem ->> 'discount_type', 'none'),
    coalesce((elem ->> 'discount_value')::numeric(12, 2), 0),
    public._sales_note_line_total(
      (elem ->> 'quantity')::numeric,
      (elem ->> 'unit_price')::numeric,
      coalesce(elem ->> 'discount_type', 'none'),
      coalesce((elem ->> 'discount_value')::numeric, 0)
    ),
    (ord - 1)::int
  from jsonb_array_elements(v_lines) with ordinality as e(elem, ord);

  if jsonb_array_length(v_payments) > 0 then
    insert into public.payments (sales_note_id, method, card_type, amount)
    select
      v_note_id,
      elem ->> 'method',
      nullif(elem ->> 'card_type', ''),
      (elem ->> 'amount')::numeric(12, 2)
    from jsonb_array_elements(v_payments) as elem;
  end if;

  id := v_note_id;
  folio := v_folio;
  return next;
end;
$$;

revoke all on function public.create_sales_note(jsonb) from public;
grant execute on function public.create_sales_note(jsonb) to authenticated;

select public.assert_all_tables_have_rls();
