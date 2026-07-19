-- ============================================================
-- Gate 0: G0-11 Default Deny
-- Proves: A table with RLS enabled but no policies returns 0
--         rows to authenticated and anon roles. DDL inside a
--         transaction is transactional (confirmed by test 3).
-- ============================================================

BEGIN;

SELECT plan(3);

-- Create a test table with RLS enabled but no policies
CREATE TABLE public.g0_11_rls_test (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data text
);
ALTER TABLE public.g0_11_rls_test ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.g0_11_rls_test TO authenticated, anon;

-- Insert a row as postgres (superuser bypasses RLS)
INSERT INTO public.g0_11_rls_test (data) VALUES ('test row');

-- Test 1: authenticated sees 0 rows (no policy → default deny)
SELECT set_config('request.jwt.claims',
  '{"sub": "11000001-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT COUNT(*) FROM public.g0_11_rls_test),
  0::bigint,
  'authenticated sees 0 rows from RLS-enabled table with no policies (default deny)'
);
SET LOCAL ROLE postgres;

-- Test 2: anon sees 0 rows (no policy → default deny)
SET LOCAL ROLE anon;
SELECT is(
  (SELECT COUNT(*) FROM public.g0_11_rls_test),
  0::bigint,
  'anon sees 0 rows from RLS-enabled table with no policies (default deny)'
);
SET LOCAL ROLE postgres;

-- Test 3: postgres superuser sees 1 row (RLS bypassed — data exists in transaction)
SELECT is(
  (SELECT COUNT(*) FROM public.g0_11_rls_test),
  1::bigint,
  'postgres superuser sees 1 row (RLS bypassed — confirms data exists before ROLLBACK)'
);

SELECT * FROM finish();

ROLLBACK;
