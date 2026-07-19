-- ============================================================
-- Gate 0: G0-03 Assistant Scope
-- Proves: A standard assistant sees only assigned clients, not
--         all clients in the tenant.
--
-- UUIDs:
--   coach_a    = 03000001-0000-0000-0000-000000000001
--   client1    = 03000001-0000-0000-0000-000000000002 (assigned)
--   client2    = 03000001-0000-0000-0000-000000000003 (NOT assigned)
--   assistant  = 03000001-0000-0000-0000-000000000004
--   senior_ast = 03000001-0000-0000-0000-000000000005 (proves team count > 1)
-- ============================================================

BEGIN;

SELECT plan(6);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('03000001-0000-0000-0000-000000000001', false, false),
  ('03000001-0000-0000-0000-000000000002', false, false),
  ('03000001-0000-0000-0000-000000000003', false, false),
  ('03000001-0000-0000-0000-000000000004', false, false),
  ('03000001-0000-0000-0000-000000000005', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('03000001-0000-0000-0000-000000000001', 'coach@g0-03.test',    'Coach G03',     'coach',     'active'),
  ('03000001-0000-0000-0000-000000000002', 'client1@g0-03.test',  'Client1 G03',   'client',    'active'),
  ('03000001-0000-0000-0000-000000000003', 'client2@g0-03.test',  'Client2 G03',   'client',    'active'),
  ('03000001-0000-0000-0000-000000000004', 'asst@g0-03.test',     'Assistant G03', 'assistant', 'active'),
  ('03000001-0000-0000-0000-000000000005', 'senior@g0-03.test',   'Sr Asst G03',   'assistant', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES  ('03000001-0000-0000-0000-000000000001', 'WS G03', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('03000001-0000-0000-0000-000000000002', '03000001-0000-0000-0000-000000000001'),
  ('03000001-0000-0000-0000-000000000003', '03000001-0000-0000-0000-000000000001');

-- Standard assistant row: role_id → 'assistant' role
INSERT INTO public.staff_assignments (coach_id, user_id, role_id, status)
VALUES (
  '03000001-0000-0000-0000-000000000001',
  '03000001-0000-0000-0000-000000000004',
  (SELECT id FROM public.roles WHERE name = 'assistant'),
  'active'
);

-- Senior assistant also in workspace (makes team count > 1)
INSERT INTO public.staff_assignments (coach_id, user_id, role_id, status)
VALUES (
  '03000001-0000-0000-0000-000000000001',
  '03000001-0000-0000-0000-000000000005',
  (SELECT id FROM public.roles WHERE name = 'senior_assistant'),
  'active'
);

-- Assign standard assistant to client1 ONLY (not client2)
INSERT INTO public.client_staff_assignments (coach_id, client_id, staff_id)
VALUES (
  '03000001-0000-0000-0000-000000000001',
  '03000001-0000-0000-0000-000000000002',
  '03000001-0000-0000-0000-000000000004'
);

INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES ('03000001-0000-0000-0000-000000000003', '03000001-0000-0000-0000-000000000001', 'green');

INSERT INTO public.daily_logs (client_id, coach_id, log_date)
VALUES ('03000001-0000-0000-0000-000000000003', '03000001-0000-0000-0000-000000000001', CURRENT_DATE);

-- Message to unassigned client2 from coach (assistant is not a party)
INSERT INTO public.messages (coach_id, sender_id, recipient_id, content)
VALUES ('03000001-0000-0000-0000-000000000001',
        '03000001-0000-0000-0000-000000000001',
        '03000001-0000-0000-0000-000000000003',
        'msg to unassigned client2');

-- ── Authenticate as standard assistant ──────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "03000001-0000-0000-0000-000000000004", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test 1: Assistant sees exactly 1 client (assigned client1 only)
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  1::bigint,
  'Standard assistant sees exactly 1 client (assigned client1 only)'
);

-- Test 2: Assistant sees 0 rows for unassigned client2
SELECT is(
  (SELECT COUNT(*) FROM public.clients WHERE id = '03000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Standard assistant sees 0 rows for unassigned client2'
);

-- Test 3: Assistant sees 0 flash_cards for unassigned client2
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards WHERE client_id = '03000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Standard assistant sees 0 flash_cards for unassigned client2'
);

-- Test 4: Assistant sees 0 daily_logs for unassigned client2
SELECT is(
  (SELECT COUNT(*) FROM public.daily_logs WHERE client_id = '03000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Standard assistant sees 0 daily_logs for unassigned client2'
);

-- Test 5: Assistant sees 0 messages where unassigned client2 is recipient
SELECT is(
  (SELECT COUNT(*) FROM public.messages WHERE recipient_id = '03000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Standard assistant sees 0 messages where unassigned client2 is recipient'
);

-- Test 6: Standard assistant sees only own staff_assignments row (count = 1, not 2).
--         policy: user_id = auth.uid() — cannot see senior_asst row.
SELECT is(
  (SELECT COUNT(*) FROM public.staff_assignments),
  1::bigint,
  'Standard assistant sees only own staff_assignments row (cannot see full team)'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
