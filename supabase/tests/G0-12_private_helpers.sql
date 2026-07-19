-- ============================================================
-- Gate 0: G0-12 Private Helper Functions
-- Proves: private.get_my_role(), get_my_coach_id(),
--         is_my_assigned_client(), has_permission(), and
--         is_tenant_member() return correct results for each
--         role type. Called as postgres (superuser) with JWT
--         claims set via set_config — SECURITY DEFINER functions
--         read auth.uid() from the request.jwt.claims GUC.
--
-- UUIDs:
--   coach    = 12000001-0000-0000-0000-000000000001
--   coach_b  = 12000001-0000-0000-0000-000000000004
--   assistant= 12000001-0000-0000-0000-000000000002
--   client   = 12000001-0000-0000-0000-000000000003 (under coach)
--   client_b = 12000001-0000-0000-0000-000000000005 (under coach_b)
--   no_row   = 12000001-0000-0000-0000-000000000099 (not in platform_users)
-- ============================================================

BEGIN;

SELECT plan(8);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('12000001-0000-0000-0000-000000000001', false, false),
  ('12000001-0000-0000-0000-000000000002', false, false),
  ('12000001-0000-0000-0000-000000000003', false, false),
  ('12000001-0000-0000-0000-000000000004', false, false),
  ('12000001-0000-0000-0000-000000000005', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('12000001-0000-0000-0000-000000000001', 'coach@g0-12.test',   'Coach G12',    'coach',     'active'),
  ('12000001-0000-0000-0000-000000000002', 'asst@g0-12.test',    'Asst G12',     'assistant', 'active'),
  ('12000001-0000-0000-0000-000000000003', 'client@g0-12.test',  'Client G12',   'client',    'active'),
  ('12000001-0000-0000-0000-000000000004', 'coachb@g0-12.test',  'Coach B G12',  'coach',     'active'),
  ('12000001-0000-0000-0000-000000000005', 'clientb@g0-12.test', 'Client B G12', 'client',    'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES
  ('12000001-0000-0000-0000-000000000001', 'WS G12 A', 'UTC'),
  ('12000001-0000-0000-0000-000000000004', 'WS G12 B', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('12000001-0000-0000-0000-000000000003', '12000001-0000-0000-0000-000000000001'),
  ('12000001-0000-0000-0000-000000000005', '12000001-0000-0000-0000-000000000004');

INSERT INTO public.staff_assignments (coach_id, user_id, role_id, status)
VALUES (
  '12000001-0000-0000-0000-000000000001',
  '12000001-0000-0000-0000-000000000002',
  (SELECT id FROM public.roles WHERE name = 'assistant'),
  'active'
);

INSERT INTO public.client_staff_assignments (coach_id, client_id, staff_id)
VALUES (
  '12000001-0000-0000-0000-000000000001',
  '12000001-0000-0000-0000-000000000003',
  '12000001-0000-0000-0000-000000000002'
);

-- ── Tests (called as postgres, JWT claims set via GUC) ───────

-- Test 1: get_my_role() = 'coach' for a coach
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SELECT is(
  private.get_my_role(),
  'coach',
  'get_my_role() returns ''coach'' for a coach'
);

-- Test 2: get_my_role() = 'assistant' for an assistant
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SELECT is(
  private.get_my_role(),
  'assistant',
  'get_my_role() returns ''assistant'' for an assistant'
);

-- Test 3: get_my_role() = 'client' for a client
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000003", "role": "authenticated"}', true);
SELECT is(
  private.get_my_role(),
  'client',
  'get_my_role() returns ''client'' for a client'
);

-- Test 4: get_my_role() IS NULL for a user with no platform_users row
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000099", "role": "authenticated"}', true);
SELECT is(
  private.get_my_role(),
  NULL::text,
  'get_my_role() returns NULL for a user with no platform_users row'
);

-- Test 5: get_my_coach_id() = own id for a coach
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SELECT is(
  private.get_my_coach_id(),
  '12000001-0000-0000-0000-000000000001'::uuid,
  'get_my_coach_id() returns own id for a coach'
);

-- Test 6: is_my_assigned_client() returns true for assigned client, false for unassigned
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SELECT ok(
  private.is_my_assigned_client('12000001-0000-0000-0000-000000000003'::uuid)
  AND NOT private.is_my_assigned_client('12000001-0000-0000-0000-000000000005'::uuid),
  'is_my_assigned_client() returns true for assigned client and false for unassigned'
);

-- Test 7: has_permission('clients:read') returns true for assistant (seeded via roles table)
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SELECT ok(
  private.has_permission('clients:read'),
  'has_permission(''clients:read'') returns true for assistant with seeded permission'
);

-- Test 8: is_tenant_member() returns true for same-tenant user, false for other-tenant user
SELECT set_config('request.jwt.claims',
  '{"sub": "12000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SELECT ok(
  private.is_tenant_member('12000001-0000-0000-0000-000000000003'::uuid)
  AND NOT private.is_tenant_member('12000001-0000-0000-0000-000000000005'::uuid),
  'is_tenant_member() returns true for same-tenant member and false for other-tenant member'
);

SELECT * FROM finish();

ROLLBACK;
