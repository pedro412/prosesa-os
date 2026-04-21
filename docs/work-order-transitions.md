# Work order status transitions

Source of truth for the state machine that governs `work_orders.status`.
The UI (LIT-42 detail, LIT-101 row menu) surfaces these rules; the
`update_work_order_status(wo_id, new_status, note)` RPC enforces them.
Reference: SPEC §4.5, `CLAUDE.md` §7 / §8.

## Stages

Forward order:

```
cotizado
  → anticipo_recibido
  → en_diseno
  → en_produccion
  → en_instalacion   (skippable)
  → terminado
  → entregado
```

`en_instalacion` is optional. Going `en_produccion → terminado` is a
forward transition (the shop skipped installation because the job didn't
need it), not a skip-and-complete.

`entregado` is reachable but not truly terminal. Reopens (customer
returns for rework) are legal as **backward** transitions — see below.
The log stays append-only so every reopen is auditable.

## Transition rules

| From → To                            | Allowed? | Note required? |
| ------------------------------------ | -------- | -------------- |
| Any forward edge (same or later idx) | Yes      | No             |
| Any backward edge (earlier idx)      | Yes      | **Yes**        |
| Same status (idempotent no-op)       | Yes      | No (no-op)     |
| Any edge on a cancelled order        | **No**   | —              |

"Forward" / "backward" are computed from the stage's position in the
array above. `en_produccion → terminado` is forward (index 3 → 5).
`entregado → terminado` is backward (index 6 → 5) and requires a note.

Cancellation is a separate dimension (`work_orders.cancelled_at`), not a
status value. Cancelled orders are frozen — `update_work_order_status`
raises before it touches the row. Admins cancel via the soft-cancel
trigger path from LIT-38, not via this RPC.

## `delivered_at` bookkeeping

The RPC keeps `delivered_at` coherent with status so downstream readers
(reports, PDFs) don't need to re-derive:

- Crossing **into** `entregado` stamps `delivered_at = now()` if it was null.
- Crossing **out of** `entregado` (backward reopen) clears `delivered_at`.
- Intermediate transitions leave `delivered_at` untouched.

## Log shape

Every transition writes one row to `work_order_status_log`:

```sql
id uuid pk
work_order_id uuid not null
old_status text            -- null only on the first-ever row for a wo
new_status text not null
note text                  -- non-null on backward transitions
changed_by uuid not null
changed_at timestamptz default now()
```

RLS: authenticated SELECT; no client INSERT/UPDATE/DELETE policies.
The AFTER UPDATE trigger on `work_orders.status` runs SECURITY DEFINER
and is the sole writer. Ad-hoc `UPDATE work_orders SET status = ...`
outside the RPC still logs — just with `note = null`.

## Consumer surfaces

- **LIT-42** (detail page): renders `work_order_status_log` as a
  timeline with user + timestamp + note per row.
- **LIT-101** (row status menu): calls the RPC, shows backward
  transitions behind a note-required dialog.
- **LIT-43** (PDF): surfaces current status + `delivered_at` in the
  printed nota when applicable.
