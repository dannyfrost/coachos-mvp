-- ============================================================
-- Gate 0: G0-01 Cross-Tenant Isolation
-- Proves: Coach A cannot read, write, or delete any row
--         belonging to Tenant B.
--
-- UUIDs:
--   coach_a  = 01000001-0000-0000-0000-000000000001
--   coach_b  = 01000001-0000-0000-0000-000000000002
--   client_a = 01000001-0000-0000-0000-000000000003 (Tenant A)
--   client_b = 01000001-0000-0000-0000-000000000004 (Tenant B)
--   client_c = 01000001-0000-0000-0000-000000000005 (no clients row — INSERT test)
-- ============================================================

BEGIN;

SELECT plan(8);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('01000001-0000-0000-0000-000000000001', false, false),
  ('01000001-0000-0000-0000-000000000002', false, false),
  ('01000001-0000-0000-0000-000000000003', false, false),
  ('01000001-0000-0000-0000-000000000004', false, false),
  ('01000001-0000-0000-0000-000000000005', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('01000001-0000-0000-0000-000000000001', 'coach-a@g0-01.test',  'Coach A G01',  'coach',  'active'),
  ('01000001-0000-0000-0000-000000000002', 'coach-b@g0-01.test',  'Coach B G01',  'coach',  'active'),
  ('01000001-0000-0000-0000-000000000003', 'client-a@g0-01.test', 'Client A G01', 'client', 'active'),
  ('01000001-0000-0000-0000-000000000004', 'client-b@g0-01.test', 'Client B G01', 'client', 'active'),
  ('01000001-0000-0000-0000-000000000005', 'client-c@g0-01.test', 'Client C G01', 'client', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES
  ('01000001-0000-0000-0000-000000000001', 'WS G01 A', 'UTC'),
  ('01000001-0000-0000-0000-000000000002', 'WS G01 B', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('01000001-0000-0000-0000-000000000003', '01000001-0000-0000-0000-000000000001'),
  ('01000001-0000-0000-0000-000000000004', '01000001-0000-0000-0000-000000000002');
-- client_c (000005) intentionally NOT inserted into clients (used for INSERT cross-tenant test)

INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES ('01000001-0000-0000-0000-000000000004', '01000001-0000-0000-0000-000000000002', 'green');

INSERT INTO public.daily_logs (client_id, coach_id, log_date)
VALUES ('01000001-0000-0000-0000-000000000004', '01000001-0000-0000-0000-000000000002', CURRENT_DATE);

INSERT INTO public.messages (coach_id, sender_id, recipient_id, content)
VALUES ('01000001-0000-0000-0000-000000000002',
        '01000001-0000-0000-0000-000000000002',
        '01000001-0000-0000-0000-000000000004',
        'msg in tenant B');

INSERT INTO public.plans (coach_id, title, type)
VALUES ('01000001-0000-0000-0000-000000000002', 'Plan B G01', 'meal');

-- ── Authenticate as Coach A ──────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "01000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test 1: Coach A sees 0 Tenant B clients
SELECT is(
  (SELECT COUNT(*) FROM public.clients WHERE id = '01000001-0000-0000-0000-000000000004'),
  0::bigint,
  'Coach A sees 0 Tenant B clients (cross-tenant SELECT blocked)'
);

-- Test 2: Coach A sees 0 Tenant B flash_cards
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards WHERE client_id = '01000001-0000-0000-0000-000000000004'),
  0::bigint,
  'Coach A sees 0 Tenant B flash_cards (cross-tenant SELECT blocked)'
);

-- Test 3: Coach A sees 0 Tenant B daily_logs
SELECT is(
  (SELECT COUNT(*) FROM public.daily_logs WHERE client_id = '01000001-0000-0000-0000-000000000004'),
  0::bigint,
  'Coach A sees 0 Tenant B daily_logs (cross-tenant SELECT blocked)'
);

-- Test 4: Coach A sees 0 Tenant B messages
SELECT is(
  (SELECT COUNT(*) FROM public.messages WHERE coach_id = '01000001-0000-0000-0000-000000000002'),
  0::bigint,
  'Coach A sees 0 Tenant B messages (cross-tenant SELECT blocked)'
);

-- Test 5: Coach A sees 0 Tenant B plans
SELECT is(
  (SELECT COUNT(*) FROM public.plans WHERE coach_id = '01000001-0000-0000-0000-000000000002'),
  0::bigint,
  'Coach A sees 0 Tenant B plans (cross-tenant SELECT blocked)'
);

-- Test 6: Coach A INSERT with coach_id = Tenant B is blocked by RLS WITH CHECK.
--         client_c exists in platform_users as role_type='client' (trigger passes),
--         but coach_id != auth.uid() so WITH CHECK fails → exception raised.
--         throws_ok(sql, NULL, description): NULL errmsg means any exception matches.
SELECT throws_ok(
  $$ INSERT INTO public.clients (id, coach_id)
     VALUES ('01000001-0000-0000-0000-000000000005', '01000001-0000-0000-0000-000000000002') $$,
  NULL,
  'Coach A INSERT into Tenant B (coach_id mismatch) is blocked by RLS WITH CHECK'
);

-- Tests 7-8: Switch to postgres to verify UPDATE/DELETE had no effect.
--            (CTEs with DML cannot be nested in function args — checked via state assertion.)
SET LOCAL ROLE postgres;

-- Test 7: Attempt UPDATE as Coach A (0 rows affected), verify via state.
--         Re-authenticate as Coach A for the UPDATE attempt.
SELECT set_config('request.jwt.claims',
  '{"sub": "01000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.coaches SET workspace_name = 'Hacked' WHERE id = '01000001-0000-0000-0000-000000000002';
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT workspace_name FROM public.coaches WHERE id = '01000001-0000-0000-0000-000000000002'),
  'WS G01 B',
  'Coach A UPDATE on Tenant B coaches row had no effect (workspace_name unchanged)'
);

-- Test 8: Attempt DELETE as Coach A (0 rows affected), verify row still exists.
SELECT set_config('request.jwt.claims',
  '{"sub": "01000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.clients WHERE id = '01000001-0000-0000-0000-000000000004';
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT COUNT(*) FROM public.clients WHERE id = '01000001-0000-0000-0000-000000000004'),
  1::bigint,
  'Coach A DELETE on Tenant B client had no effect (row still exists)'
);

SELECT * FROM finish();

ROLLBACK;
