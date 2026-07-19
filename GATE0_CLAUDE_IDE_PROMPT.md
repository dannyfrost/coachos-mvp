Implement Gate 0 — pgTAP Security Acceptance Suite.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing Gate 0 for the Coaching Platform MVP. Gate 0 is a suite of 16 pgTAP SQL test files that must all pass before any Tier 1 work begins.

Repo: E:\Claude-project-Coaching-app-MVP
Migrations 001–013 are IMMUTABLE. Do not touch them.
Do not modify any application source code.
Do not run supabase db push. Do not run supabase db reset.
Do not commit or push.

Control files to read before writing any test:
- DECISIONS.md (especially D-G0-01 through D-G0-05, N-10, S-03, S-07, S-08, P-01, P-03)
- ROLE_SEED_MATRIX.md (canonical permission matrix — 6 roles, 46 permissions)
- supabase/migrations/006_private_schema.sql (private helper functions)
- supabase/migrations/008_rls_policies.sql (RLS policies — 82 policies)
- supabase/migrations/010_rpc_functions.sql (RPC functions — 23 RPCs)
- supabase/migrations/011_revoke_grants.sql (table-level revokes)
- supabase/migrations/013_seed_data.sql (seed roles and permissions)

---

STEP 0: VERIFY PREREQUISITES

Run these commands and report the output before writing any files.

Confirm local Supabase is running:
npx supabase@2.98.2 status

Confirm 13 migrations are applied:
npx supabase@2.98.2 db query --local "SELECT migration_name FROM supabase_migrations.schema_migrations ORDER BY migration_name;"

Confirm latest commit is 6c6fd1d or later:
git --no-pager log --oneline -5

If any of these fail, stop and report. Do not proceed.

---

STEP 1: INSTALL pgTAP

pgTAP is not installed by default and is lost on every db reset. Install it now:

npx supabase@2.98.2 db query --local "CREATE EXTENSION IF NOT EXISTS pgtap;"

Confirm installation:
npx supabase@2.98.2 db query --local "SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'pgtap';"

installed_version must not be null. If it is null, stop and report.

---

STEP 2: CREATE TEST DIRECTORY

Create the directory supabase/tests/ if it does not already exist. Do not create tests/gate0/ — that path is abandoned (D-G0-02).

---

STEP 3: WRITE 16 TEST FILES

Write all 16 files to supabase/tests/. Each file must:
- Begin with SELECT plan(N); where N is the exact number of tests in that file.
- End with SELECT * FROM finish();
- Wrap all test data inserts in a transaction that is rolled back at the end (D-G0-04). Pattern:

  BEGIN;
    -- INSERT test data here
    SELECT is( ... );
    SELECT ok( ... );
  ROLLBACK;

  The plan() and finish() calls go OUTSIDE the BEGIN/ROLLBACK block. Pattern:

  SELECT plan(N);
  BEGIN;
    [test data + assertions]
  ROLLBACK;
  SELECT * FROM finish();

- Use set_config('request.jwt.claims', ..., true) and set_config('role', ..., true) to simulate authenticated users. Pattern for setting auth context:

  SELECT set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

- Use reset_config or SET LOCAL ROLE postgres after each user simulation block to reset context.


FILE: supabase/tests/G0-01_cross_tenant_isolation.sql

Prove: A coach in Tenant A cannot read, write, or delete any row belonging to Tenant B.

Setup: Insert two coaches (Tenant A, Tenant B) with corresponding platform_users rows. Insert one client per tenant.

Tests to write (suggested count 8):
1. Coach A authenticated — SELECT on clients returns 0 rows from Tenant B.
2. Coach A authenticated — SELECT on flash_cards returns 0 rows from Tenant B client.
3. Coach A authenticated — SELECT on daily_logs returns 0 rows from Tenant B client.
4. Coach A authenticated — SELECT on messages returns 0 rows from Tenant B thread.
5. Coach A authenticated — SELECT on plans returns 0 rows from Tenant B.
6. Coach A authenticated — INSERT into clients with coach_id = Tenant B raises error or inserts 0 rows (policy blocks it).
7. Coach A authenticated — UPDATE on coaches row of Tenant B raises error or affects 0 rows.
8. Coach A authenticated — DELETE on clients of Tenant B raises error or affects 0 rows.

All assertions use ok() or is() from pgTAP.


FILE: supabase/tests/G0-02_client_isolation.sql

Prove: A client cannot access another client's data within the same tenant.

Setup: Insert one coach (Tenant A). Insert two clients under Tenant A.

Tests (suggested count 5):
1. Client 1 authenticated — SELECT on clients returns only their own row (count = 1).
2. Client 1 authenticated — SELECT on flash_cards returns 0 rows for Client 2.
3. Client 1 authenticated — SELECT on daily_logs returns 0 rows for Client 2.
4. Client 1 authenticated — SELECT on messages returns 0 rows for Client 2 thread.
5. Client 1 authenticated — SELECT on client_plan_assignments returns 0 rows for Client 2.


FILE: supabase/tests/G0-03_assistant_scope.sql

Prove: A standard assistant sees only their assigned clients, not all clients in the tenant.

Setup: Insert one coach (Tenant A). Insert two clients. Insert one assistant. Create client_staff_assignments row linking assistant to Client 1 only (not Client 2). Insert one active staff_assignments row for the assistant (role = 'assistant').

Tests (suggested count 6):
1. Assistant authenticated — SELECT on clients returns exactly 1 row (Client 1).
2. Assistant authenticated — SELECT on clients returns 0 rows for Client 2.
3. Assistant authenticated — SELECT on flash_cards returns 0 rows for Client 2.
4. Assistant authenticated — SELECT on daily_logs returns 0 rows for Client 2.
5. Assistant authenticated — SELECT on messages returns 0 rows for Client 2 thread.
6. Assistant authenticated — SELECT on staff_assignments returns 0 rows (cannot see team).


FILE: supabase/tests/G0-04_senior_assistant_scope.sql

Prove: A senior assistant sees all clients in their tenant, but not clients in other tenants.

Setup: Insert two coaches (Tenant A, Tenant B). Insert two clients under Tenant A and one under Tenant B. Insert one senior_assistant under Tenant A with staff_assignments.role_id pointing to the senior_assistant role.

Tests (suggested count 5):
1. Senior assistant authenticated — SELECT on clients returns 2 rows (both Tenant A clients).
2. Senior assistant authenticated — SELECT on clients returns 0 rows for Tenant B client.
3. Senior assistant authenticated — SELECT on flash_cards returns rows for both Tenant A clients.
4. Senior assistant authenticated — SELECT on staff_assignments returns at least 1 row (can see team).
5. Senior assistant authenticated — SELECT on clients for Tenant B returns 0 rows.


FILE: supabase/tests/G0-05_coach_scope.sql

Prove: A coach sees only their own tenant's data.

Setup: Two coaches (Tenant A, Tenant B) each with clients, plans, and flash_cards.

Tests (suggested count 6):
1. Coach A authenticated — SELECT on clients returns only Tenant A clients.
2. Coach A authenticated — SELECT on coaches returns only their own coaches row.
3. Coach A authenticated — SELECT on plans returns only Tenant A plans.
4. Coach A authenticated — SELECT on flash_cards returns only Tenant A flash_cards.
5. Coach A authenticated — SELECT on staff_assignments returns only Tenant A staff.
6. Coach A authenticated — SELECT on billing_subscriptions returns only Tenant A billing.


FILE: supabase/tests/G0-06_storage_path_isolation.sql

Prove: Storage path enforcement — path must be {coach_id}/{client_id}/{filename} with exactly 2 folders.

Note: Direct storage policy testing via pgTAP is limited. Test the path enforcement logic inline using the foldername/array_length functions that the storage policies use.

Tests (suggested count 4):
1. ok( array_length(string_to_array('valid-uuid/client-uuid/photo.jpg', '/'), 1) = 3 ) — valid path has 3 segments.
2. ok( array_length(string_to_array('no-slash', '/'), 1) != 3 ) — single segment rejected.
3. ok( array_length(string_to_array('a/b/c/d', '/'), 1) != 3 ) — four segments rejected.
4. Confirm the tenant-media bucket exists and is private: SELECT is( (SELECT public FROM storage.buckets WHERE id = 'tenant-media'), false );


FILE: supabase/tests/G0-07_service_role_guard.sql

Prove: anon and authenticated roles cannot escalate to service role capabilities.

Tests (suggested count 4):
1. anon role — SELECT on platform_users returns 0 rows (RLS blocks all anon reads).
2. anon role — SELECT on clients returns 0 rows.
3. authenticated role with no platform_users row — SELECT on clients returns 0 rows.
4. Confirm RLS is enabled on platform_users: SELECT is( (SELECT rowsecurity FROM pg_class WHERE relname = 'platform_users' AND relnamespace = 'public'::regnamespace), true );


FILE: supabase/tests/G0-08_direct_write_block.sql

Prove: Direct UPDATE on messages and flash_cards is rejected for authenticated role. Direct INSERT on messages is rejected. Direct UPDATE on platform_users is rejected.

These are enforced by 011_revoke_grants.sql. Test by checking pg_class privileges, not by attempting writes (attempting writes in pgTAP is complex).

Tests (suggested count 4):
1. Confirm authenticated role has no UPDATE privilege on messages: SELECT ok( NOT has_table_privilege('authenticated', 'public.messages', 'UPDATE') );
2. Confirm authenticated role has no INSERT privilege on messages: SELECT ok( NOT has_table_privilege('authenticated', 'public.messages', 'INSERT') );
3. Confirm authenticated role has no UPDATE privilege on flash_cards: SELECT ok( NOT has_table_privilege('authenticated', 'public.flash_cards', 'UPDATE') );
4. Confirm authenticated role has no UPDATE privilege on platform_users: SELECT ok( NOT has_table_privilege('authenticated', 'public.platform_users', 'UPDATE') );


FILE: supabase/tests/G0-09_rpc_correctness.sql

Prove: Key RPCs execute successfully with valid inputs and return expected shapes.

Note: RPCs that require auth.uid() context need set_config simulation. Test a representative subset — not all 23 RPCs.

Tests (suggested count 6):
1. send_message RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_message' AND pronamespace = 'public'::regnamespace) );
2. create_client_invite RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_client_invite' AND pronamespace = 'public'::regnamespace) );
3. update_flash_card_notes RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_flash_card_notes' AND pronamespace = 'public'::regnamespace) );
4. assign_plan RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_plan' AND pronamespace = 'public'::regnamespace) );
5. confirm_client_payment RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_client_payment' AND pronamespace = 'public'::regnamespace) );
6. log_daily_check_in RPC exists: SELECT ok( EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_daily_check_in' AND pronamespace = 'public'::regnamespace) );


FILE: supabase/tests/G0-10_trigger_correctness.sql

Prove: Role-enforcement triggers fire correctly.

Tests (suggested count 4):
1. Trigger platform_users_lock_role_type exists on platform_users: SELECT ok( EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'platform_users_lock_role_type') );
   (Use the exact trigger name from 005_triggers.sql — read the file to confirm the name.)
2. Attempting to UPDATE platform_users.role_type on an existing row raises an exception (wrap in a transaction that rolls back): BEGIN; UPDATE public.platform_users SET role_type = 'coach' WHERE id = (SELECT id FROM public.platform_users LIMIT 1); ROLLBACK; — use throws_ok() or lives_ok() as appropriate.
3. Confirm updated_at trigger exists on at least one table: SELECT ok( EXISTS (SELECT 1 FROM pg_trigger WHERE tgname LIKE '%updated_at%') );
4. Confirm created_at is populated on insert for platform_users (if trigger exists).


FILE: supabase/tests/G0-11_default_deny.sql

Prove: A new table with no RLS policy returns zero rows to all non-service roles.

Tests (suggested count 3):
1. Create a test table with RLS enabled but no policies. Confirm authenticated role sees 0 rows after an insert as postgres. Drop the table in the rollback.
2. Confirm anon role sees 0 rows from the same test table.
3. Confirm the test table is cleaned up (the rollback handles it — verify via information_schema after rollback).


FILE: supabase/tests/G0-12_private_helpers.sql

Prove: Private helper functions return correct results for each role type.

Tests (suggested count 8):
1. get_my_role() returns 'coach' for a simulated coach.
2. get_my_role() returns 'assistant' for a simulated assistant.
3. get_my_role() returns 'client' for a simulated client.
4. get_my_role() returns NULL for a user with no platform_users row.
5. get_my_coach_id() returns the coach's own id for a coach.
6. is_my_assigned_client() returns true for an assigned client, false for an unassigned one (assistant context).
7. has_permission('clients:read') returns true for a user with that permission seeded; false for a user without it.
8. is_tenant_member() returns true for a user in the same tenant; false for a user in a different tenant.


FILE: supabase/tests/G0-13_role_type_consistency.sql

Prove: Every seeded role name is consistent with the two-layer role model (D-G0-03, N-10).

Tests (suggested count 5):
1. Confirm 'super_admin', 'coach', 'assistant', 'client' are the only values in the role_type enum: SELECT is( (SELECT array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'role_type'), ARRAY['super_admin','coach','assistant','client']::text[] );
2. Confirm senior_assistant role exists in roles table (staff role, not enum): SELECT ok( EXISTS (SELECT 1 FROM public.roles WHERE name = 'senior_assistant') );
3. Confirm billing_operations role exists in roles table (staff role, not enum): SELECT ok( EXISTS (SELECT 1 FROM public.roles WHERE name = 'billing_operations') );
4. Confirm senior_assistant is NOT a role_type enum value: SELECT ok( NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'role_type' AND enumlabel = 'senior_assistant') );
5. Confirm billing_operations is NOT a role_type enum value: SELECT ok( NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'role_type' AND enumlabel = 'billing_operations') );


FILE: supabase/tests/G0-14_forbidden_permissions.sql

Prove: OUT-OF-MVP permissions are absent from role_permissions (P-03, D-G0-03).

Tests (suggested count 5):
1. 'tenants:suspend' is not in role_permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'tenants:suspend'), 0::bigint );
2. 'users:ban' is not in role_permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'users:ban'), 0::bigint );
3. 'users:restore' is not in role_permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'users:restore'), 0::bigint );
4. 'own_profile:write' is not in role_permissions (S-08 deferred to RPC): SELECT is( (SELECT COUNT(*) FROM public.role_permissions WHERE permission = 'own_profile:write'), 0::bigint );
5. 'flash_cards:read' is not in client role_permissions (clients cannot see their own flash card): SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'client' AND rp.permission = 'flash_cards:read'), 0::bigint );


FILE: supabase/tests/G0-15_super_admin_isolation.sql

Prove: super_admin role cannot read message content and cannot access flash_card data (D-G0-03).

Tests (suggested count 4):
1. 'messages:read' is not in super_admin role_permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'super_admin' AND rp.permission = 'messages:read'), 0::bigint );
2. 'flash_cards:read' is not in super_admin role_permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'super_admin' AND rp.permission = 'flash_cards:read'), 0::bigint );
3. Confirm super_admin only has exactly 4 permissions (tenants:read, billing:read, audit_log:read, clients:read): SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'super_admin'), 4::bigint );
4. Confirm super_admin has 'clients:read' (moderation access permitted): SELECT ok( EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'super_admin' AND rp.permission = 'clients:read') );


FILE: supabase/tests/G0-16_seed_data_baseline.sql

Prove: Seed data matches ROLE_SEED_MATRIX.md exactly (D-G0-03).

Tests (suggested count 7):
1. Exactly 6 roles exist: SELECT is( (SELECT COUNT(*) FROM public.roles), 6::bigint );
2. Exactly 46 role_permissions rows exist: SELECT is( (SELECT COUNT(*) FROM public.role_permissions), 46::bigint );
3. All 6 roles have locked = true: SELECT is( (SELECT COUNT(*) FROM public.roles WHERE locked = false), 0::bigint );
4. All role_permissions have granted = true: SELECT is( (SELECT COUNT(*) FROM public.role_permissions WHERE granted = false), 0::bigint );
5. super_admin has exactly 4 permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'super_admin'), 4::bigint );
6. coach has exactly 15 permissions: SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'coach'), 15::bigint );
7. senior_assistant has exactly 10 permissions (including modify_plans and clients:read_team_scope): SELECT is( (SELECT COUNT(*) FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.name = 'senior_assistant'), 10::bigint );

---

STEP 4: RUN THE SUITE

After writing all 16 files, run the full suite:

npx supabase@2.98.2 test db

Report the full output. Do not summarize or truncate.

---

STEP 5: REPORT

After the suite runs, report:
- Pass/fail status for each of the 16 files
- Any failing assertions with exact error text
- Total test count and failing count

If any file fails:
- Stop. Do not attempt fixes.
- Report the exact failing assertion and the file name.
- Wait for founder approval before making any changes.

If all files pass:
- Report: "Gate 0 PASS — all 16 test files pass. Awaiting PROJECT_STATE.md update instruction."
- Do not update PROJECT_STATE.md or TASK_LOG.md without explicit instruction.
- Do not commit or push.

---

RULES THAT MUST NOT BE VIOLATED

- Do not modify supabase/migrations/001 through 013.
- Do not modify packages/supabase/database.types.ts.
- Do not create any files outside supabase/tests/ and this task scope.
- Do not run supabase db push or supabase db reset.
- Do not commit or push.
- Do not mention or reference vip_groups, vip_group_members, vip_group_posts, vip_post_reactions in any context (P-01).
- Do not seed tenants:suspend, users:ban, or users:restore — these are OUT OF MVP (P-03).
- The Supabase CLI native binary is not installed. Use npx supabase@2.98.2 for all CLI commands.
