-- ============================================================
-- Gate 0: G0-05 Coach Scope
-- Proves: A coach sees only their own tenant's data.
--
-- UUIDs:
--   coach_a  = 05000001-0000-0000-0000-000000000001
--   coach_b  = 05000001-0000-0000-0000-000000000002
--   client_a = 05000001-0000-0000-0000-000000000003 (Tenant A)
--   client_b = 05000001-0000-0000-0000-000000000004 (Tenant B)
-- ============================================================

BEGIN;

SELECT plan(6);

-- ── Test data ───────────────────────────────────────────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('05000001-0000-0000-0000-000000000001', false, false),
  ('05000001-0000-0000-0000-000000000002', false, false),
  ('05000001-0000-0000-0000-000000000003', false, false),
  ('05000001-0000-0000-0000-000000000004', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('05000001-0000-0000-0000-000000000001', 'coacha@g0-05.test', 'Coach A G05',  'coach',  'active'),
  ('05000001-0000-0000-0000-000000000002', 'coachb@g0-05.test', 'Coach B G05',  'coach',  'active'),
  ('05000001-0000-0000-0000-000000000003', 'clta@g0-05.test',   'Client A G05', 'client', 'active'),
  ('05000001-0000-0000-0000-000000000004', 'cltb@g0-05.test',   'Client B G05', 'client', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES
  ('05000001-0000-0000-0000-000000000001', 'WS G05 A', 'UTC'),
  ('05000001-0000-0000-0000-000000000002', 'WS G05 B', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('05000001-0000-0000-0000-000000000003', '05000001-0000-0000-0000-000000000001'),
  ('05000001-0000-0000-0000-000000000004', '05000001-0000-0000-0000-000000000002');

INSERT INTO public.plans (coach_id, title, type)
VALUES
  ('05000001-0000-0000-0000-000000000001', 'Plan A G05', 'meal'),
  ('05000001-0000-0000-0000-000000000002', 'Plan B G05', 'meal');

INSERT INTO public.flash_cards (client_id, coach_id, status)
VALUES
  ('05000001-0000-0000-0000-000000000003', '05000001-0000-0000-0000-000000000001', 'green'),
  ('05000001-0000-0000-0000-000000000004', '05000001-0000-0000-0000-000000000002', 'red');

-- Subscription for coach_b only (coach_a has none in this test)
INSERT INTO public.coach_subscriptions (coach_id, status)
VALUES ('05000001-0000-0000-0000-000000000002', 'active');

-- ── Authenticate as Coach A ──────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "05000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test 1: Coach A sees only Tenant A clients (count = 1)
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  1::bigint,
  'Coach A sees only Tenant A clients (count = 1)'
);

-- Test 2: Coach A sees only own coaches row (count = 1, not 2)
SELECT is(
  (SELECT COUNT(*) FROM public.coaches),
  1::bigint,
  'Coach A sees only own coaches row (count = 1)'
);

-- Test 3: Coach A sees only Tenant A plans (count = 1)
SELECT is(
  (SELECT COUNT(*) FROM public.plans),
  1::bigint,
  'Coach A sees only Tenant A plans (count = 1)'
);

-- Test 4: Coach A sees only Tenant A flash_cards (count = 1)
SELECT is(
  (SELECT COUNT(*) FROM public.flash_cards),
  1::bigint,
  'Coach A sees only Tenant A flash_cards (count = 1)'
);

-- Test 5: Coach A sees 0 staff_assignments (no staff in Tenant A in this test)
SELECT is(
  (SELECT COUNT(*) FROM public.staff_assignments),
  0::bigint,
  'Coach A sees 0 staff_assignments (no staff in Tenant A)'
);

-- Test 6: Coach A sees 0 coach_subscriptions (only Tenant B has one)
SELECT is(
  (SELECT COUNT(*) FROM public.coach_subscriptions),
  0::bigint,
  'Coach A sees 0 coach_subscriptions (only Tenant B has a subscription)'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
