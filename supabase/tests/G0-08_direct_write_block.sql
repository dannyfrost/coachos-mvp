-- ============================================================
-- Gate 0: G0-08 Direct Write Block
-- Proves: 011_revoke_grants revoked INSERT/UPDATE privileges on
--         messages, flash_cards, and platform_users for the
--         authenticated role (S-03, S-07, S-08).
-- ============================================================

SELECT plan(4);

-- Test 1: authenticated has no UPDATE on messages (S-03)
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.messages', 'UPDATE'),
  'authenticated role has no UPDATE privilege on messages (S-03)'
);

-- Test 2: authenticated has no INSERT on messages (S-07)
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  'authenticated role has no INSERT privilege on messages (S-07)'
);

-- Test 3: authenticated has no UPDATE on flash_cards (S-03)
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.flash_cards', 'UPDATE'),
  'authenticated role has no UPDATE privilege on flash_cards (S-03)'
);

-- Test 4: authenticated has no UPDATE on platform_users (S-08)
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.platform_users', 'UPDATE'),
  'authenticated role has no UPDATE privilege on platform_users (S-08)'
);

SELECT * FROM finish();
