-- ============================================================
-- Migration: 011_revoke_grants
-- Purpose:   Revoke direct table-level write privileges from
--            the authenticated role on tables whose mutations
--            must flow through SECURITY DEFINER RPCs.
--            Depends on: 001–010
-- Order:     11 of 13 (Tier 0)
--
-- Security decisions enforced:
--   S-03 (LOCKED 2026-05-09): Direct UPDATE on messages and
--     flash_cards revoked for authenticated. All writes route
--     through send_message / update_flash_card_notes /
--     refresh_flash_card in 010_rpc_functions.sql.
--   S-07 (LOCKED 2026-05-15): Direct INSERT on messages revoked
--     for authenticated. All inserts route through send_message
--     in 010_rpc_functions.sql.
--   S-08 (LOCKED 2026-05-15): Direct UPDATE on platform_users
--     revoked for authenticated. All profile mutations route
--     through the appropriate SECURITY DEFINER RPCs in
--     010_rpc_functions.sql.
--
-- Cross-reference: 010_rpc_functions.sql provides all 23
--   SECURITY DEFINER RPCs that write to the tables below.
-- ============================================================

REVOKE INSERT ON public.messages        FROM authenticated;
REVOKE UPDATE ON public.messages        FROM authenticated;
REVOKE UPDATE ON public.flash_cards     FROM authenticated;
REVOKE UPDATE ON public.platform_users  FROM authenticated;
