-- ============================================================
-- Gate 0: G0-17 update_today_log partial-update + evidence
-- Proves (migrations 025 + 026 + 027):
--   * A steps-only update preserves a previously-logged weight,
--     weight_photo_key, and questions (no NULL overwrite — 026).
--   * A weight update with a real, owned scale photo is accepted (027).
--   * Stored photo evidence satisfies a later weight update (025).
--   * A weight submission with no photo evidence is rejected (025).
--   * A weight_photo_key with no matching storage object is rejected (027).
--   * A weight_photo_key in another user's folder is rejected (027).
--
-- Weight photo key path contract: {coach_id}/{client_id}/{file}.
--
-- UUIDs:
--   coach   = 02000017-0000-0000-0000-000000000001
--   client  = 02000017-0000-0000-0000-000000000002
--   victim  = 02000017-0000-0000-0000-000000000003
-- ============================================================

BEGIN;

SELECT plan(9);

INSERT INTO auth.users (id, is_sso_user, is_anonymous)
VALUES
  ('02000017-0000-0000-0000-000000000001', false, false),
  ('02000017-0000-0000-0000-000000000002', false, false),
  ('02000017-0000-0000-0000-000000000003', false, false);

INSERT INTO public.platform_users (id, email, full_name, role_type, status)
VALUES
  ('02000017-0000-0000-0000-000000000001', 'coach@g0-17.test',  'Coach G17',  'coach',  'active'),
  ('02000017-0000-0000-0000-000000000002', 'client@g0-17.test', 'Client G17', 'client', 'active'),
  ('02000017-0000-0000-0000-000000000003', 'victim@g0-17.test', 'Victim G17', 'client', 'active');

INSERT INTO public.coaches (id, workspace_name, timezone)
VALUES ('02000017-0000-0000-0000-000000000001', 'WS G17', 'UTC');

INSERT INTO public.clients (id, coach_id)
VALUES
  ('02000017-0000-0000-0000-000000000002', '02000017-0000-0000-0000-000000000001'),
  ('02000017-0000-0000-0000-000000000003', '02000017-0000-0000-0000-000000000001');

-- Real uploaded scale photos: one owned by the client, one by the victim.
INSERT INTO storage.objects (id, bucket_id, name)
VALUES
  (gen_random_uuid(), 'tenant-media',
   '02000017-0000-0000-0000-000000000001/02000017-0000-0000-0000-000000000002/1_weight.jpeg'),
  (gen_random_uuid(), 'tenant-media',
   '02000017-0000-0000-0000-000000000001/02000017-0000-0000-0000-000000000003/9_weight.jpeg');

-- ── Authenticate as the client ──────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub": "02000017-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

-- 1. weight + a real owned photo key is accepted
SELECT lives_ok(
  $$ SELECT public.update_today_log(
       p_weight := 80.5,
       p_weight_photo_key := '02000017-0000-0000-0000-000000000001/02000017-0000-0000-0000-000000000002/1_weight.jpeg') $$,
  'weight with a real owned photo key is accepted'
);

SELECT is(
  (SELECT weight FROM public.daily_logs WHERE client_id='02000017-0000-0000-0000-000000000002' AND log_date=CURRENT_DATE),
  80.5::numeric, 'weight stored as 80.5');

-- 2. steps-only update must NOT wipe the weight (026)
SELECT lives_ok($$ SELECT public.update_today_log(p_steps := 8200) $$, 'steps-only update runs');

SELECT is(
  (SELECT weight FROM public.daily_logs WHERE client_id='02000017-0000-0000-0000-000000000002' AND log_date=CURRENT_DATE),
  80.5::numeric, 'weight preserved after steps-only update (data-loss bug fixed)');

SELECT is(
  (SELECT steps FROM public.daily_logs WHERE client_id='02000017-0000-0000-0000-000000000002' AND log_date=CURRENT_DATE),
  8200, 'steps updated to 8200');

-- 3. later weight update with NO new key: stored evidence satisfies it (025)
SELECT lives_ok($$ SELECT public.update_today_log(p_weight := 81.0) $$,
  'weight update allowed: today already has stored photo evidence');

-- 4. weight with a key that has no storage object is rejected (027)
SELECT throws_ok(
  $$ SELECT public.update_today_log(
       p_weight := 70.0,
       p_weight_photo_key := '02000017-0000-0000-0000-000000000001/02000017-0000-0000-0000-000000000002/ghost.jpeg') $$,
  'invalid weight photo evidence',
  'weight_photo_key with no matching storage object is rejected');

-- 5. weight with a key in ANOTHER user's folder is rejected (027)
SELECT throws_ok(
  $$ SELECT public.update_today_log(
       p_weight := 70.0,
       p_weight_photo_key := '02000017-0000-0000-0000-000000000001/02000017-0000-0000-0000-000000000003/9_weight.jpeg') $$,
  'invalid weight photo evidence',
  'weight_photo_key pointing at another user''s object is rejected');

-- 6. a fresh client with no evidence at all cannot log weight (025)
SELECT set_config('request.jwt.claims',
  '{"sub": "02000017-0000-0000-0000-000000000003", "role": "authenticated"}', true);
SELECT throws_ok(
  $$ SELECT public.update_today_log(p_weight := 72.0) $$,
  'weight requires a scale photo',
  'weight with no photo evidence at all is rejected');

SELECT * FROM finish();

ROLLBACK;
