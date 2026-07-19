-- ============================================================
-- Gate 0: G0-04 Senior Assistant Scope
-- Proves: A senior assistant sees all clients in their tenant
--         but no clients from other tenants.
--
-- UUIDs:
--   coach_a    = 04000001-0000-0000-0000-000000000001
--   coach_b    = 04000001-0000-0000-0000-000000000002
--   client_a1  = 04000001-0000-0000-0000-000000000003 (Tenant A)
--   client_a2  = 04000001-0000-0000-0000-000000000004 (Tenant A)
--   client_b   = 04000001-0000-0000-0000-000000000005 (Tenant B)
--   senior_ast = 04000001-0000-0000-0000-000000000006 (Tenant A)
-- ============================================================

BEGIN;

SELECT plan(5);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('04000001-0000-0000-0000-000000000001', false, false),
  ('04000001-0000-0000-0000-000000000002', false, false),
  ('04000001-0000-0000-0000-000000000003', false, false),
  ('04000001-0000-0000-0000-000000000004', false, false),
  ('04000001-0000-0000-0000-000000000005', false, false),
  ('04000001-0000-0000-0000-000000000006', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('04000001-0000-0000-0000-000000000001', 'coacha@g0-04.test',  'Coach A G04',     'coach',     'active'),
  ('04000001-0000-0000-0000-000000000002', 'coachb@g0-04.test',  'Coach B G04',     'coach',     'active'),
  ('04000001-0000-0000-0000-000000000003', 'clta1@g0-04.test',   'Client A1 G04',   'client',    'active'),
  ('04000001-0000-0000-0000-000000000004', 'clta2@g0-04.test',   'Client A2 G04',   'client',    'active'),
  ('04000001-0000-0000-0000-000000000005', 'cltb@g0-04.test',    'Client B G04',    'client',    'active'),
  ('04000001-0000-0000-0000-000000000006', 'senior@g0-04.test',  'Senior Asst G04', 'assistant', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES
  ('04000001-0000-0000-0000-000000000001', 'WS G04 A', 'UTC'),
  ('04000001-0000-0000-0000-000000000002', 'WS G04 B', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('04000001-0000-0000-0000-000000000003', '04000001-0000-0000-0000-000000000001'),
  ('04000001-0000-0000-0000-000000000004', '04000001-0000-0000-0000-000000000001'),
  ('04000001-0000-0000-0000-000000000005', '04000001-0000-0000-0000-000000000002');

-- Senior assistant in Tenant A: role_id → 'senior_assistant' role
INSERT INTO public.staff_assignments (coach_id, user_id, role_id, status)
VALUES (
  '04000001-0000-0000-0000-000000000001',
  '04000001-0000-0000-0000-000000000006',
  (SELECT id FROM public.roles WHERE name = 'senior_assistant'),
  'active'
);

-- Flash cards for Tenant A clients
INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES
  ('04000001-0000-0000-0000-000000000003', '04000001-0000-0000-0000-000000000001', 'green'),
  ('04000001-0000-0000-0000-000000000004', '04000001-0000-0000-0000-000000000001', 'yellow');

-- Flash card for Tenant B client (must NOT be visible to senior_asst)
INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES ('04000001-0000-0000-0000-000000000005', '04000001-0000-0000-0000-000000000002', 'red');

-- ── Authenticate as senior assistant ────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "04000001-0000-0000-0000-000000000006", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test 1: Senior assistant sees exactly 2 clients (all Tenant A clients via team scope)
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  2::bigint,
  'Senior assistant sees exactly 2 clients (all Tenant A clients via team scope)'
);

-- Test 2: Senior assistant sees 0 rows for Tenant B client (cross-tenant blocked)
SELECT is(
  (SELECT COUNT(*) FROM public.clients WHERE id = '04000001-0000-0000-0000-000000000005'),
  0::bigint,
  'Senior assistant sees 0 rows for Tenant B client (cross-tenant blocked)'
);

-- Test 3: Senior assistant sees flash_cards for both Tenant A clients (count = 2)
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards),
  2::bigint,
  'Senior assistant sees flash_cards for both Tenant A clients (team scope)'
);

-- Test 4: Senior assistant can see staff_assignments (team:read via clients:read_team_scope)
SELECT ok(
  (SELECT COUNT(*) FROM public.staff_assignments) >= 1,
  'Senior assistant can see staff_assignments (has team:read via clients:read_team_scope)'
);

-- Test 5: Senior assistant sees 0 Tenant B flash_cards
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards
   WHERE client_id = '04000001-0000-0000-0000-000000000005'),
  0::bigint,
  'Senior assistant sees 0 Tenant B flash_cards (cross-tenant blocked)'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
