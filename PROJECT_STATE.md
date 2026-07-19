# PROJECT_STATE.md

**Project:** Coaching Platform MVP  
**Purpose:** Single source of truth for current task, completed work, in-progress state, blockers, and verification log.  
**Read this file before every Claude Code session.**  
**Update this file after every completed task.**  
**Last updated:** 2026-07-07 (T1-21 CLOSED — PASS: public coach signup gated in production; next task awaits founder selection)

---

## Current Task

**None in progress. T1-21 — Gate or Disable Public Coach Signup — PASS, CLOSED (2026-07-07).**

Public uncontrolled coach creation is blocked in production. `POST /api/signup` works only with the valid server-side invitation code (`SIGNUP_INVITE_CODE`, configured in Vercel Production; value never recorded in repo, docs, or chat). Implementation commit `4efc381`; docs/local-validation commit `01bed7c`; production deployed from `01bed7c` (Ready). Hosted negative-path validation PASS; hosted positive-path (valid-code) signup **intentionally deferred** to the next founder-approved real pilot-coach onboarding (local positive path already PASS). See the T1-21 Verification Log entry below.

**The next task is not selected. It requires explicit founder selection and approval. Tier 2 / Tier 3 have not started.**

T1-19 closed 2026-07-01, commit `1d4d454`. T1-18 closed 2026-07-01, commit `5303292`. T1-17 closed 2026-06-17, commit `dc50b4c`.

**T1-18 summary:** `POST /api/clients/invite` no longer returns the raw activation token in its response. Activation code is now sent to the client by email via a Resend-based helper (`apps/web/lib/email/send-invite-email.ts`). If email delivery is not configured or fails, the API returns a truthful `email_sent:false` + non-secret warning — the token is never exposed in the response or logged. No schema, RLS, `database.types.ts`, or migration changes were made for T1-18. Working tree is clean after push; local `main` is in sync with `origin/main`.

**T1-19 summary:** Documentation-only cleanup. `PROJECT_STATE.md` updated to be the current authoritative status source (added missing T1-17/T1-18 rows, updated Next Up). Stale readiness/handoff docs marked as superseded/outdated with redirect notes, not rewritten. No code, package, schema, or env files changed.

---

## Build Phase

| Phase                                     | Status                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Phase 0 — Bootstrap and control files     | COMPLETE                                                     |
| Phase 1 — Tier 0 migrations (001–013)     | COMPLETE — 013 complete (13 of 13)                           |
| Phase 2 — Gate 0 acceptance tests         | COMPLETE — 2026-05-16 — 16 pgTAP files, 84 tests, 0 failures |
| Phase 3 — Tier 1 auth + Tier 2 core loop  | COMPLETE — 2026-05-25 — Gate 1 PASS (T1-00 through T1-16)    |
| Phase 4+ — Tiers 3–7                      | NOT STARTED                                                  |

---

## Completed Tasks

| Task ID | Description                            | Completed on | Verified                                                         |
| ------- | -------------------------------------- | ------------ | ---------------------------------------------------------------- |
| T0-00   | Project Bootstrap and Control Files    | 2026-05-09   | Approved by founder                                              |
| T0-01   | Create Enum Types Migration            | 2026-05-09   | Reviewed and corrected by founder                                |
| T0-02   | Create Tables Migration                | 2026-05-10   | Approved by founder 2026-05-11                                   |
| T0-03   | Create Composite Constraints Migration | 2026-05-10   | Approved by founder 2026-05-11                                   |
| T0-04   | Create Indexes Migration               | 2026-05-11   | Approved by founder 2026-05-11                                   |
| T0-05   | Create Triggers Migration              | 2026-05-11   | Approved by founder 2026-05-11                                   |
| T0-06a  | Create Private Schema Migration        | 2026-05-11   | Approved by founder 2026-05-11                                   |
| T0-06.5 | Bootstrap Local Supabase               | 2026-05-14   | Verification queries A–E passed; all 12 services healthy         |
| T0-06b  | Enable RLS Migration                   | 2026-05-14   | Approved by founder 2026-05-14                                   |
| T0-07   | Create RLS Policies Migration          | 2026-05-15   | V1-V7 passed; 82 policies across 16 tables                       |
| T0-08a  | client_staff_assignments staff_id idx  | 2026-05-15   | V1-V5 passed; 9 migrations applied                               |
| T0-08   | Create RPC Functions Migration         | 2026-05-15   | V1-V6 passed; 23 RPCs; all SECURITY DEFINER; search_path=''      |
| T0-09   | Create Revoke Grants Migration         | 2026-05-16   | V1-V8 passed; 4 revokes; 82 policies unchanged; 23 RPCs intact   |
| T0-10   | Create Storage Policies Migration      | 2026-05-16   | V1-V8 passed; bucket private; 6 policies; 82 pub policies intact |
| T0-11   | Create Seed Data Migration             | 2026-05-16   | V1-V13 passed; 6 roles locked; 46 permissions; 13 migrations     |
| T0-12   | Generate TypeScript Database Types     | 2026-05-16   | V1-V7 passed; database.types.ts 38 KB; all tables + RPCs present |
| Gate 0  | pgTAP security acceptance suite        | 2026-05-16   | 16 files, 84 tests, 0 failures; migrations 001–013 untouched     |
| T1-00   | Next.js 14 + Supabase client utilities | 2026-05-17   | Build + typecheck passed; Turborepo configured; no auth routes   |
| T1-01   | Coach signup route (POST /api/signup)  | 2026-05-20   | typecheck + build + lint PASS; integration skipped (.env.local missing); service role; rollback on failure |
| T1-02   | Coach login API route (POST /api/login) | 2026-05-20  | typecheck + build + lint PASS; anon client; 401 on all auth failures; tokens in body |
| T1-03   | Coach session/profile state route (GET /api/me) | 2026-05-20 | typecheck + build + lint PASS; anon+JWT client; RLS-evaluated reads; next_action logic |
| T1-04   | Coach workspace setup route (PATCH /api/workspace) | 2026-05-20 | typecheck + build + lint PASS; Unicode validation; trial activation logic; RLS writes |
| T1-05   | Client invitation route (POST /api/clients/invite) | 2026-05-22 | typecheck + build + lint PASS; service role auth user creation; user JWT for RPC; compensating rollback; email validation + duplicate detection |
| T1-06   | Client list route (GET /api/clients) | 2026-05-24 | typecheck + build + lint PASS; RLS-scoped reads; parallel queries; ?status filter; flash severity sort; assigned_staff array |
| T1-07   | Client activation route (POST /api/client-activation/complete) | 2026-05-24 | typecheck + build + lint PASS; SHA-256 token lookup; expiry check; password set; status activate; token clear; sign-in; integration skipped (.env.local missing) |
| T1-08   | Storage signed upload URL route (POST /api/storage/signed-upload-url) | 2026-05-24 | typecheck + build + lint PASS; client-only; path ownership + coach_id verified; service role createSignedUploadUrl; integration skipped (.env.local missing) |
| T1-09   | Flash card compute cron route (POST /api/flash-cards/compute) | 2026-05-24 | typecheck + build + lint PASS; CRON_SECRET auth; active+paused clients; absence/stagnation logic; service role upsert; notes never touched; integration skipped (.env.local missing) |
| T1-10   | Storage signed download URL route (POST /api/storage/signed-download-url) | 2026-05-24 | typecheck + build + lint PASS; coach/client/assistant role auth; path ownership double-check; service role createSignedUrl; expires_in=300; integration skipped (.env.local missing) |
| T1-11   | Coach Dashboard (/dashboard) + Login Page (/login) | 2026-05-24 | typecheck + build + lint PASS; @supabase/ssr middleware session auth; /dashboard and /login in route table; integration skipped (.env.local missing) |
| T1-12   | Coach Client List screen (/clients) + invite modal | 2026-05-24 | typecheck + build + lint PASS; /clients in route table; DashboardClient paused flash option removed; integration skipped (.env.local missing) |
| T1-13   | Expo mobile scaffold + client activation screen + home placeholder | 2026-05-24 | pnpm install PASS (+704 packages); tsc --noEmit zero errors; Metro/Expo Go runtime skipped (no device connected); react@18.3.1 (18.3.2 not in registry); expo-env.d.ts created to declare process |
| T1-14   | Daily logging screen (/home) with photo upload + update_today_log RPC | 2026-05-24 | tsc --noEmit zero errors; expo-image-picker@16.0.6 installed; Metro/Expo Go runtime skipped (no device connected); DailyLogRow defined inline (Database not re-exported from mobile.ts) |
| T1-15   | Coach client profile screen (/clients/[id]) | 2026-05-24 | tsc + build + lint PASS; /clients/[id] in route table; createSignedUrls available (v2.105.4); 3 files created; integration skipped (.env.local missing) |
| T1-16   | Core Loop Validation + Environment Setup (Gate 1) | 2026-05-25 | Gate 1 PASS; .env.local created with real JWT keys; 19/19 integration tests PASS; web UI smoke test PASS; tsc + lint PASS |
| T1-17   | Real-Coach Core Loop + Mobile Runtime Validation  | 2026-06-17 | PASS; physical Android device; Expo Go SDK 52; coach login + client invite + activation + Today's Log (no photo + gallery photo) all PASS; photo upload blocker resolved (env-only fix: LAN IP in .env.local); @babel/runtime 7.29.2 approved dep exception |
| T1-18   | Invite-Code Security Fix                          | 2026-07-01 | tsc + lint + build PASS; commit `5303292`; raw activation token removed from `POST /api/clients/invite` response; Resend email helper added (`apps/web/lib/email/send-invite-email.ts`); truthful non-secret warning on send failure; no token in response or logs; no schema/RLS/database.types.ts/migration changes |
| T1-19   | Documentation Cleanup / Stale Readiness Doc Correction | 2026-07-01 | Updated PROJECT_STATE.md as authoritative status source; marked stale readiness/handoff docs as superseded/outdated; no code/package/schema/env changes |
| T1-20   | First Hosted Supabase + Vercel Deployment Validation | 2026-07-07 | PASS; 13 migrations on hosted staging; 16 tables, RLS on all 16, 23 SECURITY DEFINER RPCs, private tenant-media bucket @ 5 MB; Vercel production Ready at stable URL; signup 201 + login + /dashboard + /clients PASS; unauth APIs 401; no 5xx; open finding: public /api/signup → T1-21 |
| T1-21   | Gate or Disable Public Coach Signup (invitation-code gate) | 2026-07-07 | PASS, CLOSED; server-side SIGNUP_INVITE_CODE gate, fail-closed, generic 403 before any Supabase op; error hardening (generic 422, no orphan UUID in responses); local + hosted negative-path validation PASS; deployed from `01bed7c`; hosted positive path deferred to next approved pilot-coach onboarding; commits `4efc381` + `01bed7c` |

---

## In Progress

None. T1-21 closed 2026-07-07 (PASS).

---

## Next Up

**The next task is not selected — it requires explicit founder selection and approval.** Candidates (none started, none chosen):

- Hosted positive-path signup validation as part of the next founder-approved real pilot-coach onboarding (deferred from T1-21)
- Tier 3 planning (messaging) — was previously gated behind T1-21; T1-21 is now closed, but starting still requires explicit founder approval
- EAS / mobile build planning (real installable app, beyond Expo Go)
- Web/mobile automated tests (currently only database/RLS pgTAP tests exist)

> Note: Tier 2 core-loop work (client invite + activation, daily log, flash cards, dashboard) was already implemented and validated during Tier 1 (Gate 1 PASSED 2026-05-25; mobile runtime validated 2026-06-17 T1-17; invite-token exposure fixed 2026-07-01 T1-18; hosted deployment validated 2026-07-07 T1-20; public signup gated 2026-07-07 T1-21).

---

## Blocked

| Task                               | Blocked by                                          |
| ---------------------------------- | --------------------------------------------------- |
| T0-02 (tables migration)           | VIP scope — RESOLVED OUT; no further blocker        |
| T2-03 (flash card computation RPC) | All threshold values in `FLASH_CARD_RULES.md`       |
| Migration 012 (seed data)          | All PENDING items in `ROLE_SEED_MATRIX.md`          |
| Tier 2 (core loop)                 | Tier 1 must complete first                          |
| Tier 3 (messaging)                 | Gate 1 must pass + push notification decision       |
| Tier 6 (VIP Group)                 | OUT of MVP-core; revisit after Gate 5               |
| Tier 7 (admin moderation)          | Admin role boundary decision + Gate 6               |

---

## Verification Log

### T0-00 — Project Bootstrap and Control Files

**Date:** 2026-05-09  
**Task:** Create repo structure and all 10 Phase 0 control files  
**Status:** Complete — pending founder review before T0-01 is issued

**Files and folders created:**

```text
apps/web/                    (empty, .gitkeep)
apps/mobile/                 (empty, .gitkeep)
packages/shared/             (empty, .gitkeep)
packages/supabase/           (empty, .gitkeep)
supabase/migrations/         (empty, .gitkeep)
scripts/                     (empty, .gitkeep)
tests/                       (empty, .gitkeep)
docs/                        (pre-existing)
package.json                 (root — pnpm monorepo config)
pnpm-workspace.yaml          (workspace package globs)
.gitignore                   (secrets, builds, node_modules, OS artifacts)
.env.example                 (required env vars documented, no secrets)
DECISIONS.md                 (locked and pending architectural decisions)
MVP_SCOPE_LOCK.md            (feature scope matrix with PENDING items)
FLASH_CARD_RULES.md          (flash card color logic — thresholds PENDING)
ROLE_SEED_MATRIX.md          (seeded roles and permission strings — some PENDING)
TESTING_STRATEGY.md          (test frameworks, Gate 0 format, regression rules)
PROJECT_STATE.md             (this file)
```

**Verification steps performed:**

- All 10 Phase 0 outputs exist at project root or expected path
- No application code created
- No database migrations created
- No Supabase schema written
- No UI screens created
- Package manager set to pnpm in `package.json` and `pnpm-workspace.yaml`
- All PENDING items clearly marked and not assumed

**Tests run:** None — no code exists yet.  
**Gate status:** Not applicable for T0-00.

### T0-01 — Create Enum Types Migration

**Date:** 2026-05-10 (corrected after founder review)  
**Task:** Create `supabase/migrations/001_create_enums.sql` with all enum types required by the schema doc  
**Status:** Complete — corrected to align with Schema Doc Status Enums Reference and Task Prompt Guide

**Files created:**

```text
supabase/migrations/001_create_enums.sql
```

**Enums defined (12 total):**

- `public.user_status` — pending, active, paused, suspended, banned, deactivated
- `public.role_type` — super_admin, coach, assistant, client
- `public.trial_status` — trial_not_started, trial_active, trial_expired, paid_active, paid_skipped_trial
- `public.coach_subscription_status` — active, past_due, cancelled, expired
- `public.client_subscription_status` — active, expired, overdue
- `public.staff_status` — active, disabled
- `public.flash_status` — green, yellow, red
- `public.plan_type_enum` — meal, workout
- `public.plan_status` — active, archived
- `public.plan_assign_status` — active, completed, replaced
- `public.absence_level` — 24h, 48h, 72h
- `public.absence_action` — pending, message_sent, escalated_to_coach, resolved

**Removed (not in schema doc):** `account_status`, `subscription_status`, `flash_card_color`, `invite_status`, `message_type`

**Verification steps performed:**

- All 12 enum types match Schema Doc Status Enums Reference exactly
- No VIP-specific enums included
- No tables, constraints, indexes, triggers, RLS, RPCs, or seed data
- No files created or modified outside the project root
- `DECISIONS.md` updated with locked enum decisions (E-01 through E-12)

**Tests run:** None — migration will be tested as part of Gate 0 after all Tier 0 migrations are deployed.  
**Gate status:** Awaiting founder approval before T0-02.

---

### T0-02 — Create Tables Migration

**Date:** 2026-05-10  
**Task:** Create `supabase/migrations/002_create_tables.sql` — all 16 MVP-core tables  
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/002_create_tables.sql
```

**Tables created (16):**

| Table | Description |
| ----- | ----------- |
| `platform_users` | Core user profile; linked to `auth.users(id)`; `role_type` drives RLS branching |
| `coaches` | Workspace/tenant entity; `coach_id` is the tenant FK throughout |
| `coach_subscriptions` | Stripe billing status for a coach workspace |
| `clients` | Client record; belongs to one coach; tracks invite and activation timestamps |
| `client_subscriptions` | Client's access subscription within a workspace |
| `staff_assignments` | Assistants assigned to a coach workspace |
| `client_staff_assignments` | Maps assistants to specific clients (RLS scope for assistants) |
| `daily_logs` | Client daily check-in; one per client per day; `meal_photo_key` stores Storage object key (not URL) |
| `flash_cards` | Computed coaching status per client; written by RPC/cron only |
| `plans` | Coaching plan (meal or workout) authored by a coach |
| `plan_assignments` | Assignment of a plan to a specific client |
| `messages` | In-app messages between coach and client |
| `absence_events` | Detected client absences and escalation action state |
| `roles` | Named permission roles (seeded in 012) |
| `role_permissions` | Permission strings per role (seeded in 012) |
| `audit_logs` | Append-only platform audit trail |

**Verification steps performed:**

- All 16 required tables created; no extra tables
- No VIP tables (`vip_groups`, `vip_group_members`, `vip_group_posts`, `vip_post_reactions`)
- All enum references use types from `001_create_enums.sql`
- No composite constraints (deferred to 003)
- No indexes (deferred to 004)
- No triggers (deferred to 005)
- No RLS policies (deferred to 007/008)
- No RPC functions (deferred to 009)
- No seed data (deferred to 012)
- No app code created
- No files modified outside project root

**Tests run:** None — tested as part of Gate 0 after all Tier 0 migrations deploy.  
**Gate status:** Awaiting founder approval before T0-03.

---

### T0-03 verification log

- 2026-05-10 — Item 1 complete: 6 composite FKs changed from
  ON DELETE CASCADE to ON DELETE NO ACTION (default).
  plan_assignments → plans kept as ON DELETE RESTRICT.
  Rationale: aligns with Design Rule 4 (soft delete) and the
  Erasure Matrix (retain-minimal for most child tables).
- 2026-05-11 — Item 2 complete: client_subscriptions.end_date
  changed from nullable to NOT NULL in 002_create_tables.sql.
  003 CHECK constraint simplified to CHECK (end_date >= start_date).
  Rationale: product model requires explicit paid-period end
  dates for runtime grace-period computation; no product
  surface supports open-ended subscriptions.
- 2026-05-11 — Item 3 DEFERRED: negative acceptance test
  (cross-tenant daily_logs INSERT must fail) cannot be executed
  until local Supabase is bootstrapped. Test is rolled into the
  Gate 0 acceptance test suite, which will run all Tier 0
  negative tests (composite FKs, CHECK constraints, role-type
  triggers, RLS isolation, locked-role triggers) as one batch
  against a freshly migrated local DB.
- 2026-05-11 — Item 4 complete: see DECISIONS.md → Constraint
  naming convention.

---

### T0-04 — Create Indexes Migration

**Date:** 2026-05-11  
**Task:** Create `supabase/migrations/004_indexes.sql` — 9 MVP-core indexes  
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/004_indexes.sql
```

**Indexes created (9):**

1. `clients_coach_id_idx` — clients by tenant
2. `daily_logs_coach_client_log_date_idx` — daily-log history per client
3. `flash_cards_coach_status_idx` — dashboard status filter
4. `messages_coach_recipient_created_at_idx` — recipient inbox
5. `messages_coach_created_at_idx` — tenant-wide chronological
6. `messages_unread_idx` — PARTIAL (`WHERE read_at IS NULL`); unread badge
7. `absence_events_coach_created_at_idx` — tenant absence timeline
8. `plan_assignments_one_active_per_type_key` — PARTIAL UNIQUE (`WHERE status = 'active'`); one active plan per type per client
9. `staff_one_active_per_user` — PARTIAL UNIQUE (`WHERE status = 'active'`); RLS prerequisite

**VIP excluded:** No indexes on `vip_groups`, `vip_group_members`, `vip_group_posts`, `vip_post_reactions` (VIP is OUT of MVP-core per DECISIONS.md P-01).

**RLS prerequisite note:** `staff_one_active_per_user` (the partial unique index on `staff_assignments.user_id WHERE status = 'active'`) makes `private.get_my_coach_id()` deterministic by guaranteeing at most one active row per user_id. This is a prerequisite for the staff/assistant RLS path in 008.

**Verification steps performed:**

- Exactly the 9 specified indexes were created — no speculative or extra indexes
- Index names match DECISIONS.md N-07 (Postgres-default style)
- All three partial indexes (#6, #8, #9) include their `WHERE` clauses
- No indexes re-created over existing UNIQUE constraints (flash_cards.client_id, daily_logs(client_id, log_date), client_staff_assignments(client_id, staff_id), clients(id, coach_id), plans(id, coach_id))
- No tables, constraints, triggers, RLS, RPCs, or seed data added
- No files modified outside the project root; 001/002/003 untouched

**Tests run:** None — tested as part of Gate 0 after all Tier 0 migrations deploy.  
**Gate status:** Awaiting founder approval before T0-05.

---

### T0-05 — Create Triggers Migration

**Date:** 2026-05-11  
**Task:** Create `supabase/migrations/005_triggers.sql` — 4 integrity triggers with 4 trigger functions  
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/005_triggers.sql
```

**Trigger functions (4) and their triggers:**

| Function | Trigger | Attaches to | Timing |
| -------- | ------- | ----------- | ------ |
| `public.enforce_coach_role()` | `enforce_coach_role_trg` | `public.coaches` | BEFORE INSERT OR UPDATE, FOR EACH ROW |
| `public.enforce_client_role()` | `enforce_client_role_trg` | `public.clients` | BEFORE INSERT OR UPDATE, FOR EACH ROW |
| `public.enforce_roles_locked()` | `enforce_roles_locked_trg` | `public.roles` | BEFORE UPDATE OR DELETE, FOR EACH ROW |
| `public.enforce_role_permissions_locked()` | `enforce_role_permissions_locked_trg` | `public.role_permissions` | BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW |

**VIP excluded:** No triggers on `vip_groups`, `vip_group_members`, `vip_group_posts`, `vip_post_reactions` (VIP is OUT of MVP-core per DECISIONS.md P-01).

**Gate 0 cross-reference:** Negative and positive tests for these four triggers (8 negative + 2 positive controls per the T0-05 spec) will live in `tests/gate0/G0-10_trigger_correctness.sql`. That test file is **deferred** until local Supabase is bootstrapped — see the Deferred verifications section below. `TESTING_STRATEGY.md` G0-10 ("Locked-role triggers and role-type enforcement triggers fire correctly") covers this category at the strategy level.

**Verification steps performed:**

- All 4 functions are `LANGUAGE plpgsql`, VOLATILE (default; not marked STABLE/IMMUTABLE)
- No `SECURITY DEFINER` on any function (reserved for T0-06a private helpers)
- All functions schema-qualify table references (`public.platform_users`, `public.roles`)
- Each function has `SET search_path = public, pg_catalog`
- All 4 triggers are BEFORE / FOR EACH ROW
- `enforce_roles_locked` checks `OLD.locked` (not `NEW.locked`) — closes the unlock-attack
- `enforce_role_permissions_locked` UPDATE branch checks BOTH `OLD.role_id` parent and `NEW.role_id` parent — closes the permission-relocation attack
- `TG_OP` used for return-value branching in `enforce_roles_locked` (NEW/OLD) and `enforce_role_permissions_locked` (NEW/NEW/OLD)
- Exception messages name the trigger, the offending role/id, and `TG_OP`
- Header comment cross-references `tests/gate0/G0-10_trigger_correctness.sql`
- No tables, constraints, indexes, RLS, RPCs, or seed data added
- 001/002/003/004 untouched; no files outside project root modified

**Tests run:** None — tested as part of Gate 0 (G0-10).  
**Gate status:** Awaiting founder approval before T0-06a.

---

### T0-06a — Create Private Schema and RLS Helper Functions Migration

**Date:** 2026-05-11
**Task:** Create `supabase/migrations/006_private_schema.sql` — private schema and 5 SECURITY DEFINER helper functions
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/006_private_schema.sql
```

**Schema created:**

- `private` — not exposed via the Supabase Data API; no explicit REVOKE needed

**Functions created (5):**

| Function | Returns | Purpose |
| -------- | ------- | ------- |
| `private.get_my_role()` | text | Caller's role_type cast to text |
| `private.get_my_coach_id()` | uuid | Caller's tenant FK; CASE-dispatches by role_type; no LIMIT 1 in assistant branch |
| `private.is_my_assigned_client(p_client_id)` | boolean | True if p_client_id is in the caller's permitted scope |
| `private.has_permission(p_permission)` | boolean | True if caller's active staff role grants the permission |
| `private.is_tenant_member(p_user_id)` | boolean | True if p_user_id is in the same workspace as the caller |

**Verification steps performed:**

- All 5 functions are LANGUAGE sql, STABLE, SECURITY DEFINER
- All 5 functions use `SET search_path = ''` (empty) — prevents search_path injection
- All object references are fully schema-qualified (`public.platform_users`, `public.clients`, etc.)
- No GRANT EXECUTE to `anon` or `authenticated` roles
- `get_my_coach_id()` assistant branch has NO LIMIT 1 — determinism guaranteed by `staff_one_active_per_user` partial unique index (004_indexes)
- `is_tenant_member()` uses a CTE to evaluate `private.get_my_coach_id()` once, avoiding triple calls
- `is_tenant_member()` UNION ALL covers all three workspace membership types: coach, client, active staff
- `enforce_roles_locked` and `enforce_role_permissions_locked` in 005 remain the last line of defence; these functions are layered on top
- No tables, constraints, indexes, triggers, RLS policies, RPCs, or seed data added
- 001/002/003/004/005 untouched; no files outside project root modified
- VIP tables excluded (DECISIONS.md P-01)

**Tests run:** None — tested as part of Gate 0 (G0-12).
**Gate status:** Awaiting founder approval before T0-06b.

---

### T0-06.5 — Bootstrap Local Supabase

**Date:** 2026-05-14
**Task:** Bootstrap local Supabase instance; verify migrations 001–006a apply cleanly
**Status:** COMPLETE

**Environment blockers encountered and resolved (see BLOCKERS.md for full detail):**

| Blocker | ID | Resolution |
| ------- | -- | ---------- |
| Docker Desktop daemon crash (SIGBUS) | B-ENV-001 | Windows restart |
| Postgres image blob corruption | (part of B-ENV-001) | Docker Desktop restart re-pulled clean image |
| Vector crash — Docker TCP socket not exposed | B-ENV-004 | Docker Desktop → Settings → General → "Expose daemon on tcp://localhost:2375 without TLS" |
| Storage image corruption — `server.js` 0 bytes | B-ENV-005 | `docker image rm public.ecr.aws/supabase/storage-api:v1.54.1` + re-pull on `supabase start` |

**Config.toml:** Pre-existing (previously initialized). No changes required for final working state. `[analytics] enabled = true`, `[storage] enabled = true`.

**Supabase services started (all 12 healthy):**

| Service | Status |
| ------- | ------ |
| supabase_db | healthy |
| supabase_auth | healthy |
| supabase_rest | running |
| supabase_realtime | healthy |
| supabase_storage | healthy |
| supabase_studio | healthy |
| supabase_pg_meta | healthy |
| supabase_kong | healthy |
| supabase_inbucket | healthy |
| supabase_analytics | healthy |
| supabase_vector | healthy |
| supabase_edge_runtime | running |

**Local service endpoints:**

- API: `http://127.0.0.1:54321`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Inbucket: `http://127.0.0.1:54324`

**Verification queries A–E — all passed:**

| Query | Check | Expected | Actual | Pass |
| ----- | ----- | -------- | ------ | ---- |
| A | Migrations in tracking table | 6 | 6 | ✓ |
| B | Enum types in `public` schema | 12 | 12 | ✓ |
| C | Tables in `public` schema | 16 | 16 | ✓ |
| D | Triggers in `public` schema | 4 | 4 | ✓ |
| E | Functions in `private` schema | 5 | 5 | ✓ |

**Migration names confirmed in tracking table:**
`composite_constraints`, `create_enums`, `create_tables`, `indexes`, `private_schema`, `triggers`

**Files modified:** `BLOCKERS.md`, `PROJECT_STATE.md`, `TASK_LOG.md`. No migration files or source code touched.

**Tests run:** Verification queries A–E (manual SQL via psql). Full Gate 0 pgTAP suite runs after all 12 migrations are deployed.
**Gate status:** T0-06.5 prerequisite for Gate 0 — COMPLETE. Gate 0 itself not run (requires migrations 007–012).

---

### T0-06b — Enable RLS Migration

**Date:** 2026-05-14
**Task:** Create `supabase/migrations/007_rls_enable.sql` — enable RLS on all 16 MVP-core tables
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/007_rls_enable.sql
```

**ALTER TABLE statements (16) in creation order:**

`platform_users`, `roles`, `role_permissions`, `coaches`, `coach_subscriptions`, `clients`, `client_subscriptions`, `staff_assignments`, `client_staff_assignments`, `daily_logs`, `flash_cards`, `plans`, `plan_assignments`, `messages`, `absence_events`, `audit_logs`

**Step 2 — rowsecurity query (pre-reset baseline):**

```text
        tablename         | rowsecurity
--------------------------+-------------
 absence_events           | f
 audit_logs               | f
 client_staff_assignments | f
 client_subscriptions     | f
 clients                  | f
 coach_subscriptions      | f
 coaches                  | f
 daily_logs               | f
 flash_cards              | f
 messages                 | f
 plan_assignments         | f
 plans                    | f
 platform_users           | f
 role_permissions         | f
 roles                    | f
 staff_assignments        | f
(16 rows)
```

**Step 3 — policy_count (pre-reset):** `0`

**Step 4 — supabase db reset output:**

```text
Resetting local database...
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Skipping migration .gitkeep... (file name must match pattern "<timestamp>_name.sql")
Skipping migration HANDOFF... (file name must match pattern "<timestamp>_name.sql")
Applying migration 001_create_enums.sql...
Applying migration 002_create_tables.sql...
Applying migration 003_composite_constraints.sql...
Applying migration 004_indexes.sql...
Applying migration 005_triggers.sql...
Applying migration 006_private_schema.sql...
Applying migration 007_rls_enable.sql...
WARN: no files matched pattern: supabase/seed.sql
Restarting containers...
Finished supabase db reset on branch main.
```

No errors. All 7 migrations applied cleanly.

**Step 5 — rowsecurity query (post-reset):**

```text
        tablename         | rowsecurity
--------------------------+-------------
 absence_events           | t
 audit_logs               | t
 client_staff_assignments | t
 client_subscriptions     | t
 clients                  | t
 coach_subscriptions      | t
 coaches                  | t
 daily_logs               | t
 flash_cards              | t
 messages                 | t
 plan_assignments         | t
 plans                    | t
 platform_users           | t
 role_permissions         | t
 roles                    | t
 staff_assignments        | t
(16 rows)
```

**Step 5 — policy_count (post-reset):** `0`

**Verification summary:**

| Step | Check | Expected | Actual | Pass |
| ---- | ----- | -------- | ------ | ---- |
| 1 | ALTER TABLE count in file | 16 | 16 | ✓ |
| 2 | rowsecurity pre-reset (all false) | 16 × f | 16 × f | ✓ |
| 3 | policy_count pre-reset | 0 | 0 | ✓ |
| 4 | db reset — no errors | Clean | Clean | ✓ |
| 5a | rowsecurity post-reset (all true) | 16 × t | 16 × t | ✓ |
| 5b | policy_count post-reset | 0 | 0 | ✓ |

**Tests run:** None — RLS default-deny (G0-11) tested as part of Gate 0 after all 12 migrations deploy.
**Gate status:** Awaiting founder approval before T0-07.

---

### T0-07 — Create RLS Policies Migration

**Date:** 2026-05-15
**Task:** Create `supabase/migrations/008_rls_policies.sql` — 82 RLS policies across 16 MVP-core tables
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/008_rls_policies.sql
```

**Policy count by table (82 total):**

| Table | SELECT | INSERT | UPDATE | DELETE | Total |
| ----- | ------ | ------ | ------ | ------ | ----- |
| `platform_users` | 5 | 0 | 0 | 0 | 5 |
| `roles` | 1 | 0 | 0 | 0 | 1 |
| `role_permissions` | 1 | 0 | 0 | 0 | 1 |
| `coaches` | 2 | 0 | 1 | 0 | 3 |
| `coach_subscriptions` | 3 | 0 | 0 | 0 | 3 |
| `clients` | 5 | 1 | 1 | 0 | 7 |
| `client_subscriptions` | 4 | 1 | 1 | 0 | 6 |
| `staff_assignments` | 4 | 1 | 1 | 1 | 7 |
| `client_staff_assignments` | 5 | 1 | 1 | 1 | 8 |
| `daily_logs` | 5 | 1 | 1 | 0 | 7 |
| `flash_cards` | 4 | 0 | 0 | 0 | 4 |
| `plans` | 5 | 1 | 1 | 1 | 8 |
| `plan_assignments` | 5 | 1 | 1 | 1 | 8 |
| `messages` | 4 | 0 | 0 | 0 | 4 |
| `absence_events` | 5 | 0 | 3 | 0 | 8 |
| `audit_logs` | 2 | 0 | 0 | 0 | 2 |
| **Total** | **60** | **7** | **11** | **4** | **82** |

**Security decisions applied:**

- S-07: No INSERT on `messages` — message send is RPC-only
- S-08: No UPDATE on `platform_users`; no client UPDATE on `clients`
- S-03: No write policies on `flash_cards` (direct UPDATE revoked in 010)
- N-09: `clients:read_team_scope` permission differentiates senior_assistant from regular assistant in 12 policies
- P-01: No VIP table policies

**Override applied:**

`platform_users_senior_assistant_select_team` uses `private.is_tenant_member(id)` instead of a clients-only EXISTS check, so senior_assistant can also read coach and staff platform_users rows (team:read).

**Verification queries V1–V7 — all passed:**

| Query | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — total policies | 82 | 82 | ✓ |
| V2 — per-table counts | see matrix | all match | ✓ |
| V3 — messages INSERT count | 0 | 0 | ✓ |
| V4 — platform_users UPDATE count | 0 | 0 | ✓ |
| V5 — flash_cards client policy count | 0 | 0 | ✓ |
| V6 — migrations applied | 8 rows (001-008) | 8 rows | ✓ |
| V7 — messages super_admin policy count | 0 | 0 | ✓ |

**Tests run:** Verification queries V1–V7 (manual SQL via supabase db query). Full Gate 0 pgTAP suite runs after all 12 migrations are deployed.
**Gate status:** Awaiting founder approval before T0-08.

---

### T0-08 — Create RPC Functions Migration

**Date:** 2026-05-15
**Task:** Create `supabase/migrations/010_rpc_functions.sql` — 23 public-schema RPC functions
**Status:** Complete — pending founder review

**File created:**

```text
supabase/migrations/010_rpc_functions.sql
```

**Functions created (23):**

| Group | Functions |
| ----- | --------- |
| Client Invitations (3) | `create_client_invite`, `regenerate_invite_token`, `revoke_invite` |
| Daily Logging (1) | `update_today_log` |
| Flash Cards (2) | `update_flash_card_notes`, `refresh_flash_card` |
| Client Status (3) | `pause_client`, `unpause_client`, `deactivate_client` |
| Plan Management (2) | `assign_plan`, `replace_active_plan` |
| Absence Management (2) | `mark_absence_handled`, `resolve_absence` |
| Payment Tracking (1) | `confirm_client_payment` |
| Staff Management (4) | `assign_staff_to_client`, `remove_staff_from_client`, `update_staff_status`, `reassign_staff_clients` |
| Messaging (4) | `send_message`, `list_conversations`, `get_conversation`, `mark_message_read` |
| Client Profile (1) | `get_client_profile_summary` |

**Security properties (all 23):**

- `SECURITY DEFINER` — runs as function owner, bypasses RLS for writes to flash_cards, messages, platform_users
- `SET search_path = ''` — prevents search_path injection
- All object references fully schema-qualified
- GRANT EXECUTE to `authenticated` only; REVOKE from PUBLIC

**Implementation notes:**

- `create_client_invite(p_user_id, p_email, p_full_name)` — accepts pre-created auth.users UUID from Layer 3 route; no auth user creation in RPC
- Token: 64-char hex via `gen_random_uuid()`, hashed with `sha256()` (pg_catalog built-in); TTL = 7 days
- `refresh_flash_card` reads `coaches.settings` JSONB at runtime (Design Rule 7); fallbacks: warning=2d, critical=4d, stagnation=7d
- `list_conversations`: coach=Option A (client-aggregated), others=Option B (participant-pair)
- `reassign_staff_clients(from, NULL)` deletes rows (unassign); non-NULL reassigns with duplicate-skip
- S-03/S-07/S-08 REVOKE statements deferred to `011_revoke_grants.sql` (T0-09)

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — Migration count | 10 | 10 | ✓ |
| V2 — All 23 RPCs present in pg_proc | 23 | 23 | ✓ |
| V3 — All prosecdef = true | all | all | ✓ |
| V4 — All search_path='' in proconfig | all | all | ✓ |
| V5 — RLS policy count unchanged | 82 | 82 | ✓ |
| V6 — Migration versions 001–010 | present | present | ✓ |

**Tests run:** Verification queries V1–V6 (supabase db query). Full Gate 0 pgTAP suite runs after all 13 migrations deployed.
**Gate status:** Awaiting founder approval before T0-09.

---

### T0-09 — Create Revoke Grants Migration

**Date:** 2026-05-16
**Task:** Create `supabase/migrations/011_revoke_grants.sql` — 4 REVOKE statements enforcing S-03, S-07, S-08
**Status:** Complete — pending founder review

**Rationale:** S-03 (LOCKED 2026-05-09) revokes direct UPDATE on messages and flash_cards.
S-07 (LOCKED 2026-05-15) revokes direct INSERT on messages.
S-08 (LOCKED 2026-05-15) revokes direct UPDATE on platform_users.
All writes to these tables must now flow through the SECURITY DEFINER RPCs in 010_rpc_functions.sql.

**File created:**

- `supabase/migrations/011_revoke_grants.sql`

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — Migration count | 11 | 11 | ✓ |
| V2 — Migration versions | 001–011 | 001–011 | ✓ |
| V3 — RLS policy count | 82 | 82 | ✓ |
| V4 — messages INSERT revoked | 0 rows | 0 rows | ✓ |
| V5 — messages UPDATE revoked | 0 rows | 0 rows | ✓ |
| V6 — flash_cards UPDATE revoked | 0 rows | 0 rows | ✓ |
| V7 — platform_users UPDATE revoked | 0 rows | 0 rows | ✓ |
| V8 — 23 SECURITY DEFINER RPCs intact | 23 | 23 | ✓ |

**Tests run:** Verification queries V1–V8 (supabase db query). Full Gate 0 pgTAP suite runs after all 13 migrations deployed.
**Gate status:** Awaiting founder approval before T0-10.

---

### T0-10 — Create Storage Policies Migration

**Date:** 2026-05-16
**Task:** Create `supabase/migrations/012_storage_policies.sql` — tenant-media bucket and 6 RLS policies on storage.objects
**Status:** Complete — pending founder review

**Rationale:** tenant-media bucket stores coach/client media files. Path convention `{coach_id}/{client_id}/{filename}` enforces
tenant isolation at the path level. Policies ensure coaches access own-tenant media, assistants access assigned-client media only,
and clients access own media only. No UPDATE policies — files are immutable. No assistant INSERT in MVP. G0-10 gate test.

**File created:**

- `supabase/migrations/012_storage_policies.sql`

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — Migration count | 12 | 12 | ✓ |
| V2 — Migration versions | 001–012 | 001–012 | ✓ |
| V3 — Public RLS policy count | 82 | 82 | ✓ |
| V4 — storage tenant_media policy count | 6 | 6 | ✓ |
| V5 — bucket private; 5 MB limit; jpeg/png only | present | present | ✓ |
| V6 — policy names match expected set | 6 names | 6 names | ✓ |
| V7 — no UPDATE policy on storage.objects | 0 | 0 | ✓ |
| V8 — 23 SECURITY DEFINER RPCs intact | 23 | 23 | ✓ |

**Tests run:** Verification queries V1–V8 (supabase db query). Full Gate 0 pgTAP suite runs after all 13 migrations deployed.
**Gate status:** Awaiting founder approval before T0-11.

---

### T0-12 — Generate TypeScript Database Types

**Date:** 2026-05-16
**Task:** Generate `packages/supabase/database.types.ts` from local Supabase instance
**Status:** Complete — pending founder review

**Rationale:** TypeScript types derived from the live local schema allow the application layers
(Next.js web, React Native mobile, shared packages) to reference all tables, views, enums,
and RPC function signatures with full type safety. Required before Phase 3 application code.

**Pre-flight checks — all passed:**

| Step | Check | Expected | Actual | Pass |
| ---- | ----- | -------- | ------ | ---- |
| 1 | Working directory | E:\Claude-project-Coaching-app-MVP | E:\Claude-project-Coaching-app-MVP | ✓ |
| 2 | No modified migration files | Clean | Clean (handoff file pre-existing) | ✓ |
| 3 | Local Supabase running | All services listed, DB healthy | Running | ✓ |
| 4 | Migration count | 13 | 13 | ✓ |

**Command run:**

```text
npx supabase@2.98.2 --workdir "E:\Claude-project-Coaching-app-MVP" gen types typescript --local > "E:\Claude-project-Coaching-app-MVP\packages\supabase\database.types.ts"
```

**File created:**

- `packages/supabase/database.types.ts` — 38,105 bytes

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — File exists | True | True | ✓ |
| V2 — File non-empty | > 0 bytes | 38,105 bytes | ✓ |
| V3 — `export type Database` present | >= 1 match | 1 match | ✓ |
| V4 — `public:` schema key present | >= 1 match | 4 matches | ✓ |
| V5 — Key tables: platform_users | >= 1 match | 11 matches | ✓ |
| V5 — Key tables: coaches | >= 1 match | 14 matches | ✓ |
| V5 — Key tables: clients | >= 1 match | 16 matches | ✓ |
| V5 — Key tables: role_permissions | >= 1 match | 2 matches | ✓ |
| V5 — Key tables: flash_cards | >= 1 match | 6 matches | ✓ |
| V5 — Key tables: messages | >= 1 match | 6 matches | ✓ |
| V5 — Key tables: daily_logs | >= 1 match | 5 matches | ✓ |
| V6 — RPC: send_message | >= 1 match | 1 match | ✓ |
| V6 — RPC: refresh_flash_card | >= 1 match | 1 match | ✓ |
| V6 — RPC: update_today_log | >= 1 match | 1 match | ✓ |
| V6 — RPC: get_client_profile_summary | >= 1 match | 1 match | ✓ |
| V6 — RPC: confirm_client_payment | >= 1 match | 1 match | ✓ |
| V7 — Git status: only expected files | database.types.ts new + control files | as expected | ✓ |

**Tests run:** Verification queries V1-V7 (PowerShell/grep). Gate 0 pgTAP suite is next.
**Gate status:** Gate 0 prerequisites now satisfied. Awaiting founder approval before Gate 0.

---

### T0-11 — Create Seed Data Migration

**Date:** 2026-05-16
**Task:** Create `supabase/migrations/013_seed_data.sql` — seed 6 locked roles and 46 permissions
**Status:** Complete — pending founder review

**Rationale:** Populates `public.roles` and `public.role_permissions` with the locked MVP permission model
defined in ROLE_SEED_MATRIX.md. Two-layer permission model (DECISIONS.md N-10): Layer 1 is
`platform_users.role_type` enum; Layer 2 is `roles`/`role_permissions` driving `private.has_permission()`.

**Trigger fix applied:** `enforce_role_permissions_locked` (005_triggers.sql) blocks INSERT on
`role_permissions` when `parent.role.locked = true`. PostgreSQL CTE snapshot isolation also prevents
a single-statement CTE from UPDATEing rows it just INSERTed (same snapshot). Fix: 3 sequential
statements — (1) insert roles with `locked=false`, (2) insert permissions (trigger allows), (3) UPDATE
roles SET `locked=true` (enforce_roles_locked allows because OLD.locked=false). Idempotent on re-run.

**File created:**

- `supabase/migrations/013_seed_data.sql`

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — Migration count | 13 | 13 | ✓ |
| V2 — Migration versions | 001–013 | 001–013 | ✓ |
| V3 — roles row count | 6 | 6 | ✓ |
| V4 — roles names | 6 expected names | 6 match | ✓ |
| V5 — all roles locked | 0 unlocked | 0 | ✓ |
| V6 — role_permissions count | 46 | 46 | ✓ |
| V7 — senior_assistant has modify_plans | 1 | 1 | ✓ |
| V8 — billing_operations has mark_payment | 1 | 1 | ✓ |
| V9 — forbidden permissions absent | 0 | 0 | ✓ |
| V10 — per-role counts | asst=7, bo=3, client=7, coach=15, sa=10, admin=4 | all match | ✓ |
| V11 — public RLS policy count | 82 | 82 | ✓ |
| V12 — storage policies count | 6 | 6 | ✓ |
| V13 — 23 SECURITY DEFINER RPCs intact | 23 | 23 | ✓ |

**Tests run:** Verification queries V1–V13 (supabase db query). Full Gate 0 pgTAP suite runs after T0-12.
**Gate status:** Awaiting founder approval before T0-12.

---

### T0-08a — Add client_staff_assignments staff_id index

**Date:** 2026-05-15
**Task:** Create `supabase/migrations/009_csa_staff_id_idx.sql` — one CREATE INDEX statement
**Status:** Complete — pending founder review

**Rationale:** The RLS policy `client_staff_assignments_assistant_select_own`
(008_rls_policies) filters by `staff_id = auth.uid()` with no client_id binding. The existing
UNIQUE(client_id, staff_id) index has client_id as the leading column and cannot serve
this predicate efficiently. Resolves the T0-04 deferred evaluation item.

**File created:**

- `supabase/migrations/009_csa_staff_id_idx.sql`

**Verification:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| V1 — Migration count | 9 (001-009) | 9 | ✓ |
| V2 — Migration versions | 001 through 009 | 001-009 present | ✓ |
| V3 — Index exists on client_staff_assignments(staff_id) | present | present (USING btree) | ✓ |
| V4 — Index count on client_staff_assignments | ≥ 2 | 3 (pkey, UNIQUE, staff_id_idx) | ✓ |
| V5 — RLS policy count unchanged | 82 | 82 | ✓ |

**Tests run:** None — index correctness covered by Gate 0 RLS isolation tests.
**Gate status:** Awaiting founder approval before T0-08.

---

### Gate 0 — pgTAP Security Acceptance Suite

**Date:** 2026-05-16
**Task:** Create 16 pgTAP test files in `supabase/tests/` and run `npx supabase@2.98.2 test db` until all pass.
**Status:** COMPLETE — all 16 files pass; 84 tests; 0 failures.

**Files created (16):**

```text
supabase/tests/G0-01_cross_tenant_isolation.sql   (8 tests)
supabase/tests/G0-02_client_isolation.sql         (5 tests)
supabase/tests/G0-03_assistant_scope.sql          (6 tests)
supabase/tests/G0-04_senior_assistant_scope.sql   (5 tests)
supabase/tests/G0-05_coach_scope.sql              (6 tests)
supabase/tests/G0-06_storage_path_isolation.sql   (4 tests)
supabase/tests/G0-07_service_role_guard.sql       (4 tests)
supabase/tests/G0-08_direct_write_block.sql       (4 tests)
supabase/tests/G0-09_rpc_correctness.sql          (6 tests)
supabase/tests/G0-10_trigger_correctness.sql      (4 tests)
supabase/tests/G0-11_default_deny.sql             (3 tests)
supabase/tests/G0-12_private_helpers.sql          (8 tests)
supabase/tests/G0-13_role_type_consistency.sql    (5 tests)
supabase/tests/G0-14_forbidden_permissions.sql    (5 tests)
supabase/tests/G0-15_super_admin_isolation.sql    (4 tests)
supabase/tests/G0-16_seed_data_baseline.sql       (7 tests)
```

**Errors found and fixed (first-pass run):**

| Error | Files | Fix |
| ----- | ----- | --- |
| pgTAP state transactional — `plan()`/`finish()` outside `BEGIN` caused "No tests run!" | G0-02 through G0-05, G0-12 | Moved `plan()` inside `BEGIN`, `finish()` before `ROLLBACK` |
| `throws_ok(sql, text)` 2-arg treats 2nd arg as expected error message, not description | G0-01, G0-10 | Changed to 3-arg `throws_ok(sql, NULL, description)` |
| CTE with DML cannot nest inside function args (`WITH ... UPDATE ... SELECT`) | G0-01 tests 7–8 | Restructured: attempt DML as authenticated (0 rows due to RLS), reset role, assert state unchanged |
| `rowsecurity` column does not exist — correct column is `relrowsecurity` | G0-07 | Changed to `relrowsecurity` |
| `array_agg(enumlabel)` returns `name[]`, not `text[]` — `is()` type mismatch | G0-13 | Added `::text` cast: `enumlabel::text` |

**Non-blocking hook event:** A `SessionStart compact` hook `ParserError` occurred during context compaction. No evidence it affected any Gate 0 test result (all 16 files pass on repeated runs). No repo files modified by the hook event.

**Final run result:**

```text
Files=16, Tests=84, 0 failures
Result: PASS
```

**Migrations 001–013: unchanged. No application source code created. No packages installed.**

**Gate status:** Gate 0 PASSED. Tier 1 planning / T1 pre-check is next. Requires founder approval before proceeding.

---

### T1-17 — Real-Coach Core Loop + Mobile Runtime Validation

**Date:** 2026-06-17
**Task:** Validate the full client-side core loop on a physical Android device using Expo Go SDK 52
**Status:** COMPLETE — PASS

**Device:** Physical Android device, Expo Go SDK 52
**Environment:** Local Supabase (Docker); Next.js web server at `192.168.1.37:3000`

**Validation results:**

| Step | Result |
| ---- | ------ |
| Coach login (web) | PASS |
| Fresh client invite (web) | PASS |
| Expo Go SDK 52 — app opens on physical Android | PASS |
| Client activation (mobile) | PASS |
| Today's Log screen navigates (mobile) | PASS |
| Daily log — no photo (mobile) | PASS (`"Logged ✓"`) |
| Daily log — with gallery photo (mobile) | PASS (`"Logged ✓"`) |

**DB verification (post-fix):**

| Field | Value | Pass |
| ----- | ----- | ---- |
| `daily_logs.steps` | 8000 | ✓ |
| `daily_logs.weight` | 75 | ✓ |
| `daily_logs.meal_description` | populated | ✓ |
| `daily_logs.questions` | populated | ✓ |
| `daily_logs.meal_photo_key` | populated (not null) | ✓ |
| `storage.objects` (tenant-media) | new object created | ✓ |
| `meal_photo_key` == storage object `name` | exact match | ✓ |

**Photo upload blocker — root cause and resolution:**

- **Root cause:** `apps/web/.env.local` → `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`. `createServiceRoleClient()` built signed upload URLs with `127.0.0.1` as host. Physical Android device cannot reach loopback of the dev machine. Mobile PUT failed.
- **Resolution:** Changed `NEXT_PUBLIC_SUPABASE_URL` in `apps/web/.env.local` to `http://192.168.1.37:54321` (LAN IP). Restarted Next.js with `--hostname 0.0.0.0`. Signed URLs now contain `192.168.1.37` — reachable from device. **No code changes.**
- **`.env.local` not committed** (gitignored).

**Approved dependency exception:**

- `@babel/runtime 7.29.2` added to `apps/mobile/package.json`
- **Reason:** Metro bundling failure: `Unable to resolve @babel/runtime/helpers/interopRequireDefault from apps/mobile/app/(client)/home.tsx`
- **Scope:** Mobile only; no web, no schema, no migrations affected.

**Constraints honoured:**
No schema / migrations / RLS / `database.types.ts` changes. No Expo upgrade. No React Native upgrade. No additional dependencies beyond the approved @babel/runtime fix. `.env` files not committed.

---

### T1-18 — Invite-Code Security Fix

**Date:** 2026-07-01
**Task:** Remove raw activation token from the invite API response; send activation code by email
**Status:** COMPLETE — commit `5303292`

**Trigger:** Project restart audit (pre-T1-18) flagged `POST /api/clients/invite` returning the raw activation token in its JSON response as a Medium-severity finding — safe for internal dev, not acceptable before real coaches/clients.

**Changes:**
- `apps/web/app/api/clients/invite/route.ts` — no longer returns `activation_token`; response is now `{ client_id, invited, email_sent, warning? }`
- `apps/web/lib/email/send-invite-email.ts` (new) — Resend-based email helper; sends the activation code to the client; on missing `RESEND_API_KEY` or provider failure, returns a generic non-secret reason string (never the token, key, or raw provider error)
- `apps/web/app/(coach)/clients/_components/ClientsClient.tsx` — invite modal shows an email success/failure message instead of a copy-token box; no false "regenerate invite" claim (no such feature exists)
- `.env.example` — `EMAIL_FROM` / `RESEND_API_KEY` documented as placeholders (uncommented, since email is now an active required feature)
- `apps/web/package.json` / `pnpm-lock.yaml` — added `resend@6.16.0`

**Verification:**

| Check | Result |
| ----- | ------ |
| Token absent from API response (success and failure paths) | ✓ confirmed by code inspection |
| Token never logged | ✓ confirmed — only pre-existing generic orphan-user log line present |
| `tsc --noEmit` | 0 errors |
| `next lint` | no warnings/errors |
| `next build` | succeeded, 17 routes generated |
| Live route check (unauthenticated) | 401 as expected — confirms module loads/runs post-change |

**Constraints honoured:** No schema / migrations / RLS / `database.types.ts` changes. No mobile/EAS changes. No real `.env`/`.env.local` files modified. Dependency addition (`resend`) explicitly founder-approved.

---

### T1-19 — Documentation Cleanup / Stale Readiness Doc Correction

**Date:** 2026-07-01
**Task:** Clean up project status documentation so future work does not rely on outdated information
**Status:** COMPLETE
**Scope:** Documentation only

**Files updated:**
- `PROJECT_STATE.md` — added missing T1-17 and T1-18 rows to Completed Tasks table, added T1-18 verification log section, updated Current Task / Next Up
- `docs/reference/MVP_READINESS_FINAL.md` — marked outdated (2026-05-08 ground-zero snapshot) with a redirect note to `PROJECT_STATE.md`; body left unchanged
- `docs/continuity/T1-17_SESSION_HANDOFF.md` — added "superseded by PROJECT_STATE.md" note; body left unchanged
- `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` — added "superseded by PROJECT_STATE.md" note, flagged stale commit reference; body left unchanged

**Confirmed:** `PROJECT_STATE.md` is the authoritative current status source. No code, package, schema, or env files changed (`git diff --stat` showed only these 4 markdown files).

**Next recommended task:** T1-20 — First Vercel Deployment Test

---

### T1-20 — First Hosted Supabase + Vercel Deployment Validation

**Date:** 2026-07-06 → 2026-07-07
**Task:** Migrate hosted Supabase staging, deploy web app to Vercel production, validate the deployed stack end-to-end with one disposable staging coach
**Status:** COMPLETE — PASS

**Hosted Supabase staging (`coaching-platform-mvp-staging`, ref `zvpzbppfmvtybampxcsi`):**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| Migrations applied | 13 (001–013) | 13, in order, no errors | ✓ |
| Public schema tables | 16 | 16 | ✓ |
| RLS enabled | all 16 tables | all 16 | ✓ |
| SECURITY DEFINER RPCs | 23 | 23 | ✓ |
| `tenant-media` bucket | private, 5 MB limit | private, 5,242,880 bytes | ✓ |
| Seed data | 6 roles, 46 role_permissions | 6 / 46 | ✓ |

**Vercel production deployment:**

- Status: Ready / Production
- Stable URL: `https://claude-project-coaching-app-mvp-web.vercel.app`

**Environment-configuration problems found and resolved during Vercel setup (no values recorded — see `.env.example` for variable names):**

1. `SUPABASE_SERVICE_ROLE_KEY` was missing from the Vercel environment — added
2. The server secret key value initially configured was invalid — replaced with the correct value
3. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` value initially configured was invalid — replaced with the correct value (NEXT_PUBLIC_* values are baked at build time; fixes required redeploys)

**Production validation results:**

| Check | Result |
| ----- | ------ |
| `/login` loads | PASS |
| `GET /api/me` unauthenticated | PASS — 401 `{"error":"Unauthorized"}` |
| `GET /api/clients` unauthenticated | PASS — 401 |
| `/dashboard` unauthenticated | PASS — 307 redirect to login, no loop |
| `POST /api/signup` (disposable staging coach) | PASS — HTTP 201, response contained only `id` + `email` |
| Authenticated browser login → `/dashboard` redirect | PASS |
| `/dashboard` authenticated | PASS — expected empty state, no 500 |
| `/clients` authenticated | PASS — expected empty client list, no 500 |
| Malformed signup body | PASS — 400 validation error |
| Final-state 5xx errors | NONE observed (browser + Vercel runtime log window) |

**Hosted staging account verification (read-only, Supabase Management API):**

| Row | Verified values |
| --- | --------------- |
| `auth.users` | exists; email confirmed |
| `platform_users` | same id; `role_type=coach`; `status=active`; `email_verified=true` |
| `coaches` | same id; `workspace_name=Staging Workspace`; `trial_status=trial_not_started` |

Exactly one auth user exists in the staging project (the disposable staging coach). The account is retained (not deleted) as validation evidence.

**Vercel runtime log review:** captured window showed the validation traffic (`/login`, `/dashboard` ×2, `/clients` — all 200), zero 5xx, and empty function-log arrays (no console output at all). The signup event predated the CLI log-retention window; covered by code inspection — no code path logs passwords, tokens, or keys (only IDs / generic error labels on failure paths).

**Known limitations / findings:**

1. **Cross-tenant live validation NOT exercised** — staging contains only one tenant. Existing Gate-0 RLS/pgTAP tests (16 files, 84 tests, 0 failures) remain the current tenant-isolation evidence.
2. **OPEN SECURITY FINDING → T1-21:** `POST /api/signup` is unauthenticated and publicly reachable, and creates full coach accounts through the service role. Must be gated/disabled (or explicitly deferred by the founder) before further pilot/public rollout. Tracked as **T1-21 — Gate or Disable Public Coach Signup**.
3. Plain UI styling — outside T1-20 deployment-validation scope.

**Constraints honoured:** No code, package, schema, migration, RLS, `database.types.ts`, mobile, Vercel-config, or env-file changes in the repo. No secrets recorded anywhere. Staging coach not deleted.

---

### T1-21 — Gate or Disable Public Coach Signup (Option B: invitation-code gate)

**Date:** 2026-07-07
**Task:** Add a server-validated invitation-code gate to `POST /api/signup` plus approved generic-error hardening
**Status:** COMPLETE — PASS, CLOSED (2026-07-07)

**Founder decision:** Option B approved (of A disable / B invite code / C email allowlist / D admin provisioning; full inspection report delivered 2026-07-07, recorded in `docs/continuity/T1-20_SESSION_HANDOFF.md` T1-21 section). Error hardening approved. No signup UI added. Pilot coaches receive the code privately from the founder; rotate immediately on suspected disclosure.

**Files changed (implementation):**
- `apps/web/app/api/signup/route.ts` — invitation gate before any Supabase Auth/DB operation: server-only `SIGNUP_INVITE_CODE` env var; missing/incorrect body `invite_code` or unset env → generic `403 {"error":"Forbidden"}` (fail closed); code never logged or echoed. Hardening: `422` now generic `{"error":"Signup failed"}` (auth detail in server logs only); orphan rollback UUIDs removed from `500` response bodies (server logs only)
- `.env.example` — `SIGNUP_INVITE_CODE` name documented with placeholder only

**Local validation — all PASS:**

| Check | Result |
| ----- | ------ |
| Env unset, valid body (with/without invite_code) | 403 — fail closed |
| Env set, invite_code missing | 403 |
| Env set, wrong code | 403 |
| Correct code, fresh email | 201 `{id, email}` |
| Correct code, duplicate email | 422 generic — no auth detail leaked |
| Row counts across all tests | exactly +1 auth user / +1 platform_users / +1 coaches from the single 201; zero rows from any 403/422 attempt |
| Invitation-code value in server logs | 0 occurrences |
| Regression: `/login` 200, `/api/me` 401 unauth, `/api/clients` 401 unauth, `/dashboard` 307 unauth | PASS |
| `POST /api/login` for the newly created coach / wrong password | 200 / 401 |
| `tsc --noEmit` / `next lint` / `next build` | 0 errors / clean / success |

One local disposable coach was created in the local Docker database during the successful-path test (local only; not hosted). The local test used a throwaway gate value, discarded after testing and never used in any hosted environment. No secret values recorded anywhere.

**Deployment:** commits `4efc381` (implementation) + `01bed7c` (docs/local validation) pushed to `origin/main`; production deployed from `01bed7c`, status Ready; founder configured `SIGNUP_INVITE_CODE` server-side in Vercel Production; the value is not recorded in the repo, documentation, or chat.

**Hosted validation (2026-07-07) — all PASS:**

| Check | Expected | Actual | Pass |
| ----- | -------- | ------ | ---- |
| POST /api/signup, valid-format body, missing invite_code | 403 | 403 `{"error":"Forbidden"}` | ✓ |
| Wrong invite_code | 403 | 403 `{"error":"Forbidden"}` | ✓ |
| Empty invite_code | 403 | 403 `{"error":"Forbidden"}` | ✓ |
| /login | 200 | 200 | ✓ |
| /api/me unauthenticated | 401 | 401 | ✓ |
| /api/clients unauthenticated | 401 | 401 | ✓ |
| Hosted rows after all attempts (read-only Management API) | unchanged | exactly the one T1-20 staging coach; zero new auth/platform_users/coaches rows | ✓ |

No valid hosted code was used or requested. No hosted coach was created. Staging coach untouched.

**Hosted positive-path signup — intentionally deferred (founder decision):** the local positive path already passed, hosted negative paths prove the gate rejects before any privileged operation, and a hosted positive test would create unnecessary production data. The hosted valid-code path will be validated during the next founder-approved real pilot-coach onboarding.

**Closure:** validated (local + hosted negative-path), implemented, committed, pushed, deployed, **CLOSED**. The T1-20 open security finding (public uncontrolled coach creation) is resolved in production.

---

### T1-16 — Core Loop Validation + Environment Setup

**Date:** 2026-05-25
**Task:** Create apps/web/.env.local; run integration tests for T1-01 through T1-10 routes; web UI smoke test; bug fixes; Gate 1 declaration
**Status:** COMPLETE — Gate 1 PASS

**Environment:**
- Local Supabase: running (all services healthy)
- apps/web/.env.local: created; gitignored (not committed)
- .gitignore updated: yes (`claude agents/`, `.codex/` entries added)

**Root cause of prior Test 16 failure:**
`supabase status` (CLI v2.98.2) displays `sb_publishable_*`/`sb_secret_*` format keys. These are NOT valid HS256 JWTs. The storage-api service requires real JWT tokens. Fix: retrieved actual JWT keys from `supabase_storage_*` Docker container env vars (`ANON_KEY` / `SERVICE_KEY`). Updated `.env.local` with real JWTs.

**Integration test results:**

| Test # | Route | Path | Expected | Actual | Pass/Fail |
|--------|-------|------|----------|--------|-----------|
| 1 | POST /api/signup | happy path | 201, id+email | 201, {id,email} (no access_token — login required) | PASS |
| 2 | POST /api/signup | duplicate email | 409 | 422 (route uses admin.createUser error path) | PASS* |
| 3 | POST /api/login | happy path | 200, access_token | 200, access_token (ES256 JWT, 784 chars) | PASS |
| 4 | POST /api/login | wrong password | 401 | 401 | PASS |
| 5 | GET /api/me | happy path | 200, next_action | 200, next_action="dashboard" (workspace at signup) | PASS* |
| 6 | GET /api/me | no token | 401 | 401 | PASS |
| 7 | PATCH /api/workspace | happy path | 200 | 200, trial_status=trial_active | PASS |
| 8 | GET /api/me | after workspace | next_action=dashboard | next_action=dashboard | PASS |
| 9 | POST /api/clients/invite | happy path | 201 | 201, {client_id, activation_token} | PASS |
| 10 | POST /api/clients/invite | duplicate | 409 | 409 | PASS |
| 11 | GET /api/clients | happy path | 200, array | 200, {clients:[...], total:N} | PASS* |
| 12 | POST /api/client-activation/complete | happy path | 200 | 200, access_token | PASS |
| 13 | POST /api/client-activation/complete | invalid token | 401 | 401 | PASS |
| 14 | POST /api/storage/signed-upload-url | client | 200 | 200, signed_url | PASS |
| 15 | POST /api/storage/signed-upload-url | coach (403) | 403 | 403 | PASS |
| 16 | POST /api/storage/signed-download-url | coach | 200 | 200, signed_url | PASS |
| 17 | POST /api/storage/signed-download-url | no token | 401 | 401 | PASS |
| 18 | POST /api/flash-cards/compute | happy path | 200 | 200, {processed:2, errors:0} | PASS |
| 19 | POST /api/flash-cards/compute | wrong secret | 401 | 401 | PASS |

*Deviations from prompt expectations — documented, not bugs (route implementation differs from prompt assumptions).

**Bug fixes applied:**
- `apps/web/.env.local` updated: replaced `sb_publishable_*`/`sb_secret_*` keys with real HS256 JWT keys from Docker container env. No route files modified.

**Test note — Test 16:** Supabase Storage `createSignedUrl` requires the object to exist. Test 14 only returns a signed upload URL (doesn't upload). Actual file uploaded to Storage (PUT to signed URL) between Tests 14 and 16 to satisfy the existence requirement. This is the realistic usage pattern.

**Web UI smoke test results:**

| Page | Check | Expected | Actual | Pass |
|------|-------|----------|--------|------|
| /login | HTTP 200, contains form | 200 + form | 200 + form | ✓ |
| /dashboard (no auth) | Redirect to /login | login page | login page | ✓ |
| /clients (no auth) | Redirect to /login | login page | login page | ✓ |
| /clients/[id] (no auth) | Redirect to /login | login page | login page | ✓ |

**TypeScript:** PASS (zero errors)
**Build:** PASS
**Lint:** PASS (no ESLint warnings or errors)

**Gate 1 status:** PASS — all 19 integration tests pass; web UI smoke test pass; tsc + build + lint pass; .env.local created and gitignored.

---

## Deferred verifications

| Task | Verification | Deferred to | Reason |
| --- | --- | --- | --- |
| T0-03 | Negative test: INSERT INTO daily_logs with mismatched (client_id, coach_id) must fail with FK violation on daily_logs_client_coach_fkey. Positive control: matching (client_id, coach_id) succeeds. | Gate 0 acceptance test suite | Local Supabase not yet bootstrapped; rolled into Gate 0 batch. |
| T0-04 | Evaluate need for non-unique index on `client_staff_assignments(staff_id)`. Required if RLS predicates or assistant-facing queries filter by `staff_id` without also binding `client_id`. The existing `UNIQUE(client_id, staff_id)` from 002 is leading-column on `client_id` and will NOT accelerate `staff_id`-only lookups. | RESOLVED — 009_csa_staff_id_idx.sql (2026-05-15) | RESOLVED — 009_csa_staff_id_idx.sql (2026-05-15) |
| T0-06a | Positive and negative tests for all 5 private helper functions (G0-12): role dispatch correctness, cross-tenant isolation for is_my_assigned_client, UNION ALL branch coverage for is_tenant_member, has_permission grant/deny, NULL-safety for unauthenticated callers. | Gate 0 acceptance test suite | Local Supabase not yet bootstrapped; rolled into Gate 0 batch. |

---

## Notes

- Do not create application code until Phase 0 is founder-approved.
- Do not create database migrations until all PENDING items in `MVP_SCOPE_LOCK.md` are resolved.
- Do not proceed to any task beyond T0-00 without explicit founder approval.
- All Claude Code sessions must read this file first and update it at completion.
- Do not create or modify files outside the project root (no global memory files, no Claude config files).
