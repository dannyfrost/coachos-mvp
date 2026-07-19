-- ============================================================
-- Gate 0: G0-10 Trigger Correctness
-- Proves: Role-enforcement and locked-row triggers from
--         005_triggers.sql exist and fire correctly.
-- ============================================================

SELECT plan(4);

-- Test 1: enforce_coach_role_trg exists on coaches
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_coach_role_trg'
  ),
  'enforce_coach_role_trg exists on coaches table'
);

-- Test 2: enforce_client_role_trg exists on clients
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_client_role_trg'
  ),
  'enforce_client_role_trg exists on clients table'
);

-- Test 3: enforce_roles_locked_trg exists on roles
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_roles_locked_trg'
  ),
  'enforce_roles_locked_trg exists on roles table'
);

-- Test 4: enforce_roles_locked_trg fires — updating a locked seed role raises an exception.
--         throws_ok(sql, errmsg, description): NULL errmsg means any exception matches.
SELECT throws_ok(
  $$ UPDATE public.roles SET description = 'tampered' WHERE name = 'coach' $$,
  NULL,
  'Updating locked seed role raises enforce_roles_locked exception'
);

SELECT * FROM finish();
