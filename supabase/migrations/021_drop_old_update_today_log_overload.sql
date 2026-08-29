-- ============================================================
-- 021_drop_old_update_today_log_overload.sql
-- 020 used CREATE OR REPLACE FUNCTION with an added parameter,
-- which Postgres treats as a distinct overload rather than a
-- replacement (function identity includes the parameter list).
-- This left two update_today_log signatures (5-arg and 6-arg)
-- coexisting, making every RPC call ambiguous. Drop the old one.
-- ============================================================

DROP FUNCTION IF EXISTS public.update_today_log(numeric, integer, text, text, text);
