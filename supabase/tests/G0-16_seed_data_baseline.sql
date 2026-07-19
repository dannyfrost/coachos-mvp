-- ============================================================
-- Gate 0: G0-16 Seed Data Baseline
-- Proves: 013_seed_data seeded exactly 6 roles and 46
--         role_permissions rows, all locked and granted,
--         with correct per-role counts (ROLE_SEED_MATRIX.md).
-- ============================================================

SELECT plan(7);

-- Test 1: Exactly 6 roles exist
SELECT is(
  (SELECT COUNT(*) FROM public.roles),
  6::bigint,
  'Exactly 6 roles seeded'
);

-- Test 2: Exactly 46 role_permissions rows exist
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions),
  46::bigint,
  'Exactly 46 role_permissions rows seeded'
);

-- Test 3: All 6 roles have locked = true
SELECT is(
  (SELECT COUNT(*) FROM public.roles WHERE locked = false),
  0::bigint,
  'All seeded roles have locked = true'
);

-- Test 4: All role_permissions have granted = true
SELECT is(
  (SELECT COUNT(*) FROM public.role_permissions WHERE granted = false),
  0::bigint,
  'All seeded role_permissions have granted = true'
);

-- Test 5: super_admin has exactly 4 permissions
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'super_admin'
  ),
  4::bigint,
  'super_admin has exactly 4 permissions'
);

-- Test 6: coach has exactly 15 permissions
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'coach'
  ),
  15::bigint,
  'coach has exactly 15 permissions'
);

-- Test 7: senior_assistant has exactly 10 permissions
--         (includes modify_plans and clients:read_team_scope)
SELECT is(
  (
    SELECT COUNT(*)
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
     WHERE r.name = 'senior_assistant'
  ),
  10::bigint,
  'senior_assistant has exactly 10 permissions (including modify_plans and clients:read_team_scope)'
);

SELECT * FROM finish();
