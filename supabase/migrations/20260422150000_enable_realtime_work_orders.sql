-- LIT-103: Enable Supabase Realtime broadcasts for work_orders.
--
-- Realtime only emits changes for tables explicitly added to the
-- `supabase_realtime` publication. Without this, the sidebar's
-- unread-orders hook subscribes successfully but never receives
-- INSERT events — the channel stays silent.
--
-- RLS still gates what each client sees; Realtime respects the same
-- policies as regular SELECT. Every authenticated operator can already
-- read every work order (LIT-37), so no additional policy work needed.

alter publication supabase_realtime add table public.work_orders;
