-- ============================================================
-- Gate 0: G0-15 Super Admin Isolation
-- Proves: super_admin cannot read message content or flash card
--         data; moderation write paths are absent; only the 4
--         permitted permissions are seeded (N-10, P-03).
-- ============================================================

SELECT plan(4);

-- Test 1: messages:read is absent for super_admin (founder decision 2026-05-15)
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'super_admin'
       AND rp.permission = 'messages:read'
  ),
  0::bigint,
  'super_admin has no messages:read permission (no message content access)'
);

-- Test 2: flash_cards:read is absent for super_admin
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'super_admin'
       AND rp.permission = 'flash_cards:read'
  ),
  0::bigint,
  'super_admin has no flash_cards:read permission'
);

-- Test 3: super_admin has exactly 4 permissions
--         (tenants:read, billing:read, audit_log:read, clients:read)
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'super_admin'
  ),
  4::bigint,
  'super_admin has exactly 4 role_permissions rows'
);

-- Test 4: super_admin has clients:read (moderation view is permitted)
SELECT ok(
  EXISTS (
    SELECT 1
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'super_admin'
       AND rp.permission = 'clients:read'
  ),
  'super_admin has clients:read for moderation read access'
);

SELECT * FROM finish();
