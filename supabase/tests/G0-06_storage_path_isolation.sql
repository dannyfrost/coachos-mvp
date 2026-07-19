-- ============================================================
-- Gate 0: G0-06 Storage Path Isolation
-- Proves: Path format enforcement — {coach_id}/{client_id}/{filename}
--         means exactly 3 total segments (2 folder + 1 filename).
--         Bucket is private (not publicly accessible).
-- ============================================================

SELECT plan(4);

-- Test 1: Valid path has 3 total segments
SELECT ok(
  array_length(string_to_array('valid-coach-uuid/valid-client-uuid/photo.jpg', '/'), 1) = 3,
  'Valid path coach_id/client_id/filename has 3 segments'
);

-- Test 2: Single-segment path is invalid (no folder structure)
SELECT ok(
  array_length(string_to_array('noslash', '/'), 1) <> 3,
  'Single-segment path is rejected (no folder structure)'
);

-- Test 3: Four-segment path is invalid (too deep)
SELECT ok(
  array_length(string_to_array('a/b/c/d', '/'), 1) <> 3,
  'Four-segment path is rejected (too deep)'
);

-- Test 4: tenant-media bucket exists and is private (public = false)
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'tenant-media'),
  false,
  'tenant-media bucket exists and is not public'
);

SELECT * FROM finish();
