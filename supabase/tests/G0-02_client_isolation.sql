-- ============================================================
-- Gate 0: G0-02 Client Isolation
-- Proves: A client cannot access another client's data within
--         the same tenant.
--
-- UUIDs:
--   coach   = 02000001-0000-0000-0000-000000000001
--   client1 = 02000001-0000-0000-0000-000000000002
--   client2 = 02000001-0000-0000-0000-000000000003
-- ============================================================

BEGIN;

SELECT plan(5);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('02000001-0000-0000-0000-000000000001', false, false),
  ('02000001-0000-0000-0000-000000000002', false, false),
  ('02000001-0000-0000-0000-000000000003', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('02000001-0000-0000-0000-000000000001', 'coach@g0-02.test',   'Coach G02',   'coach',  'active'),
  ('02000001-0000-0000-0000-000000000002', 'client1@g0-02.test', 'Client1 G02', 'client', 'active'),
  ('02000001-0000-0000-0000-000000000003', 'client2@g0-02.test', 'Client2 G02', 'client', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES  ('02000001-0000-0000-0000-000000000001', 'WS G02', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('02000001-0000-0000-0000-000000000002', '02000001-0000-0000-0000-000000000001'),
  ('02000001-0000-0000-0000-000000000003', '02000001-0000-0000-0000-000000000001');

INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES ('02000001-0000-0000-0000-000000000003', '02000001-0000-0000-0000-000000000001', 'green');

INSERT INTO public.daily_logs (client_id, coach_id, log_date)
VALUES ('02000001-0000-0000-0000-000000000003', '02000001-0000-0000-0000-000000000001', CURRENT_DATE);

-- Message from client2 to coach (client1 is neither sender nor recipient)
INSERT INTO public.messages (coach_id, sender_id, recipient_id, content)
VALUES ('02000001-0000-0000-0000-000000000001',
        '02000001-0000-0000-0000-000000000003',
        '02000001-0000-0000-0000-000000000001',
        'msg from client2');

INSERT INTO public.plans (coach_id, title, type)
VALUES ('02000001-0000-0000-0000-000000000001', 'Plan G02', 'meal');

INSERT INTO public.plan_assignments (coach_id, client_id, plan_id, plan_type)
SELECT '02000001-0000-0000-0000-000000000001',
       '02000001-0000-0000-0000-000000000003',
       p.id,
       'meal'
  FROM public.plans p
 WHERE p.coach_id = '02000001-0000-0000-0000-000000000001';

-- ── Authenticate as Client 1 ─────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "02000001-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test 1: Client 1 sees only own clients row (count = 1, not 2)
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  1::bigint,
  'Client 1 sees exactly 1 clients row (own record only)'
);

-- Test 2: Client 1 sees 0 flash_cards for Client 2
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards WHERE client_id = '02000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Client 1 sees 0 flash_cards for Client 2'
);

-- Test 3: Client 1 sees 0 daily_logs for Client 2
SELECT is(
  (SELECT COUNT(*) FROM public.daily_logs WHERE client_id = '02000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Client 1 sees 0 daily_logs for Client 2'
);

-- Test 4: Client 1 sees 0 messages where Client 2 is sender and Client 1 is not a party
SELECT is(
  (SELECT COUNT(*) FROM public.messages
   WHERE sender_id = '02000001-0000-0000-0000-000000000003'
     AND recipient_id != '02000001-0000-0000-0000-000000000002'),
  0::bigint,
  'Client 1 sees 0 messages sent by Client 2 to Coach (Client 1 not a party)'
);

-- Test 5: Client 1 sees 0 plan_assignments for Client 2
SELECT is(
  (SELECT COUNT(*) FROM public.plan_assignments WHERE client_id = '02000001-0000-0000-0000-000000000003'),
  0::bigint,
  'Client 1 sees 0 plan_assignments for Client 2'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
