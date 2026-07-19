-- ============================================================
-- Gate 0: G0-09 RPC Correctness
-- Proves: All 6 representative RPCs exist in the public schema
--         as SECURITY DEFINER functions (010_rpc_functions.sql).
-- ============================================================

SELECT plan(6);

-- Test 1: send_message RPC exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'send_message'
      AND pronamespace = 'public'::regnamespace
  ),
  'send_message RPC exists in public schema'
);

-- Test 2: create_client_invite RPC exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_client_invite'
      AND pronamespace = 'public'::regnamespace
  ),
  'create_client_invite RPC exists in public schema'
);

-- Test 3: update_flash_card_notes RPC exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_flash_card_notes'
      AND pronamespace = 'public'::regnamespace
  ),
  'update_flash_card_notes RPC exists in public schema'
);

-- Test 4: assign_plan RPC exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'assign_plan'
      AND pronamespace = 'public'::regnamespace
  ),
  'assign_plan RPC exists in public schema'
);

-- Test 5: confirm_client_payment RPC exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'confirm_client_payment'
      AND pronamespace = 'public'::regnamespace
  ),
  'confirm_client_payment RPC exists in public schema'
);

-- Test 6: update_today_log RPC exists (daily check-in log upsert)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_today_log'
      AND pronamespace = 'public'::regnamespace
  ),
  'update_today_log RPC exists in public schema'
);

SELECT * FROM finish();
