-- ============================================================
-- Gate 0: G0-14 Forbidden Permission Check
-- Proves: Permissions declared OUT OF MVP (P-03, S-08) are
--         absent from role_permissions. client cannot see own
--         flash card (no flash_cards:read in client role).
-- ============================================================

SELECT plan(5);

-- Test 1: tenants:suspend is absent (P-03 — super_admin moderation OUT of MVP)
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'tenants:suspend'),
  0::bigint,
  'tenants:suspend is absent from role_permissions (P-03)'
);

-- Test 2: users:ban is absent (P-03)
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'users:ban'),
  0::bigint,
  'users:ban is absent from role_permissions (P-03)'
);

-- Test 3: users:restore is absent (P-03)
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'users:restore'),
  0::bigint,
  'users:restore is absent from role_permissions (P-03)'
);

-- Test 4: own_profile:write is absent (S-08 — deferred to RPC)
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'own_profile:write'),
  0::bigint,
  'own_profile:write is absent from role_permissions (S-08 deferred to RPC)'
);

-- Test 5: flash_cards:read is absent for the client role (client cannot see own flash card)
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'client'
       AND rp.permission = 'flash_cards:read'
  ),
  0::bigint,
  'client role has no flash_cards:read permission (client cannot see own flash card)'
);

SELECT * FROM finish();
