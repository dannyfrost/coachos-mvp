-- ============================================================
-- Gate 0: G0-13 Role-Type Consistency
-- Proves: Two-layer role model (N-10) — platform_users.role_type
--         enum has exactly 4 values; senior_assistant and
--         billing_operations are roles-table entries only, not
--         role_type enum values.
-- ============================================================

SELECT plan(5);

-- Test 1: role_type enum has exactly 4 values in the correct order.
--         Cast enumlabel (name type) to text for is() comparison.
SELECT is(
  (
    SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
     WHERE pg_type.typname = 'role_type'
  ),
  ARRAY['super_admin', 'coach', 'assistant', 'client']::text[],
  'role_type enum has exactly 4 values: super_admin, coach, assistant, client'
);

-- Test 2: senior_assistant exists in roles table (staff role, not enum)
SELECT ok(
  EXISTS (SELECT 1 FROM public.roles WHERE name = 'senior_assistant'),
  'senior_assistant exists as a roles-table entry (staff role)'
);

-- Test 3: billing_operations exists in roles table (staff role, not enum)
SELECT ok(
  EXISTS (SELECT 1 FROM public.roles WHERE name = 'billing_operations'),
  'billing_operations exists as a roles-table entry (staff role)'
);

-- Test 4: senior_assistant is NOT a role_type enum value
SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
     WHERE pg_type.typname = 'role_type'
       AND enumlabel = 'senior_assistant'
  ),
  'senior_assistant is not a role_type enum value'
);

-- Test 5: billing_operations is NOT a role_type enum value
SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
     WHERE pg_type.typname = 'role_type'
       AND enumlabel = 'billing_operations'
  ),
  'billing_operations is not a role_type enum value'
);

SELECT * FROM finish();
