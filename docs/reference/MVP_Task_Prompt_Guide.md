**Task-by-Task Prompt Guide**

Coaching Platform — MVP

Solo Builder + Claude Code Execution

55 Tasks • 7 Tiers • 7 Gates • Ready-to-Paste Prompts

# How to Use This Guide

**This document converts the Build Sequencing tasks into individual Claude Code prompts. Each prompt is self-contained and references the correct spec section.**

## Session Start Checklist

**Do this EVERY time before opening Claude Code:**

**1. Open PROJECT_STATE.md — read current state.**

**2. Confirm: what is the current approved task?**

**3. Confirm: are all dependencies met?**

**4. Open this guide — find the current task.**

**5. Copy the spec excerpt for this task from the relevant spec document.**

**6. Assemble the prompt using the template below.**

**7. Only then: start Claude Code.**

## Prompt Template

**Every prompt to Claude Code must follow this structure:**

Task ID: [from this guide]

Context:

We are building a multi-tenant coaching platform.

Read PROJECT_STATE.md for current state.

Read DECISIONS.md for locked conventions.

The following spec excerpt is the source of truth for this task.

Relevant spec:

[PASTE THE EXACT SPEC EXCERPT HERE]

Task:

[EXACT TASK DESCRIPTION FROM THIS GUIDE]

Files to create/modify:

[LIST FROM THIS GUIDE]

Files NOT to modify:

[LIST FROM THIS GUIDE]

Constraints:

- No architecture changes beyond this task

- No renaming of stable entities

- No extra endpoints or tables not in the spec

- Follow existing naming conventions from DECISIONS.md

- [ADDITIONAL CONSTRAINTS FROM THIS GUIDE]

Acceptance criteria:

[LIST FROM THIS GUIDE]

After implementation:

- Update PROJECT_STATE.md (mark task in progress/needs verification)

- List all files created or modified

- Run existing tests and report results

## Task Size Rule

**If a task touches more than 3–4 files, spans multiple layers (DB + API + frontend), or is likely to generate a large amount of code, decompose it into sub-tasks before prompting Claude Code. This guide pre-decomposes large tasks where needed.**

## Recovery Protocol

**If Claude Code produces broken output:**

**1. Do NOT attempt to fix it with another Claude Code prompt layered on top.**

**2. git stash or git revert to the last known-good state.**

**3. Re-read PROJECT_STATE.md.**

**4. Re-scope the task (make it smaller or clearer).**

**5. Re-prompt with the corrected/smaller scope.**

**Layering fixes on top of broken code creates compounding errors.**

## Regression Rule

**After every task, run ALL existing tests. If any previously passing test fails, the task is not accepted until the regression is fixed. New work must never break old work.**

# PROJECT_STATE.md Template

**Create this file in the project root before starting any work. Claude Code must read it at the start of every session.**

# PROJECT STATE

## Project Identity

- Project: Coaching Platform MVP

- Repo: coaching-platform

- Branch: main

- Environment: development

- Current Tier: 0 (Foundation)

- Current Task: T0-01

- Last Updated: [date]

## Locked Decisions

- See DECISIONS.md

## Current Status

### Completed

(none yet)

### In Progress

- T0-01: Create enum types migration

### Needs Verification

(none)

### Blocked

(none)

### Next Up

- T0-02: Create tables migration

## Current Build Chain

- Tier: 0 (Foundation)

- Chain: 1 (Foundation)

- Task: T0-01

- Dependencies: None (first task)

## Files Touched Recently

(none yet)

## Verification Log

| Task | Built | Tested | Result | Commit |

|------|-------|--------|--------|--------|

(none yet)

## Open Decisions

(none)

## Rules for Claude Code

1. Read this file before starting any task

2. Only work on the task listed under In Progress

3. Do not change locked decisions unless instructed

4. Do not mark tasks complete without verification

5. Do not work on multiple unapproved tasks

6. Keep changes scoped to the approved task

7. Update this file after implementation

8. Run all existing tests after implementation

# DECISIONS.md Template

**Create this file in the project root. Required from day one.**

# DECISIONS

## Architecture

- Multi-tenant: coach_id as tenant anchor on every scoped table

- Auth: Supabase Auth. No app-layer password storage

- DB: Supabase Cloud PostgreSQL with RLS

- Web: Next.js on Vercel

- Mobile: React Native / Expo

- Billing: Stripe (single tier MVP)

- Storage: Supabase private buckets, signed URLs, path = {coach_id}/{client_id}/{filename}

- Backup: Cloudflare R2 (recommended for pilot, required pre-launch)

## Naming Conventions

- Tables: snake_case plural (e.g., daily_logs, flash_cards)

- Columns: snake_case (e.g., coach_id, created_at)

- Enums: snake_case values (e.g., trial_active, paid_active)

- RPC functions: snake_case (e.g., send_message, confirm_client_payment)

- API routes: kebab-case paths (e.g., /api/stripe/create-checkout)

- React components: PascalCase (e.g., FlashCardGrid, ClientProfile)

- TypeScript files: camelCase or kebab-case (e.g., supabase.ts, flash-cards.ts)

## Security

- RLS enabled on all 20 tables. No exceptions

- Service role key: server-only. Never in frontend or SSR responses

- Direct UPDATE revoked on messages and flash_cards for authenticated role

- Composite FKs enforce tenant integrity even when RLS is bypassed

- Storage: private buckets only. Path segments enforced by Storage RLS

- Activation tokens: hashed (never stored raw), with expiry, one-time use

## Product Rules

- VIP Group: gated (MVP+community track). Do not build unless explicitly approved

- Flash card: computed/cached record. Recomputed on new log, cron, or manual refresh

- Absence detection: disabled for paused clients

- Grace period: derived from client_subscriptions.end_date + 7 days. Not stored

- Plan deletion: sets plans.status = archived. No hard delete

- Client deactivation: sets platform_users.status = deactivated. Data preserved

- Coach inbox: client-based aggregates (one row per client). Assistant/client: participant-pairs

## Status Enums

- platform_users.status: pending | active | paused | suspended | banned | deactivated

- coaches.trial_status: trial_not_started | trial_active | trial_expired | paid_active | paid_skipped_trial

- plans.status: active | archived

- client_subscriptions.status: active | expired | overdue

- staff_assignments.status: active | disabled

- flash_cards.status: green | yellow | red

- absence_events.level: 24h | 48h | 72h

- absence_events.action_taken: pending | message_sent | escalated_to_coach | resolved

## Locked Spec Documents

- Doc 1: Database Schema (20 tables, 12 design rules, erasure matrix)

- Doc 2: RLS Policies (20 tables, 5 helpers, 2 RPCs, Storage RLS)

- Doc 3: Screen Spec (27 screens across 3 interfaces)

- Doc 4: API Endpoints (20 RPCs, 16 routes, 4 cron jobs)

- Doc 5: Interoperability & Backup

- Doc 6: Build Sequencing (55 tasks, 7 tiers, 7 gates)

- Doc 7: Environment Setup Guide

# TIER 0: FOUNDATION

**Tasks T0-01 through T0-06. Nothing else starts until Gate 0 passes.**

## T0-01: Create Enum Types Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-01** |
| **Context** | **First migration. Creates all PostgreSQL enum types used across the schema.** |
| **Spec Reference** | **Schema Doc → Status Enums Reference table** |
| **Task** | **Create migration file 001_create_enums.sql defining all enum types: user_status, role_type, trial_status, subscription_status, client_sub_status, staff_status, flash_status, plan_type_enum, plan_status, plan_assign_status, absence_level, absence_action, vip_member_status.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_001_create_enums.sql** |
| **Files NOT to Touch** | **All other migration files, application code, config files** |
| **Constraints** | **Use CREATE TYPE ... AS ENUM syntax. Match exact values from Schema Doc Status Enums Reference. No tables yet — enums only** |
| **Acceptance Criteria** | **Migration runs via supabase db push without errors. All enum types visible in Supabase Studio → Database → Types** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-02: Create Tables Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-02** |
| **Context** | **Second migration. Creates all 20 tables with columns, PKs, simple FKs, defaults.** |
| **Spec Reference** | **Schema Doc → all 20 table definitions (columns, types, nullable, defaults)** |
| **Task** | **Create migration file 002_create_tables.sql defining all 20 tables: platform_users, coaches, coach_subscriptions, clients, client_subscriptions, staff_assignments, client_staff_assignments, daily_logs, flash_cards, plans, plan_assignments, messages, absence_events, roles, role_permissions, vip_groups, vip_group_members, vip_group_posts, vip_post_reactions, audit_logs. Include all columns, data types, PKs, basic FKs, NOT NULL constraints, defaults, and UNIQUE constraints (e.g., UNIQUE on clients(activation_token_hash), daily_logs(client_id, log_date), role_permissions(role_id, permission), vip_post_reactions(post_id, user_id, reaction_type), absence_events(client_id, trigger_date, level), vip_groups(coach_id), staff_assignments partial unique for one active per user).** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_002_create_tables.sql** |
| **Files NOT to Touch** | **Migration 001 (already deployed). Application code. Config files** |
| **Constraints** | **Do not include composite FKs yet (those are migration 003). Do not include indexes (migration 004). Do not include triggers (migration 005). Use enum types created in 001. Follow exact column names and types from schema doc** |
| **Acceptance Criteria** | **Migration runs without errors. All 20 tables visible in Supabase Studio with correct columns and types. Simple FKs enforce referential integrity. UNIQUE constraints in place** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-03: Create Composite Constraints Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-03** |
| **Context** | **Third migration. Adds UNIQUE(id, coach_id) on parent tables and composite FKs on child tables.** |
| **Spec Reference** | **Schema Doc → Composite Constraints (Tenant Integrity) section — paste the full DDL block** |
| **Task** | **Create migration file 003_composite_constraints.sql. Add UNIQUE(id, coach_id) on: clients, plans, vip_groups, vip_group_posts. Add composite FKs on: daily_logs, flash_cards, client_subscriptions, plan_assignments (both client and plan), absence_events, vip_group_members (both group and client), client_staff_assignments, vip_post_reactions. Add CHECK(end_date >= start_date) on client_subscriptions.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_003_composite_constraints.sql** |
| **Files NOT to Touch** | **Existing migrations (already deployed). Application code** |
| **Constraints** | **Use exact constraint names from Schema Doc. Every composite FK must reference the matching UNIQUE(id, coach_id) on the parent table** |
| **Acceptance Criteria** | **Migration runs without errors. Negative test: INSERT INTO daily_logs with mismatched (client_id, coach_id) fails with FK violation** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-04: Create Indexes Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-04** |
| **Context** | **Fourth migration. Adds all recommended indexes for dashboard, messaging, and RLS performance.** |
| **Spec Reference** | **Schema Doc → Recommended Indexes section — paste the full DDL block** |
| **Task** | **Create migration file 004_indexes.sql. Add all indexes: clients(coach_id), daily_logs(coach_id, client_id, log_date DESC), flash_cards(coach_id, status), messages unread partial index, messages(coach_id, recipient_id, created_at DESC), messages(coach_id, created_at DESC), absence_events(coach_id, created_at DESC), vip_group_posts(group_id, created_at DESC). Add partial unique index for plan_assignments one-active-per-type: plan_assignments(client_id, plan_type) WHERE status='active'.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_004_indexes.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code** |
| **Constraints** | **Use exact index definitions from Schema Doc. Include partial indexes where specified** |
| **Acceptance Criteria** | **Migration runs without errors. Indexes visible in Supabase Studio. EXPLAIN on a flash_cards query by coach_id shows index usage** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-05: Create Triggers Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-05** |
| **Context** | **Fifth migration. Adds all database triggers: role-type enforcement, roles.locked, role_permissions locked.** |
| **Spec Reference** | **Schema Doc → Role-Type Consistency Triggers section — paste the full DDL block** |
| **Task** | **Create migration file 005_triggers.sql. Create functions and triggers: (1) enforce_coach_role — BEFORE INSERT OR UPDATE on coaches, rejects if platform_users.role_type != 'coach'. (2) enforce_client_role — same for clients. (3) enforce_roles_locked — BEFORE UPDATE OR DELETE on roles, blocks if locked=true, blocks unlock. (4) enforce_role_permissions_locked — BEFORE INSERT OR UPDATE OR DELETE on role_permissions, blocks if parent role is locked.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_005_triggers.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code** |
| **Constraints** | **Use LANGUAGE plpgsql. Use exact function/trigger names from Schema Doc. Triggers must fire FOR EACH ROW** |
| **Acceptance Criteria** | **Migration runs without errors. Test: INSERT into coaches for a user with role_type='assistant' fails. UPDATE roles SET name='x' WHERE locked=true fails. INSERT into role_permissions for a locked role fails** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-06a: Create Private Schema + Helper Functions Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-06a** |
| **Context** | **Sixth migration. Creates the private schema and all 5 RLS helper functions.** |
| **Spec Reference** | **RLS Doc → Helper Functions section — paste all 5 function definitions** |
| **Task** | **Create migration file 006_private_schema.sql. CREATE SCHEMA IF NOT EXISTS private. Create all 5 functions: private.get_my_role(), private.get_my_coach_id(), private.is_my_assigned_client(uuid), private.has_permission(text), private.is_tenant_member(uuid). All SECURITY DEFINER, STABLE, SET search_path = ''.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_006_private_schema.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code. Public schema** |
| **Constraints** | **Functions must be in private schema. SECURITY DEFINER is required. SET search_path = '' prevents injection. get_my_coach_id must NOT use LIMIT 1 (relies on UNIQUE partial index for one active staff assignment)** |
| **Acceptance Criteria** | **Migration runs without errors. Functions visible in Supabase Studio under private schema. Test: calling private.get_my_role() returns the correct role for a test user** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-06b: Enable RLS + Deploy Policies Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-06b** |
| **Context** | **Seventh and eighth migrations. Enables RLS on all 20 tables and deploys all policies.** |
| **Spec Reference** | **RLS Doc → Enable RLS section + all Per-Table RLS Policies** |
| **Task** | **Create migration 007_rls_enable.sql: ALTER TABLE ... ENABLE ROW LEVEL SECURITY on all 20 tables. Create migration 008_rls_policies.sql: all RLS policies for all 20 tables, exactly as defined in the RLS Doc. Include SELECT, INSERT, UPDATE, DELETE policies per role as specified.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_007_rls_enable.sql + [timestamp]_008_rls_policies.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code. Helper functions (already deployed)** |
| **Constraints** | **Use exact policy names from RLS Doc (pattern: {table}_{operation}_{role}). Policies reference helper functions in private schema. Do not create UPDATE policies for messages or flash_cards (those use RPCs)** |
| **Acceptance Criteria** | **Both migrations run without errors. Test: with RLS enabled and no matching policy, a user sees 0 rows (default-deny works). Test: authenticated as Coach A, cannot see Coach B's clients** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-06c: Create RPC Functions Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-06c** |
| **Context** | **Ninth migration. Creates all 20 public RPC functions.** |
| **Spec Reference** | **API Spec Doc → Layer 2 — Custom RPCs (all 20 RPCs)** |
| **Task** | **Create migration 009_rpc_functions.sql. Create all 20 RPCs in public schema: send_message, list_conversations, get_conversation, mark_message_read, update_flash_card_notes, refresh_flash_card, create_client_invite, regenerate_invite_token, revoke_invite, assign_plan, replace_active_plan, mark_absence_handled, resolve_absence, pause_client, unpause_client, deactivate_client, confirm_client_payment, assign_staff_to_client, remove_staff_from_client, update_staff_status, reassign_staff_clients, update_today_log, get_client_profile_summary. All SECURITY DEFINER with SET search_path = ''.** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_009_rpc_functions.sql** |
| **Files NOT to Touch** | **Existing migrations. RLS policies (already deployed)** |
| **Constraints** | **Each RPC must include tenant validation. RPCs that modify data must check caller authorization. Use helper functions (private.get_my_role(), etc.) for auth checks. Follow exact function signatures from API Spec** |
| **Acceptance Criteria** | **Migration runs without errors. All RPCs callable via supabase.rpc(). Test: send_message with invalid recipient fails. Test: update_flash_card_notes by unauthorized user fails** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

*NOTE: T0-06c is a large task (20 RPCs). If it feels too big, decompose into sub-tasks: T0-06c-1 (messaging RPCs), T0-06c-2 (flash card RPCs), T0-06c-3 (invite RPCs), T0-06c-4 (plan RPCs), T0-06c-5 (absence + client status RPCs), T0-06c-6 (staff + payment + profile RPCs). Each sub-task = one migration file or one section within the migration.*

## T0-06d: Revoke Grants + Storage Policies Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-06d** |
| **Context** | **Tenth and eleventh migrations. Revokes direct UPDATE, grants RPC execute, deploys Storage RLS.** |
| **Spec Reference** | **RLS Doc → Schema Prerequisites + Storage RLS Policies sections** |
| **Task** | **Create migration 010_revoke_grants.sql: REVOKE UPDATE ON messages FROM authenticated. REVOKE UPDATE ON flash_cards FROM authenticated. GRANT EXECUTE ON all public RPC functions TO authenticated. Create migration 011_storage_policies.sql: all Storage RLS policies on storage.objects for tenant-media bucket (INSERT by coach/client with path enforcement, SELECT by coach/assistant/client with path enforcement, DELETE by coach only).** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_010_revoke_grants.sql + [timestamp]_011_storage_policies.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code** |
| **Constraints** | **Revokes must happen AFTER RPC functions exist (they need UPDATE internally via SECURITY DEFINER). Storage policies must enforce both path segments ({coach_id}/{client_id}). Use storage.foldername(name) for path extraction** |
| **Acceptance Criteria** | **Migrations run without errors. Test: direct UPDATE on messages as authenticated user fails. Test: supabase.rpc('mark_message_read') succeeds for recipient. Test: Storage upload to wrong tenant path fails** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T0-06e: Seed Data Migration

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T0-06e** |
| **Context** | **Twelfth migration. Seeds initial roles, permissions, and Super Admin.** |
| **Spec Reference** | **Schema Doc → roles and role_permissions tables + your chosen initial values** |
| **Task** | **Create migration 012_seed_data.sql. INSERT roles: 'Assistant' (locked=true), 'Senior Assistant' (locked=true), 'Billing Operations' (locked=true). INSERT role_permissions for each role with appropriate granted flags (view_assigned_clients, send_messages, add_notes, mark_payment, modify_plans, etc.). INSERT platform_users for Super Admin (role_type='super_admin', status='active').** |
| **Files to Create/Modify** | **supabase/migrations/[timestamp]_012_seed_data.sql or supabase/seed.sql** |
| **Files NOT to Touch** | **Existing migrations. Application code** |
| **Constraints** | **All seeded roles must have locked=true. Super Admin email must be your actual admin email. Permissions must match the locked role definitions from the spec** |
| **Acceptance Criteria** | **Migration/seed runs without errors. Roles visible with locked=true. Role permissions correctly assigned. Super Admin user exists with role_type='super_admin'** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 0: Security Boundary

**DO NOT PROCEED TO TIER 1 UNTIL ALL TESTS PASS.**

## G0: RLS Acceptance Test Suite

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **G0** |
| **Context** | **Gate 0 test suite. Validates the entire security boundary before any feature work begins.** |
| **Spec Reference** | **RLS Doc → RLS Acceptance Tests section — paste all test categories** |
| **Task** | **Write and run the full RLS acceptance test suite covering: (1) Cross-tenant isolation — Coach B cannot see Coach A data. (2) Participant-scoped messages — Assistant only sees own messages. (3) Assignment-scoped data — Assistant only sees assigned clients. (4) Client self-scope — Client sees only own data. (5) VIP membership scope — Non-member sees nothing. (6) Default-deny — Drop all policies on test table, confirm 0 rows. (7) Storage cross-tenant — Upload/download to wrong tenant fails. (8) Storage intra-tenant — Client uploads to another client's folder fails. (9) Message recipient validation — Client sends to non-coach/non-assistant fails. (10) Column safety — Direct UPDATE on messages/flash_cards fails, RPCs succeed. (11) Trigger tests — Locked roles, role-type enforcement.** |
| **Files to Create/Modify** | **Test files (e.g., tests/rls/ or SQL scripts)** |
| **Files NOT to Touch** | **All migration files (already deployed). Application code** |
| **Constraints** | **Tests can be SQL scripts run via Supabase SQL Editor or automated test framework. Create test users for each role. Clean up test data after** |
| **Acceptance Criteria** | **ALL tests pass. Zero cross-tenant data leaks. Zero unauthorized writes. Document results in PROJECT_STATE.md verification log** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

*Gate 0 is the most important checkpoint in the entire build. If it fails, STOP. Do not build features on an insecure foundation. Fix the failing policies/constraints first.*

# TIER 1: AUTH & CORE LOOP

**Tasks T1-01 through T1-12. The product becomes real.**

## T1-01: Coach Signup API Route

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-01** |
| **Context** | **Server-side route for coach registration.** |
| **Spec Reference** | **API Spec → Layer 3 → Authentication → /api/auth/signup** |
| **Task** | **Create Next.js API route POST /api/auth/signup. Logic: validate email + password → create Supabase Auth user (service role) → create platform_users row (role_type='coach', status='active') → create coaches row (trial_status='trial_not_started') → return auth session.** |
| **Files to Create/Modify** | **apps/web/app/api/auth/signup/route.ts (or pages/api/auth/signup.ts)** |
| **Files NOT to Touch** | **Database migrations. RLS policies. Other API routes** |
| **Constraints** | **Use service role for user creation. Do not store password in platform_users. Set email_verified based on Supabase Auth response. Handle duplicate email gracefully** |
| **Acceptance Criteria** | **POST to /api/auth/signup with valid email+password creates all records. Duplicate email returns appropriate error. platform_users and coaches rows exist in DB after signup** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-02: Email Verification + Workspace Creation

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-02** |
| **Context** | **After email verification, coach creates workspace and trial begins.** |
| **Spec Reference** | **Schema Doc → coaches table (workspace_name, trial_status, trial_started_at, trial_expires_at)** |
| **Task** | **Extend the auth flow: after email verification, redirect coach to a workspace setup page. Coach enters workspace_name. On submit: UPDATE coaches SET workspace_name, trial_status='trial_active', trial_started_at=now(), trial_expires_at=now()+30 days. This is the trial activation trigger.** |
| **Files to Create/Modify** | **apps/web/app/(auth)/workspace-setup/page.tsx + supporting API or direct Supabase update** |
| **Files NOT to Touch** | **Signup route (already done). Migrations** |
| **Constraints** | **Trial starts on workspace creation, not on signup. trial_expires_at = trial_started_at + 30 days. If coach already has a workspace, redirect to dashboard** |
| **Acceptance Criteria** | **After workspace setup, coaches.trial_status = 'trial_active'. trial_started_at and trial_expires_at are set. Coach is redirected to dashboard** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-03: Coach Login + Post-Login Routing

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-03** |
| **Context** | **Login page with conditional routing based on trial/subscription status.** |
| **Spec Reference** | **Screen Spec → Coach Web → Login/Signup** |
| **Task** | **Create login page. On successful auth: check coaches.trial_status. If trial_expired and no active coach_subscription → redirect to /billing. If trial_active or paid_active → redirect to /dashboard. If trial_not_started → redirect to /workspace-setup.** |
| **Files to Create/Modify** | **apps/web/app/(auth)/login/page.tsx + middleware or layout-level auth check** |
| **Files NOT to Touch** | **Signup route. Workspace setup page. Migrations** |
| **Constraints** | **Use Supabase Auth for login. Post-login routing is based on DB state, not just auth state. Handle session refresh/expiry gracefully** |
| **Acceptance Criteria** | **Coach can log in. Correct redirect based on trial/subscription state. Expired coach sees billing page. Active coach sees dashboard. No-workspace coach sees setup** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-04: Client Invite Flow (RPC + Activation Route)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-04** |
| **Context** | **Coach creates pending client. Client activates via server route.** |
| **Spec Reference** | **API Spec → RPCs: create_client_invite, regenerate_invite_token, revoke_invite. Layer 3: /api/client-activation/complete** |
| **Task** | **Implement: (1) create_client_invite RPC — already in migration 009. Verify it works: creates platform_users(pending, client) + clients(coach_id, activation_token_hash, activation_expires_at), returns raw token. (2) Create server route POST /api/client-activation/complete — validate token hash + expiry → create Supabase Auth user → set status=active → clear token → return auth session.** |
| **Files to Create/Modify** | **apps/web/app/api/client-activation/complete/route.ts. RPCs already in migration** |
| **Files NOT to Touch** | **Existing migrations. Other routes. Coach screens** |
| **Constraints** | **Activation route is public (no auth required). Token is the credential. One-time use. Auth user creation uses service role. Do not expose raw token in DB** |
| **Acceptance Criteria** | **create_client_invite returns raw token. Activation route creates auth user + activates client. Second use of same token fails. Expired token fails** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-05: Invites / Activations Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-05** |
| **Context** | **Coach-facing screen to create invites, view status, resend/revoke tokens.** |
| **Spec Reference** | **Screen Spec → Coach Web → 5. Invites / Activations** |
| **Task** | **Create the Invites page at /invites. Components: (1) Create Invite form (email input → calls create_client_invite RPC → displays raw token). (2) Invite List table (client email, status, token expiry, onboarding_completed). (3) Actions: Resend (regenerate_invite_token RPC), Revoke (revoke_invite RPC). (4) Expired tokens shown with warning.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/invites/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. API routes. Migrations** |
| **Constraints** | **Use Supabase client with anon key (RLS-protected). Coach can only see own tenant invites. Display raw token clearly for coach to copy/share** |
| **Acceptance Criteria** | **Coach can create invite, see pending clients list, resend token, revoke token. List shows correct status and expiry. Only own-tenant invites visible** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-06: Client List Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-06** |
| **Context** | **Coach-facing screen showing all clients with filters.** |
| **Spec Reference** | **Screen Spec → Coach Web → 3. Client List** |
| **Task** | **Create the Client List page at /clients. Table columns: name, status, flash card status (G/Y/R), subscription end date, last check-in, assigned assistant. Filters: status, flash card status, subscription state. Search by name/email. Actions per row: Open Profile, Message, Pause/Unpause. Add Client button navigates to /invites.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/clients/page.tsx + components** |
| **Files NOT to Touch** | **Client Profile page (later task). Other screens. Migrations** |
| **Constraints** | **Query joins clients + platform_users + flash_cards + client_subscriptions + client_staff_assignments. All via PostgREST (Layer 1 reads). Filters applied as query params** |
| **Acceptance Criteria** | **Client list loads with correct data. Filters work. Search works. Actions navigate correctly. Only own-tenant clients visible** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-07: Client Mobile: Activation Screen

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-07** |
| **Context** | **Client-facing mobile screen for first-time activation.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 1. Activation** |
| **Task** | **Create the Activation flow in the mobile app. Steps: (1) Enter activation code (token). (2) Call POST /api/client-activation/complete with token + chosen password. (3) On success: store auth session, navigate to onboarding. (4) Onboarding: optional questionnaire (age, conditions). Update clients table. Set onboarding_completed=true. (5) Navigate to Home.** |
| **Files to Create/Modify** | **apps/mobile/screens/Activation.tsx + apps/mobile/screens/Onboarding.tsx** |
| **Files NOT to Touch** | **Coach web screens. API routes (activation route already built). Migrations** |
| **Constraints** | **Use Expo SecureStore for token storage. Handle expired/invalid token with clear error message. Onboarding fields are optional** |
| **Acceptance Criteria** | **Client can enter token, set password, complete onboarding. Auth session persists. onboarding_completed = true in DB. Invalid/expired tokens show error** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-08: Client Mobile: Home / Today

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-08** |
| **Context** | **Client daily logging screen. Must be completable in under 60 seconds.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 2. Home / Today + API Spec → update_today_log RPC** |
| **Task** | **Create the Home screen in the mobile app. Elements: weight input (number), steps input (number), meal description (text), meal photo (camera/gallery picker → upload via signed URL), questions (text). Submit button calls update_today_log RPC. If already submitted today, show edit mode (pre-fill values). Renewal banner if subscription expiring. Paused banner if status=paused.** |
| **Files to Create/Modify** | **apps/mobile/screens/Home.tsx + components + lib/storage.ts (signed URL helper)** |
| **Files NOT to Touch** | **Other mobile screens. Coach web. Migrations** |
| **Constraints** | **Use update_today_log RPC (upsert pattern). Photo upload: call /api/storage/signed-upload-url server route → upload to signed URL. Show previous values for reference. Disable submit if paused** |
| **Acceptance Criteria** | **Client can log weight/steps/meals/photo/questions. Data appears in daily_logs. Editing same-day log updates the row. Photo uploaded to correct tenant path. Paused client cannot submit** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-09: Signed URL Server Routes

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-09** |
| **Context** | **Server routes for Storage signed upload and download URLs.** |
| **Spec Reference** | **API Spec → Layer 3 → Storage (signed-upload-url, signed-download-url, delete-object)** |
| **Task** | **Create three server routes: (1) POST /api/storage/signed-upload-url — validate auth, validate tenant ownership, validate file type (JPEG/PNG) and size (max 5MB), validate path matches {coach_id}/{client_id}/{filename}, generate and return signed upload URL. (2) POST /api/storage/signed-download-url — validate auth + tenant, return short-lived signed download URL. (3) POST /api/storage/delete-object — validate auth + coach role + tenant ownership, delete object.** |
| **Files to Create/Modify** | **apps/web/app/api/storage/signed-upload-url/route.ts + signed-download-url/route.ts + delete-object/route.ts** |
| **Files NOT to Touch** | **Existing routes. Migrations. Mobile screens** |
| **Constraints** | **Use service role for Storage operations. Validate tenant ownership before issuing URLs. TTL for download URLs: 15 minutes. File type/size validation server-side before URL issuance** |
| **Acceptance Criteria** | **Upload URL: valid path returns signed URL, wrong tenant path returns 403. Download URL: valid tenant returns URL, wrong tenant returns 403. Delete: coach can delete own tenant media, non-coach returns 403** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-10: Flash Card Computation

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-10** |
| **Context** | **RPC for single-client recompute + cron job for batch recompute.** |
| **Spec Reference** | **API Spec → RPCs: refresh_flash_card + Layer 3: /api/flash-cards/compute + /api/flash-cards/compute-all** |
| **Task** | **Implement: (1) refresh_flash_card RPC — already in migration 009. Verify it works: reads latest daily_logs for the client, reads coaches.settings for thresholds, computes status (green/yellow/red), reason, food_summary, interpretation (rule-based), last_log_at, computed_at. Updates flash_cards row. (2) Create server route POST /api/flash-cards/compute — service role, iterates all coaches, recomputes all flash cards. Called by hourly cron. (3) Create server route POST /api/flash-cards/compute-all — coach-triggered, recomputes only their clients. Throttled.** |
| **Files to Create/Modify** | **apps/web/app/api/flash-cards/compute/route.ts + compute-all/route.ts. RPC already in migration** |
| **Files NOT to Touch** | **Existing routes. Coach screens. Migrations** |
| **Constraints** | **Computation logic must respect paused clients (skip or show paused indicator). Thresholds from coaches.settings: absence_warning_days, absence_critical_days, weight_stagnation_days. Rule-based interpretation: simple if/then (e.g., weight stable + steps high + logs consistent = stagnation despite compliance)** |
| **Acceptance Criteria** | **Flash card computes correct status for test scenarios: green (all good), yellow (missing 2 days), red (missing 4 days). Paused client shows paused. Manual refresh via RPC works. Cron route processes all coaches** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-11: Coach Dashboard

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-11** |
| **Context** | **The centerpiece screen. Flash card grid + alerts + summary stats.** |
| **Spec Reference** | **Screen Spec → Coach Web → 2. Dashboard (all sections + Flash Card Anatomy)** |
| **Task** | **Create the Dashboard page at /dashboard. Sections: (1) Flash Card Grid — one card per client showing: name, status color badge, reason, weight+steps, food summary, interpretation, notes, last update, refresh button, action buttons (Open Profile, Message, Review Diet). (2) Alerts Bar — counts of pending absence events, expiring subscriptions, unread messages. (3) Summary Stats — active/expired/pending clients, missing check-ins today. (4) Renewal banner if coach subscription expiring. Filters: status (All/G/Y/R), search by name, sort by severity/update/name.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/dashboard/page.tsx + components/FlashCard.tsx + components/AlertsBar.tsx + components/DashboardStats.tsx** |
| **Files NOT to Touch** | **Client Profile page. Other screens. Migrations** |
| **Constraints** | **Query flash_cards + clients + platform_users + absence_events + client_subscriptions + messages via PostgREST. Flash card notes editable via update_flash_card_notes RPC. Refresh button calls refresh_flash_card RPC. Paused clients show distinct indicator** |
| **Acceptance Criteria** | **Dashboard loads with flash cards. Filters work. Status colors correct. Action buttons navigate. Notes editable. Refresh recomputes card. Alerts show correct counts** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-12: Client Profile Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-12** |
| **Context** | **Full client detail view with timeline, flash card, plans, messages, absence history.** |
| **Spec Reference** | **Screen Spec → Coach Web → 4. Client Profile (all sections)** |
| **Task** | **Create Client Profile page at /clients/[id]. Sections: (1) Identity — name, age, condition notes, status. (2) Flash Card — expanded view. (3) Daily Log Timeline — scrollable day-by-day with weight, steps, meal text, meal photo (via signed download URL), questions. (4) Current Plan — active meal + workout. (5) Subscription — dates, status, confirmed by. (6) Recent Messages — last 10, link to full conversation. (7) Absence History — events timeline. (8) Assigned Staff. (9) Notes — flash card notes (editable). Actions: message, assign plan, pause/unpause, change subscription, deactivate.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/clients/[id]/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations. RLS policies** |
| **Constraints** | **Use PostgREST for reads. Photos via signed download URLs. Notes via update_flash_card_notes RPC. Pause/unpause via RPCs. Deactivate via RPC. Plan display read-only (assignment from Plans screen)** |
| **Acceptance Criteria** | **Profile loads with all sections populated. Photos display via signed URLs. Notes editable and saveable. Status change actions work. Timeline is scrollable and chronological** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# TIER 1 PARALLEL: STRIPE BILLING

**These tasks can run in parallel with T1-04 through T1-12. Stripe does not block the core loop.**

## T1-S1: Stripe Checkout + Webhook + Portal Routes

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-S1** |
| **Context** | **All three Stripe server routes.** |
| **Spec Reference** | **API Spec → Layer 3 → Stripe Integration (all 3 routes)** |
| **Task** | **Create three server routes: (1) POST /api/stripe/create-checkout — create Stripe Checkout Session using STRIPE_PRICE_ID, attach coach's stripe_customer_id (or create customer), redirect to Stripe. (2) POST /api/stripe/webhook — verify signature, handle events: customer.subscription.created → create coach_subscriptions row + set trial_status. customer.subscription.updated → update status. customer.subscription.deleted → set expired. invoice.payment_succeeded/failed → update status. (3) POST /api/stripe/customer-portal — generate portal URL, return for redirect.** |
| **Files to Create/Modify** | **apps/web/app/api/stripe/create-checkout/route.ts + webhook/route.ts + customer-portal/route.ts** |
| **Files NOT to Touch** | **Auth routes. Other routes. Migrations** |
| **Constraints** | **Use STRIPE_SECRET_KEY (server only). Webhook must verify signature using STRIPE_WEBHOOK_SECRET. Handle all subscription lifecycle states. Idempotent webhook processing. Update coaches.trial_status appropriately (paid_active, paid_skipped_trial)** |
| **Acceptance Criteria** | **Checkout redirects to Stripe. Webhook processes events and updates DB correctly. Portal URL generates and redirects. Test with Stripe CLI: stripe trigger customer.subscription.created** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T1-S2: Trial Expiry + Read-Only Enforcement

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T1-S2** |
| **Context** | **Enforce read-only state when trial expires with no active subscription.** |
| **Spec Reference** | **Screen Spec → Coach Web → Login/Signup (expired state) + Cross-Cutting → Expired/Frozen Access** |
| **Task** | **Implement trial expiry enforcement: (1) Check on every authenticated page load: if coaches.trial_status = 'trial_expired' AND no active coach_subscription → show expired banner + restrict to billing page + read-only dashboard. (2) Middleware or layout-level guard. (3) Expired banner component with subscribe CTA.** |
| **Files to Create/Modify** | **apps/web/middleware.ts or apps/web/app/(dashboard)/layout.tsx + components/ExpiredBanner.tsx** |
| **Files NOT to Touch** | **Auth routes. Stripe routes. Migrations** |
| **Constraints** | **Check must happen on every page load, not just login. Read-only means: coach can see data but cannot add/edit clients, send assignments, or use automations. Billing page must remain accessible** |
| **Acceptance Criteria** | **Expired coach sees banner on every page. Cannot create invites or modify clients. Can access /billing. After subscribing, banner disappears and full access resumes** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 1: Core Product Loop

**DO NOT PROCEED UNTIL THIS GATE PASSES.**

**CRITICAL: After Gate 1, STOP and test with at least one real coach before expanding scope further. This is not optional.**

| **Test** | **Expected Result** |
| --- | --- |
| **Coach can sign up with email** | **Account created, email verified, workspace setup triggered** |
| **Coach can create workspace** | **Trial activates, dashboard accessible** |
| **Coach can invite a client** | **Pending record created, raw token displayed** |
| **Client can activate on mobile** | **Auth user created, onboarding completed** |
| **Client can log daily data** | **daily_log row created, photo uploaded** |
| **Flash cards compute** | **Status, reason, food summary populated correctly** |
| **Dashboard shows flash cards** | **Cards render with correct data, filters work** |
| **Client Profile shows timeline** | **Daily logs, photos, subscription, absence history visible** |
| **Flash card notes editable** | **RPC updates notes field only** |
| **Stripe checkout works (test mode)** | **Subscription created, webhook updates DB** |
| **Expired trial blocks editing** | **Read-only dashboard, billing accessible** |
| **All Gate 0 tests still pass** | **No security regressions** |

*After Gate 1: you have a working product. Test it with a real coach. Collect feedback. Only then decide whether to proceed to Tier 2 or adjust the core loop based on feedback.*

# TIER 2: COMMUNICATION & RETENTION

**Three parallel workstreams. Can run simultaneously.**

## Workstream A: Messaging (4 tasks)

## T2-A1: Messaging Backend Verification

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-A1** |
| **Context** | **Verify messaging RPCs work correctly from migration 009.** |
| **Spec Reference** | **API Spec → RPCs: send_message, list_conversations, get_conversation, mark_message_read** |
| **Task** | **Test all 4 messaging RPCs with real data: (1) send_message — coach sends to client (success), client sends to coach (success), client sends to random user (fail), assistant sends to unassigned client (fail), assistant sends to coach (success). (2) list_conversations — coach sees client-aggregated inbox, client sees participant pairs. (3) get_conversation — returns correct messages, pagination works. (4) mark_message_read — only recipient can mark.** |
| **Files to Create/Modify** | **Test files. No new migrations or routes needed** |
| **Files NOT to Touch** | **Migration files. RPC functions. RLS policies** |
| **Constraints** | **RPCs already deployed. This task is verification + fixing any issues found** |
| **Acceptance Criteria** | **All messaging RPCs work correctly with proper authorization. Invalid recipients rejected. Conversation grouping correct per role** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-A2: Messages Inbox + Conversation View (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-A2** |
| **Context** | **Coach messaging screens.** |
| **Spec Reference** | **Screen Spec → Coach Web → 7. Messages Inbox + 8. Conversation View** |
| **Task** | **Create Messages Inbox at /messages: conversation list (one row per client, last message preview, timestamp, unread badge). Sort by newest, unread at top. Filter: All/Unread. Create Conversation View at /messages/[participantId]: chronological message list, compose input, auto mark-as-read on open, paginated scroll.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/messages/page.tsx + [participantId]/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Inbox uses list_conversations RPC. Conversation uses get_conversation RPC. Send uses send_message RPC. Mark read uses mark_message_read RPC. Coach sees all tenant conversations** |
| **Acceptance Criteria** | **Inbox loads with conversation list. Unread badges work. Conversation displays messages chronologically. Send works. Read receipts update** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-A3: Messages (Client Mobile)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-A3** |
| **Context** | **Client messaging screen.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 5. Messages** |
| **Task** | **Create Messages tab in mobile app. Conversation list: coach and assigned assistant(s). Tap opens chat view with chronological messages + compose. Auto mark-as-read on open.** |
| **Files to Create/Modify** | **apps/mobile/screens/Messages.tsx + components** |
| **Files NOT to Touch** | **Coach web screens. Migrations** |
| **Constraints** | **Uses same RPCs as coach web. Client can only send to coach or assigned assistant (enforced by send_message RPC). Participant-pair grouping for client** |
| **Acceptance Criteria** | **Client sees conversations with coach/assistant. Can send and receive messages. Cannot message other clients or unassigned staff** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-A4: Push Notifications for Messages

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-A4** |
| **Context** | **Expo Push Notifications triggered on new messages.** |
| **Spec Reference** | **Screen Spec → Cross-Cutting → Push Notifications** |
| **Task** | **Implement: (1) On client login, register for push token (expo-notifications). Store token in DB (add push_token column to platform_users or a separate table). (2) In send_message RPC or a trigger, detect new message → send push to recipient via Expo Push API. (3) Notification opens the messages screen.** |
| **Files to Create/Modify** | **apps/mobile/lib/notifications.ts + apps/web/app/api/notifications/send/route.ts (or trigger-based)** |
| **Files NOT to Touch** | **Other mobile screens. Coach web. Migrations (may need small schema addition for push_token)** |
| **Constraints** | **Expo Push wraps FCM/APNs. Token registration on login. Push payload includes sender name + preview. Deferred for pilot if too complex — in-app unread badges are sufficient initially** |
| **Acceptance Criteria** | **New message triggers push notification on recipient device. Tapping notification opens messages screen. Token registration works on iOS and Android** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

*T2-A4 is deferrable for private pilot. In-app unread indicators are sufficient initially.*

## Workstream B: Absence Detection (4 tasks)

## T2-B1: Absence Detection Cron

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-B1** |
| **Context** | **Background job that scans for missing client check-ins.** |
| **Spec Reference** | **API Spec → Layer 3 → /api/absence/detect** |
| **Task** | **Create server route POST /api/absence/detect. Logic: for each coach, read coaches.settings thresholds. For each active client (not paused, not deactivated), check daily_logs for last log_date. If absence >= 24h/48h/72h thresholds, create absence_event (level, action_taken=pending). Idempotent via UNIQUE(client_id, trigger_date, level).** |
| **Files to Create/Modify** | **apps/web/app/api/absence/detect/route.ts** |
| **Files NOT to Touch** | **Other routes. Coach screens. Migrations** |
| **Constraints** | **Use service role. Skip paused clients. Respect per-coach configurable thresholds. Handle timezone awareness (use coach timezone for day boundary). Idempotent: duplicate detection attempts should not create duplicate events** |
| **Acceptance Criteria** | **Cron creates absence events for missing check-ins. Paused clients skipped. Duplicate events prevented by UNIQUE constraint. Events created at correct levels (24h/48h/72h)** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-B2: Absence Reminder Cron

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-B2** |
| **Context** | **Background job that sends reminders for pending absence events.** |
| **Spec Reference** | **API Spec → Layer 3 → /api/absence/send-reminder** |
| **Task** | **Create server route POST /api/absence/send-reminder. Logic: find absence_events where action_taken='pending'. For 24h/48h events: send in-app message from assistant (or system). For 72h events: escalate to coach. Update action_taken to 'message_sent' or 'escalated_to_coach'. Respect coaches.settings escalation toggles.** |
| **Files to Create/Modify** | **apps/web/app/api/absence/send-reminder/route.ts** |
| **Files NOT to Touch** | **Other routes. Migrations** |
| **Constraints** | **Use service role. Messages sent via direct INSERT (service role bypasses RLS, relies on composite FK constraints). Check escalation toggles before sending. Do not re-send for already-handled events** |
| **Acceptance Criteria** | **Reminders sent for pending events at correct levels. 72h events escalated to coach. Already-handled events not re-sent. Messages appear in client inbox** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-B3: Absence / Follow-up Queue Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-B3** |
| **Context** | **Dedicated operational screen for managing absence events.** |
| **Spec Reference** | **Screen Spec → Coach Web → 9. Absence / Follow-up Queue** |
| **Task** | **Create Follow-up Queue at /follow-ups. Table: client name, trigger date, level (24h/48h/72h), action taken, handled by, resolved date. Filters: level, status (pending/resolved), date range. Actions: mark message sent (mark_absence_handled RPC), escalate, resolve (resolve_absence RPC), open client profile, message client. 72h pending events highlighted as urgent.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/follow-ups/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Uses absence_events + clients + platform_users via PostgREST. Actions use RPCs. Assistants see only assigned clients' events** |
| **Acceptance Criteria** | **Queue loads with correct events. Filters work. Actions update event status. Resolved events show resolved_at. 72h events visually highlighted** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-B4: Absence RPCs Verification

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-B4** |
| **Context** | **Verify mark_absence_handled and resolve_absence RPCs work correctly.** |
| **Spec Reference** | **API Spec → RPCs: mark_absence_handled, resolve_absence** |
| **Task** | **Test: (1) mark_absence_handled — coach can update any tenant event, assistant can update only assigned client events, unauthorized users rejected. (2) resolve_absence — sets resolved_at + action_taken='resolved'. (3) Verify handled_by is set to auth.uid().** |
| **Files to Create/Modify** | **Test files** |
| **Files NOT to Touch** | **Migration files. RPCs. RLS policies** |
| **Constraints** | **RPCs already deployed. This is verification + fixing issues** |
| **Acceptance Criteria** | **Both RPCs work correctly with proper authorization. handled_by and resolved_at populated correctly** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## Workstream C: Subscription Tracking (5 tasks)

## T2-C1: Client Subscription CRUD

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-C1** |
| **Context** | **Basic client subscription tracking via PostgREST.** |
| **Spec Reference** | **Schema Doc → client_subscriptions table + Screen Spec → 12. Client Subscription Tracker** |
| **Task** | **Verify client_subscriptions table works via PostgREST: coach can INSERT/UPDATE/SELECT subscriptions for own-tenant clients. CHECK(end_date >= start_date) enforced. Composite FK enforced.** |
| **Files to Create/Modify** | **Test files. No new code needed if PostgREST + RLS is working** |
| **Files NOT to Touch** | **Migrations. RLS policies** |
| **Constraints** | **Direct PostgREST writes by coach. RLS ensures tenant scope. Verify filters work (status, end_date ranges)** |
| **Acceptance Criteria** | **Coach can create, read, update client subscriptions. Cross-tenant access blocked. Date constraint enforced** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-C2: Subscription Expiry Cron

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-C2** |
| **Context** | **Background job checking subscription expiry and sending reminders.** |
| **Spec Reference** | **API Spec → Layer 3 → /api/subscriptions/check-expiry** |
| **Task** | **Create server route POST /api/subscriptions/check-expiry. Logic: find client_subscriptions where end_date is within 7 days → send renewal reminder (in-app message). Find subscriptions past end_date with status='active' → set status='expired'. Alert coach/assistant.** |
| **Files to Create/Modify** | **apps/web/app/api/subscriptions/check-expiry/route.ts** |
| **Files NOT to Touch** | **Other routes. Migrations** |
| **Constraints** | **Use service role. Send reminders as system messages. Do not auto-delete or deactivate client — just update subscription status and notify** |
| **Acceptance Criteria** | **Reminders sent 7 days before expiry. On expiry day: status set to expired. Coach/assistant notified** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-C3: Client Subscription Tracker Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-C3** |
| **Context** | **Coach-facing screen for payment tracking.** |
| **Spec Reference** | **Screen Spec → Coach Web → 12. Client Subscription Tracker** |
| **Task** | **Create Subscription Tracker at /subscriptions. Table: client name, start date, end date, status, payment confirmed by, notes. Filters: status, expiring within 7 days. Actions: confirm payment (confirm_client_payment RPC), add notes, view client profile. Highlight overdue. Show expiring-soon count.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/subscriptions/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Uses client_subscriptions + clients + platform_users via PostgREST. Confirm payment via RPC (coach + billing role only)** |
| **Acceptance Criteria** | **Tracker loads with subscriptions. Filters work. Confirm payment updates record. Overdue highlighted. Expiring-soon count displayed** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-C4: confirm_client_payment RPC Verification

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-C4** |
| **Context** | **Verify the payment confirmation RPC works correctly.** |
| **Spec Reference** | **API Spec → RPC: confirm_client_payment** |
| **Task** | **Test: (1) Coach can confirm — sets payment_confirmed_by=auth.uid(), status='active'. (2) Assistant with mark_payment permission can confirm. (3) Standard assistant without permission is rejected. (4) Cross-tenant attempt rejected.** |
| **Files to Create/Modify** | **Test files** |
| **Files NOT to Touch** | **Migration files. RPCs. RLS policies** |
| **Constraints** | **RPC already deployed. Verification + fix** |
| **Acceptance Criteria** | **Payment confirmation works for authorized users. Unauthorized rejected. payment_confirmed_by and status updated correctly** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T2-C5: Renewal Banners (Client Mobile)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T2-C5** |
| **Context** | **Warning banners on client Home and Profile screens.** |
| **Spec Reference** | **Screen Spec → Client Mobile → Home/Today (renewal banner) + Profile (subscription status)** |
| **Task** | **Add to Home screen: if client_subscriptions.end_date is within 7 days, show warning banner. If expired, show expired banner. Add to Profile screen: subscription section showing start date, end date, status, warning if expiring/expired.** |
| **Files to Create/Modify** | **apps/mobile/screens/Home.tsx (add banner) + apps/mobile/screens/Profile.tsx (add subscription section)** |
| **Files NOT to Touch** | **Other mobile screens. Coach web** |
| **Constraints** | **Query client_subscriptions via PostgREST (client can read own). Grace period derived from end_date + 7 days** |
| **Acceptance Criteria** | **Warning banner shows when subscription is within 7 days of expiry. Expired banner shows when past end_date. Profile shows subscription details** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 2: Communication & Retention

| **Test** | **Expected Result** |
| --- | --- |
| **Coach can send/receive messages with client** | **Messages appear in both inboxes** |
| **Client can send/receive messages on mobile** | **Messages work, recipient validation enforced** |
| **Assistant sees only participant-scoped messages** | **Cannot see other conversations** |
| **Absence events detected by cron** | **Events created for missing check-ins at correct levels** |
| **Absence reminders sent** | **Messages sent to absent clients, 72h escalated to coach** |
| **Follow-up Queue manages events** | **Coach can mark handled, resolve, filter** |
| **Client subscription tracking works** | **Coach can create/update subscriptions, confirm payment** |
| **Subscription expiry cron works** | **Reminders sent, expired status updated** |
| **Renewal banners appear on client app** | **Warning before expiry, expired after** |
| **All Gate 0 + Gate 1 tests still pass** | **No regressions** |

# TIER 3: PLANS, TEAM & HISTORY

**Three parallel workstreams.**

## Workstream D: Plans (3 tasks)

## T3-D1: Plans & Templates Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-D1** |
| **Context** | **Coach-facing plan management.** |
| **Spec Reference** | **Screen Spec → Coach Web → 6. Plans & Templates** |
| **Task** | **Create Plans page at /plans. Plan List table: title, type (meal/workout), status (active/archived), is_template, dates. Create Plan form: title, type selector, content editor (JSONB), template toggle. Edit Plan: pre-filled. Archive Plan: sets status=archived. Filter: active only by default. Assign button navigates to assignment flow.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/plans/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Plans CRUD via PostgREST (Layer 1 writes for coach). Archived plans hidden by default but accessible via filter. Cannot archive plan with active assignments** |
| **Acceptance Criteria** | **Coach can create, edit, archive plans. List shows correct data. Filters work. Archived plans preserved but hidden** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T3-D2: Plan Assignment RPCs Verification + UI

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-D2** |
| **Context** | **Verify assign_plan and replace_active_plan RPCs, add assignment UI.** |
| **Spec Reference** | **API Spec → RPCs: assign_plan, replace_active_plan + Screen Spec → Client Profile (Current Plan section)** |
| **Task** | **Test RPCs: (1) assign_plan — validates plan type, enforces one-active-per-type, creates assignment with denormalized plan_type. (2) replace_active_plan — atomically sets old=replaced, creates new. Add plan assignment UI: on Client Profile or Plans screen, select client + plan → call assign_plan RPC.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/clients/[id]/page.tsx (add plan assignment action) or separate assign flow + test files** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Partial unique index enforces one active per type. Plan must be status=active (not archived). Same tenant enforced by composite FK** |
| **Acceptance Criteria** | **Plan assigned correctly. Duplicate active assignment of same type rejected. Replace works atomically. Client Profile shows current active plans** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T3-D3: My Plan Screen (Client Mobile)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-D3** |
| **Context** | **Client-facing plan view.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 4. My Plan** |
| **Task** | **Create My Plan tab in mobile app. Display active meal plan (title + content rendered from JSONB) and active workout plan. Show assigned date. If no active plan, show placeholder message.** |
| **Files to Create/Modify** | **apps/mobile/screens/MyPlan.tsx** |
| **Files NOT to Touch** | **Other mobile screens. Coach web** |
| **Constraints** | **Read plan_assignments (status=active) + plans via PostgREST. Client can only see own assignments. Read-only** |
| **Acceptance Criteria** | **Client sees active meal and workout plans. Content renders correctly. No-plan state shows placeholder** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## Workstream E: Team Management (3 tasks)

## T3-E1: Staff Invite Route

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-E1** |
| **Context** | **Server route to invite assistants via Supabase Auth.** |
| **Spec Reference** | **API Spec → Layer 3 → /api/auth/invite-staff** |
| **Task** | **Create POST /api/auth/invite-staff. Logic: validate coach auth → send Supabase Auth invite email to assistant email → create platform_users row (role_type='assistant', status='pending') → create staff_assignments row (coach_id, user_id, role_id, timezones, regions). On acceptance: assistant sets password, status becomes active.** |
| **Files to Create/Modify** | **apps/web/app/api/auth/invite-staff/route.ts** |
| **Files NOT to Touch** | **Other routes. Migrations** |
| **Constraints** | **Use service role for Auth invite. Coach provides: email, role selection, timezone(s), region(s). UNIQUE partial index ensures one active assignment per assistant** |
| **Acceptance Criteria** | **Invite email sent. platform_users and staff_assignments rows created. After acceptance, assistant can log in and see assigned clients** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T3-E2: Staff Management RPCs Verification

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-E2** |
| **Context** | **Verify assign/remove staff, update status, reassign RPCs.** |
| **Spec Reference** | **API Spec → RPCs: assign_staff_to_client, remove_staff_from_client, update_staff_status, reassign_staff_clients** |
| **Task** | **Test all 4 RPCs: (1) assign_staff_to_client — creates assignment, duplicate rejected, cross-tenant rejected. (2) remove_staff_from_client — deletes assignment. (3) update_staff_status — enables/disables assistant, does NOT reassign clients. (4) reassign_staff_clients — moves all client assignments from one staff to another.** |
| **Files to Create/Modify** | **Test files** |
| **Files NOT to Touch** | **Migration files. RPCs** |
| **Constraints** | **RPCs already deployed. Verification + fix** |
| **Acceptance Criteria** | **All staff RPCs work correctly with authorization. Disabled assistant cannot access data. Reassignment moves all client assignments** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T3-E3: Team Screen (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-E3** |
| **Context** | **Coach-facing team management.** |
| **Spec Reference** | **Screen Spec → Coach Web → 11. Team** |
| **Task** | **Create Team page at /team. Staff List table: name, email, role name, timezones, regions, status, assigned client count. Add Staff: email + role + timezone + region → calls /api/auth/invite-staff. Edit Staff: change role, timezones, regions. Client Assignments: per-assistant client list, add/remove. Role Info: display permissions (read-only). Remove Staff: disable + trigger reassignment option.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/team/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Uses staff_assignments + client_staff_assignments + platform_users + roles + role_permissions via PostgREST. Actions use RPCs and invite route** |
| **Acceptance Criteria** | **Coach can invite staff, assign clients, view roles/permissions, disable/enable assistants, reassign clients. Only own-tenant staff visible** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## Workstream F: Client History (1 task)

## T3-F1: Log History / Progress Screen (Client Mobile)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T3-F1** |
| **Context** | **Client-facing historical log view.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 3. Log History / Progress** |
| **Task** | **Create History tab in mobile app. Scrollable timeline of past daily logs: date, weight, steps, meal summary, photo thumbnail. Tap to expand: full meal description, full-size photo, questions. Streak indicator (consecutive days logged). Optional summary cards: weight trend (7/30 days), average steps.** |
| **Files to Create/Modify** | **apps/mobile/screens/History.tsx + components** |
| **Files NOT to Touch** | **Other mobile screens. Coach web** |
| **Constraints** | **Read daily_logs via PostgREST (client sees own only). Photos via signed download URLs. Streak = count consecutive days with log entries. Read-only — only today's log editable from Home** |
| **Acceptance Criteria** | **Timeline loads with past logs. Photos display. Streak shows correctly. Tap-to-expand works. Summary cards show trends** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 3: Plans, Team & History

| **Test** | **Expected Result** |
| --- | --- |
| **Coach can create/edit/archive plans** | **Plans CRUD works, archived plans hidden** |
| **Coach can assign/replace plans for client** | **One active per type enforced, replacement atomic** |
| **Client sees active plans on mobile** | **My Plan screen shows meal + workout plans** |
| **Coach can invite assistant** | **Auth invite sent, staff assignment created** |
| **Coach can assign/remove clients from assistant** | **Assignments work, scoping correct** |
| **Assistant sees only assigned clients** | **Data scoping enforced across all screens** |
| **Client sees log history on mobile** | **Timeline, photos, streak displayed** |
| **All previous gate tests still pass** | **No regressions** |

# TIER 4: ADMIN PANEL

## T4-01: Admin Dashboard

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T4-01** |
| **Context** | **Platform KPI overview for Super Admin.** |
| **Spec Reference** | **Screen Spec → Admin Panel → 1. Dashboard** |
| **Task** | **Create Admin Dashboard at /admin/dashboard. Metrics: total coaches, active trials, paid subscriptions, expired/churned, total clients (aggregate), revenue indicator. Data from coaches + coach_subscriptions via PostgREST (Super Admin RLS: read all).** |
| **Files to Create/Modify** | **apps/web/app/(admin)/admin/dashboard/page.tsx + components** |
| **Files NOT to Touch** | **Coach web screens. Client mobile. Migrations** |
| **Constraints** | **Super Admin role verified via get_my_role(). Aggregate client counts only (no individual client data). Layout separate from coach dashboard** |
| **Acceptance Criteria** | **Dashboard shows platform KPIs. Only Super Admin can access. No individual client data visible** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T4-02: Coach List + Coach Detail + Suspend/Ban/Restore

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T4-02** |
| **Context** | **Admin screens for managing coaches.** |
| **Spec Reference** | **Screen Spec → Admin Panel → 2. Coach List + 3. Coach Detail + API Spec → Layer 3 → Admin Operations** |
| **Task** | **Create Coach List at /admin/coaches: table with name, email, workspace, trial status, subscription status, client count, created date. Filters + search. Create Coach Detail at /admin/coaches/[id]: coach info, subscription, client/staff counts, settings preview. Actions: Suspend (POST /api/admin/coaches/:id/suspend), Ban (/ban), Restore (/restore). Create all 3 admin routes.** |
| **Files to Create/Modify** | **apps/web/app/(admin)/admin/coaches/page.tsx + [id]/page.tsx + apps/web/app/api/admin/coaches/[id]/suspend/route.ts + ban/route.ts + restore/route.ts** |
| **Files NOT to Touch** | **Coach web screens. Client mobile. Migrations** |
| **Constraints** | **Admin routes use service role. All actions logged to audit_logs. Suspend = temporary (status=suspended). Ban = permanent (status=banned). Restore = active. Only Super Admin** |
| **Acceptance Criteria** | **Coach list loads. Detail view shows metadata. Suspend/Ban/Restore work and log to audit_logs. Suspended/banned coach cannot access dashboard** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T4-03: Role Management + Audit Log + Support Access

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T4-03** |
| **Context** | **Remaining admin screens.** |
| **Spec Reference** | **Screen Spec → Admin Panel → 4. Role Management + 5. Audit Log + 6. Support Access Requests** |
| **Task** | **Create Role Management at /admin/roles: role list (name, locked, assignee count), permissions view per role. Read-only at MVP. Create Audit Log at /admin/audit: table with timestamp, actor, action, target, metadata. Filters: action type, date, actor. Uses /api/admin/audit-logs routes. Create Support Access at /admin/support: form to log access request (reason + target coach). Uses /api/admin/support-access. Create audit-log GET routes.** |
| **Files to Create/Modify** | **apps/web/app/(admin)/admin/roles/page.tsx + audit/page.tsx + support/page.tsx + apps/web/app/api/admin/audit-logs/route.ts + [id]/route.ts + support-access/route.ts** |
| **Files NOT to Touch** | **Coach web. Client mobile. Migrations** |
| **Constraints** | **Roles read-only at MVP (no edit UI). Audit log metadata never shows raw PII. Support access is logging only — no elevated data access through UI** |
| **Acceptance Criteria** | **Roles display correctly with locked indicator. Audit log loads with filters. Support access logs request to audit_logs. All Super Admin only** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 4: Admin Panel

| **Test** | **Expected Result** |
| --- | --- |
| **Admin dashboard shows KPIs** | **Correct counts, no individual client data** |
| **Coach list/detail loads** | **All coaches visible to Super Admin** |
| **Suspend/Ban/Restore works** | **Status changes, audit logged, coach access blocked** |
| **Roles display correctly** | **Locked roles shown, permissions listed** |
| **Audit log loads with filters** | **Events searchable, metadata sanitized** |
| **Support access logs correctly** | **Request recorded in audit_logs** |
| **All previous gates pass** | **No regressions** |

# TIER 5: OPERATIONS & POLISH

## T5-01: Database Backup Cron

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T5-01** |
| **Context** | **Daily pg_dump to Cloudflare R2.** |
| **Spec Reference** | **Interoperability & Backup Doc → Backup & Recovery → MVP Backup Strategy + Environment Setup → R2 setup** |
| **Task** | **Create POST /api/backup/database. Logic: connect to Supabase DB via connection string → pg_dump → gzip → upload to R2 as backup_{date}.sql.gz. Log result to audit_logs (action='backup_completed' or 'backup_failed'). Create POST /api/backup/cleanup: list R2 objects, delete backups older than 30 days.** |
| **Files to Create/Modify** | **apps/web/app/api/backup/database/route.ts + cleanup/route.ts + lib/r2.ts** |
| **Files NOT to Touch** | **Other routes. Migrations. Coach/client screens** |
| **Constraints** | **Use service role. R2 via @aws-sdk/client-s3. Connection string from SUPABASE_DB_URL env var. Handle errors gracefully — log failure, do not crash. Backup file naming: backup_YYYY-MM-DD.sql.gz** |
| **Acceptance Criteria** | **Backup creates .sql.gz file in R2. Cleanup removes files older than 30 days. Audit log records result. Manual restore test: download backup, restore to test project, verify data** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T5-02: Coach Settings Screen

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T5-02** |
| **Context** | **Workspace configuration and threshold settings.** |
| **Spec Reference** | **Screen Spec → Coach Web → 13. Workspace Settings** |
| **Task** | **Create Settings page at /settings. Fields: workspace name (text), timezone (dropdown), absence thresholds (absence_warning_days, absence_critical_days), weight stagnation days, escalation toggles (24h/48h/72h on/off). Save updates coaches table (workspace_name, timezone) and coaches.settings JSONB.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/settings/page.tsx** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Direct PostgREST UPDATE on coaches (Layer 1 write — coach can update own record). Only allowed fields: workspace_name, timezone, settings. Never: id, trial_status, stripe_customer_id** |
| **Acceptance Criteria** | **Settings page loads with current values. Save updates correctly. Changes reflected in flash card computation and absence detection** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T5-03: Coach Billing Screen

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T5-03** |
| **Context** | **Stripe subscription management.** |
| **Spec Reference** | **Screen Spec → Coach Web → 14. Billing** |
| **Task** | **Create Billing page at /billing. Display: current plan name, status, period dates, trial info (days remaining). Actions: Subscribe (redirect to Stripe Checkout via /api/stripe/create-checkout), Manage Billing (redirect to Stripe Portal via /api/stripe/customer-portal). Expired state: prominent banner + subscribe button.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/billing/page.tsx** |
| **Files NOT to Touch** | **Other screens. Stripe routes (already built)** |
| **Constraints** | **Read coach_subscriptions + coaches.trial_status via PostgREST. Stripe actions via existing Layer 3 routes. This is a display + redirect page, not a payment processor** |
| **Acceptance Criteria** | **Billing page shows subscription state. Subscribe redirects to Stripe. Manage redirects to Portal. Expired state shows banner** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T5-04: Client Mobile Profile (Expanded)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T5-04** |
| **Context** | **Complete client profile with grace period and full polish.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 7. Profile (full version)** |
| **Task** | **Expand the Profile screen: personal info (name, email, age, conditions — read-only), coach info (coach name from platform_users), subscription status (dates, status, warning/expired), grace period info (derived: end_date + 7 days, show remaining days), app version, logout. Uses get_client_profile_summary RPC.** |
| **Files to Create/Modify** | **apps/mobile/screens/Profile.tsx (expand existing)** |
| **Files NOT to Touch** | **Other mobile screens. Coach web** |
| **Constraints** | **Grace period is derived, not stored. Use get_client_profile_summary RPC for combined data. Show export option placeholder (post-MVP feature)** |
| **Acceptance Criteria** | **Profile shows all sections. Grace period calculated correctly. Subscription warnings display. Logout works** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 5: Operations & Polish

| **Test** | **Expected Result** |
| --- | --- |
| **Backup cron creates file in R2** | **backup_YYYY-MM-DD.sql.gz exists in R2 bucket** |
| **Backup cleanup removes old files** | **Files older than 30 days deleted** |
| **Manual restore works** | **Downloaded backup restores to test project correctly** |
| **Settings save and apply** | **Thresholds reflected in flash card/absence computation** |
| **Billing page works** | **Subscription displayed, Stripe redirects work** |
| **Client profile complete** | **All sections, grace period, logout** |
| **All previous gates pass** | **No regressions** |

# TIER 6: VIP GROUP (GATED)

**GATE DECISION: Do not start this tier unless explicitly approved. MVP-core ships without it.**

## T6-01: VIP Group Backend (Groups + Members)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T6-01** |
| **Context** | **Group creation and membership management.** |
| **Spec Reference** | **Schema Doc → vip_groups + vip_group_members + Screen Spec → Coach Web → 10. VIP Group (Members panel + Create group)** |
| **Task** | **Verify via PostgREST: coach can create one VIP group (UNIQUE(coach_id) enforced), add/remove/mute members. Verify RLS: coach full CRUD, assistant read, client reads own membership only.** |
| **Files to Create/Modify** | **Test files. PostgREST verification** |
| **Files NOT to Touch** | **Migrations. Other screens** |
| **Constraints** | **Layer 1 writes for coach on vip_groups and vip_group_members. Composite FKs enforce tenant integrity. Max 1 group per coach** |
| **Acceptance Criteria** | **Group created. Members added/removed/muted. Cross-tenant blocked. Max-1 enforced. Client sees only own membership** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T6-02: VIP Group Posts + Reactions (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T6-02** |
| **Context** | **Group feed with posts, replies, reactions, images.** |
| **Spec Reference** | **Screen Spec → Coach Web → 10. VIP Group (Feed, Compose, Reactions, Replies)** |
| **Task** | **Create VIP Group page at /vip-group. Feed: chronological posts with author name, content, image (signed URL), timestamp, reactions, replies (nested via parent_post_id). Compose: text + optional image upload. Coach can pin posts. Reactions: tap to add/remove (like, fire, strong).** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/vip-group/page.tsx + components** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Posts and reactions via PostgREST (Layer 1 writes). Images via signed URLs. Replies via parent_post_id. Pinning via is_pinned (coach only). Only active members can post** |
| **Acceptance Criteria** | **Feed loads with posts. Image upload works. Replies nest correctly. Reactions add/remove. Pinning works. Only active members can post** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T6-03: VIP Group Moderation (Coach Web)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T6-03** |
| **Context** | **Coach moderation tools.** |
| **Spec Reference** | **Screen Spec → Coach Web → 10. VIP Group (Moderation)** |
| **Task** | **Add moderation capabilities: delete any post, mute member (change status to 'muted'), remove member (status='removed'). Muted members can view but not post. Members panel shows status.** |
| **Files to Create/Modify** | **apps/web/app/(dashboard)/vip-group/ (extend existing components)** |
| **Files NOT to Touch** | **Other screens. Migrations** |
| **Constraints** | **Mute/remove via PostgREST UPDATE on vip_group_members. Delete posts via PostgREST DELETE. Only coach can moderate** |
| **Acceptance Criteria** | **Coach can delete any post, mute/remove members. Muted member cannot create posts (RLS blocks INSERT for non-active). Removed member sees nothing** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

## T6-04: VIP Group (Client Mobile)

| **Attribute** | **Detail** |
| --- | --- |
| **Task ID** | **T6-04** |
| **Context** | **Client-facing VIP group screen.** |
| **Spec Reference** | **Screen Spec → Client Mobile → 6. VIP Group** |
| **Task** | **Create VIP Group tab (visible only if client is active member). Feed: posts with text, images, reactions, replies. Compose: text + image (if active, not muted). Reactions: add/remove own. Pinned posts at top.** |
| **Files to Create/Modify** | **apps/mobile/screens/VIPGroup.tsx + components** |
| **Files NOT to Touch** | **Other mobile screens. Coach web** |
| **Constraints** | **Tab hidden for non-members. RLS membership check enforces visibility. Images via signed download URLs. Post creation blocked for muted/removed members** |
| **Acceptance Criteria** | **Tab visible only for active members. Feed loads. Client can post (if active), react, reply. Muted client cannot post. Non-member sees no tab** |

*After implementation: update PROJECT_STATE.md, run regression tests, commit only after acceptance.*

# GATE 6: VIP Group

| **Test** | **Expected Result** |
| --- | --- |
| **Coach can create group + add members** | **Group created, members added, max-1 enforced** |
| **Feed shows posts with images** | **Signed URLs work, chronological order** |
| **Replies nest correctly** | **parent_post_id creates visual nesting** |
| **Reactions work** | **Add/remove, one per type per user** |
| **Moderation works** | **Delete post, mute/remove member** |
| **Client mobile VIP tab** | **Visible for members only, posting works, muted blocked** |
| **All previous gates pass** | **No regressions** |

# Final MVP Checklist

**Before declaring MVP complete, verify all gates have passed and all deliverables exist:**

| **Item** | **Status** |
| --- | --- |
| **Gate 0: Security boundary** |  |
| **Gate 1: Core product loop** |  |
| **Gate 1 real-coach test completed** |  |
| **Gate 2: Communication & Retention** |  |
| **Gate 3: Plans, Team & History** |  |
| **Gate 4: Admin Panel** |  |
| **Gate 5: Operations & Polish** |  |
| **Gate 6: VIP Group (if approved)** |  |
| **All 20 RLS policies verified** |  |
| **All 20 RPCs verified** |  |
| **All cron jobs running** |  |
| **Backup operational (if approved for pilot)** |  |
| **PROJECT_STATE.md up to date** |  |
| **DECISIONS.md complete** |  |
| **No unresolved security issues** |  |

**When all items are checked: MVP is complete.**

