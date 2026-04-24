-- LIT-99 — narrow post-commit toggle for sales_notes.requires_invoice.
--
-- CLAUDE.md §8 freezes sales_notes structure at commit, but
-- `requires_invoice` is a routing hint for Dana's manual Contpaqi
-- invoicing workbench (LIT-90), not part of the monetary / folio /
-- line shape. Treating it as the one explicit exception preserves the
-- freeze spirit without forcing operators to cancel + recreate when a
-- walk-in later asks for factura.
--
-- Why an RPC instead of widening the RLS policy:
--   * The existing `sales_notes_update_admin` UPDATE policy is
--     admin-only (see 20260418120000_sales_notes.sql). Both admin and
--     ventas need this flip — the factura decision happens at the
--     counter, not back-office.
--   * Column-level grants can't replace the existing policy without
--     breaking admin cancellation (which mutates status / cancelled_at
--     / cancellation_reason in one UPDATE).
--   * A SECURITY DEFINER RPC mirrors the create_sales_note /
--     payments trigger pattern already in this schema: single narrow
--     capability, auditable via the generic audit_logs trigger
--     attached to sales_notes, no policy widening.

create or replace function public.update_sales_note_requires_invoice(
  p_id uuid,
  p_requires_invoice boolean
)
returns public.sales_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_note public.sales_notes;
begin
  if v_caller is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_note
  from public.sales_notes
  where id = p_id
  for update;

  if not found then
    raise exception 'nota no encontrada' using errcode = '22023';
  end if;

  if v_note.status = 'cancelada' then
    raise exception 'no se puede editar una nota cancelada' using errcode = '22023';
  end if;

  -- No-op shortcut: don't invoke the audit trigger for a non-change.
  if v_note.requires_invoice = p_requires_invoice then
    return v_note;
  end if;

  -- SECURITY DEFINER bypasses RLS, so the admin-only UPDATE policy
  -- stays intact for direct client writes. stamp_actor_columns +
  -- set_updated_at triggers fire normally and the audit trigger
  -- captures old_data.requires_invoice / new_data.requires_invoice.
  update public.sales_notes
    set requires_invoice = p_requires_invoice
    where id = p_id
    returning * into v_note;

  return v_note;
end;
$$;

revoke all on function public.update_sales_note_requires_invoice(uuid, boolean) from public;
grant execute on function public.update_sales_note_requires_invoice(uuid, boolean) to authenticated;
