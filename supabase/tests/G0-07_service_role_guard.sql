-- ============================================================
-- Gate 0: G0-07 Service Role Guard
-- Proves: anon role sees 0 rows (default deny — no anon policies);
--         authenticated with no platform_users row sees 0 rows
--         (get_my_role() returns NULL); RLS is enabled on
--         platform_users.
--
-- UUIDs:
--   coach  = 07000001-0000-0000-0000-000000000001
--   client = 07000001-0000-0000-0000-000000000002
--   no_row = 07000001-0000-0000-0000-000000000099 (not in platform_users)
-- ============================================================

BEGIN;

SELECT plan(4);

-- ── Test data (exists only during this transaction) ─────────
INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('07000001-0000-0000-0000-000000000001', false, false),
  ('07000001-0000-0000-0000-000000000002', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('07000001-0000-0000-0000-000000000001', 'coach@g0-07.test',  'Coach G07',  'coach',  'active'),
  ('07000001-0000-0000-0000-000000000002', 'client@g0-07.test', 'Client G07', 'client', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES  ('07000001-0000-0000-0000-000000000001', 'WS G07', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES  ('07000001-0000-0000-0000-000000000002', '07000001-0000-0000-0000-000000000001');

-- ── Tests ───────────────────────────────────────────────────

-- Test 1: anon sees 0 rows from platform_users (2 rows exist, RLS blocks all)
SET LOCAL ROLE anon;
SELECT is(
  (SELECT COUNT(*) FROM public.platform_users),
  0::bigint,
  'anon sees 0 rows from platform_users (default deny — no anon policies)'
);
SET LOCAL ROLE postgres;

-- Test 2: anon sees 0 rows from clients (1 row exists, RLS blocks all)
SET LOCAL ROLE anon;
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  0::bigint,
  'anon sees 0 rows from clients (default deny — no anon policies)'
);
SET LOCAL ROLE postgres;

-- Test 3: authenticated user with no platform_users row sees 0 clients.
--         get_my_role() returns NULL → no RLS policy passes.
SELECT set_config('request.jwt.claims',
  '{"sub": "07000001-0000-0000-0000-000000000099", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT COUNT(*) FROM public.clients),
  0::bigint,
  'authenticated with no platform_users row sees 0 rows (get_my_role() = NULL)'
);
SET LOCAL ROLE postgres;

-- Test 4: RLS is enabled on platform_users (pg_class.relrowsecurity = true)
SELECT is(
  (
    SELECT relrowsecurity
      FROM pg_class
     WHERE relname = 'platform_users'
       AND relnamespace = 'public'::regnamespace
  ),
  true,
  'RLS is enabled on platform_users (relrowsecurity = true)'
);

SELECT * FROM finish();

ROLLBACK;
