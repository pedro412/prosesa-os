-- LIT-37 follow-up — block create_sales_note payloads that declare
-- work_orders without a customer_id.
--
-- The schema change in the sibling migration makes this impossible to
-- store (NOT NULL on work_orders.customer_id), but we want a clearer
-- error than the raw NOT NULL violation so the POS can surface a
-- Spanish message instead of a generic DB error.

create or replace function public.create_sales_note(payload jsonb)
returns table (id uuid, folio text, work_orders jsonb)
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
  v_work_orders jsonb;
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
  v_wo_elem jsonb;
  v_wo_client_id text;
  v_wo_priority text;
  v_wo_promised_at timestamptz;
  v_wo_id uuid;
  v_wo_folio text;
  v_wo_declared_ids jsonb := '{}'::jsonb;
  v_wo_map jsonb := '{}'::jsonb;
  v_wo_result jsonb := '[]'::jsonb;
  v_orphan_client_id text;
  v_has_referenced_order boolean;
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
  v_work_orders := coalesce(payload -> 'work_orders', '[]'::jsonb);

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

  if jsonb_typeof(v_work_orders) <> 'array' then
    raise exception 'create_sales_note: work_orders must be an array'
      using errcode = '22023';
  end if;

  for v_wo_elem in select elem from jsonb_array_elements(v_work_orders) as elem loop
    v_wo_client_id := nullif(v_wo_elem ->> 'client_id', '');
    if v_wo_client_id is null then
      raise exception 'create_sales_note: work_orders[].client_id is required'
        using errcode = '22023';
    end if;

    if v_wo_declared_ids ? v_wo_client_id then
      raise exception 'create_sales_note: duplicate work_orders client_id %', v_wo_client_id
        using errcode = '22023';
    end if;
    v_wo_declared_ids := v_wo_declared_ids || jsonb_build_object(v_wo_client_id, true);

    v_wo_priority := coalesce(nullif(v_wo_elem ->> 'priority', ''), 'normal');
    if v_wo_priority not in ('normal', 'urgente') then
      raise exception 'create_sales_note: invalid work_order priority % (client_id=%)',
        v_wo_priority, v_wo_client_id
        using errcode = '22023';
    end if;

    perform nullif(v_wo_elem ->> 'promised_at', '')::timestamptz;
  end loop;

  select elem ->> 'work_order_client_id'
    into v_orphan_client_id
  from jsonb_array_elements(v_lines) as elem
  where nullif(elem ->> 'work_order_client_id', '') is not null
    and not (v_wo_declared_ids ? (elem ->> 'work_order_client_id'))
  limit 1;

  if v_orphan_client_id is not null then
    raise exception 'create_sales_note: line references unknown work_order client_id %',
      v_orphan_client_id
      using errcode = '22023';
  end if;

  -- Customer is required when the nota has at least one referenced
  -- work order. Counter-only sales stay customer-optional.
  select exists (
    select 1
    from jsonb_array_elements(v_lines) as elem
    where nullif(elem ->> 'work_order_client_id', '') is not null
  )
  into v_has_referenced_order;

  if v_has_referenced_order and v_customer_id is null then
    raise exception 'create_sales_note: customer_id is required when the nota has work orders'
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

  for v_wo_elem in select elem from jsonb_array_elements(v_work_orders) as elem loop
    v_wo_client_id := v_wo_elem ->> 'client_id';

    if not exists (
      select 1
      from jsonb_array_elements(v_lines) as elem
      where (elem ->> 'work_order_client_id') = v_wo_client_id
    ) then
      continue;
    end if;

    v_wo_priority := coalesce(nullif(v_wo_elem ->> 'priority', ''), 'normal');
    v_wo_promised_at := nullif(v_wo_elem ->> 'promised_at', '')::timestamptz;

    insert into public.work_orders (
      sales_note_id, company_id, customer_id,
      description, priority, promised_at
    )
    values (
      v_note_id, v_company_id, v_customer_id,
      nullif(v_wo_elem ->> 'description', ''),
      v_wo_priority, v_wo_promised_at
    )
    returning work_orders.id, work_orders.folio into v_wo_id, v_wo_folio;

    v_wo_map := v_wo_map || jsonb_build_object(
      v_wo_client_id,
      jsonb_build_object('id', v_wo_id, 'folio', v_wo_folio)
    );

    v_wo_result := v_wo_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_wo_id,
        'folio', v_wo_folio,
        'client_id', v_wo_client_id
      )
    );
  end loop;

  insert into public.sales_note_lines (
    sales_note_id, catalog_item_id, concept, dimensions, material,
    unit, quantity, unit_price, discount_type, discount_value,
    line_total, sort_order, work_order_id
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
    (ord - 1)::int,
    (v_wo_map -> nullif(elem ->> 'work_order_client_id', '') ->> 'id')::uuid
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
  work_orders := v_wo_result;
  return next;
end;
$$;

revoke all on function public.create_sales_note(jsonb) from public;
grant execute on function public.create_sales_note(jsonb) to authenticated;

select public.assert_all_tables_have_rls();
