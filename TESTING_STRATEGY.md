# TESTING_STRATEGY.md

**Project:** Coaching Platform MVP  
**Purpose:** Defines the test framework, test types, Gate 0 acceptance test format, and regression rules.  
**Status:** PARTIAL — app-level test frameworks are deferred until web/mobile code exists.  
**Last updated:** 2026-05-16 — D-G0-02: test path → supabase/tests/; D-G0-03: 16 categories; D-G0-05: stale count fixed

---

## Scope Rule

Tests are added in the tier they become relevant. **No test infrastructure is created before there is something to test.**

- **Now (Tier 0):** Database and RLS tests only. These are the only tests that matter before any app code exists.
- **Later (Tier 1+):** App-level tests (Vitest, Playwright, mobile) are added when web and mobile code exists. Do not set up Vitest or Playwright during Phase 0 or Tier 0.

---

## Test Framework Choices

| Layer | Framework | Status | When to add |
|---|---|---|---|
| Database / RLS acceptance tests | **pgTAP** via Supabase test runner (`supabase test db`) | LOCKED | Tier 0 — Gate 0 tests written alongside migrations |
| Web (Next.js) unit and integration | **Vitest** | LOCKED — add when web code exists | Tier 1+ |
| Web E2E | **Playwright** | LOCKED — add when web UI exists | Critical paths only (auth, invite, dashboard) |
| API / RPC integration | **Vitest** (server-side test files) | LOCKED — add when RPC code exists | Tier 1+ |
| Mobile unit | PENDING | Decide before Tier 2 mobile tasks | Options: Jest + React Native Testing Library, or Vitest |
| Mobile E2E | PENDING | Decide before Tier 2 mobile tasks | Options: Detox or Maestro |

> **PENDING:** Mobile test framework choice is required before Tier 2 mobile tasks begin. It does not block Tier 0 or Tier 1.

---

## Test File Locations

```
supabase/
  tests/              # Gate 0 RLS acceptance tests (pgTAP SQL files) — D-G0-02
tests/
  integration/        # RPC and API integration tests (Vitest)
  e2e/                # Playwright end-to-end tests
apps/
  web/
    __tests__/        # Vitest unit tests co-located with web app
  mobile/
    __tests__/        # Mobile unit tests (framework PENDING)
packages/
  shared/
    __tests__/        # Shared package unit tests
  supabase/
    __tests__/        # Supabase client utility tests
```

---

## Gate 0 — RLS Acceptance Test Suite

Gate 0 must pass **in full** before any Tier 1 task begins. Gate 0 is a suite of pgTAP SQL tests run against a local or staging Supabase instance after all Tier 0 migrations (001–013) are deployed.

### Gate 0 Test Categories

All 16 categories must have passing tests before Gate 0 is signed off.

| # | Category | What it proves |
|---|---|---|
| G0-01 | Cross-tenant isolation | A coach in Tenant A cannot read, write, or delete any row belonging to Tenant B |
| G0-02 | Client isolation | A client cannot access another client's data within the same tenant |
| G0-03 | Assistant scope | An assistant sees only their assigned clients, not all clients in the tenant |
| G0-04 | Senior assistant scope | A senior assistant sees all clients in the tenant, but not other tenants |
| G0-05 | Coach scope | A coach sees only their own tenant's data |
| G0-06 | Storage path isolation | A user cannot read or write storage objects outside their tenant-scoped path |
| G0-07 | Service role guard | Service role key is used server-side only; anon and authenticated roles cannot escalate |
| G0-08 | Direct write block | Direct `UPDATE` on `messages` and `flash_cards` is rejected for `authenticated` role |
| G0-09 | RPC correctness | Required RPCs execute successfully with correct inputs and return expected results |
| G0-10 | Trigger correctness | Locked-role triggers and role-type enforcement triggers fire correctly |
| G0-11 | Default-deny | A new table with no RLS policy returns zero rows to all non-service roles |
| G0-12 | Private helper functions | `get_my_role`, `get_my_coach_id`, `is_my_assigned_client`, `has_permission`, and `is_tenant_member` return correct results for each role type; cross-tenant and unassigned inputs are rejected; unauthenticated callers receive NULL or false |
| G0-13 | Role-type consistency | Every seeded role name matches a valid `platform_users.role_type` value or is a staff-only roles-table entry (senior_assistant, billing_operations); no orphaned roles exist |
| G0-14 | Forbidden permission check | Permissions declared OUT OF MVP (tenants:suspend, users:ban, users:restore, own_profile:write) are absent from `role_permissions`; no extra permissions exist beyond the 46 seeded rows |
| G0-15 | Super admin isolation | super_admin role cannot read message content; cannot access client flash_card data; moderation write paths (suspend/ban/restore) are absent from the schema and from role_permissions |
| G0-16 | Seed data baseline | Exactly 6 roles and 46 role_permissions rows exist; all have `locked = true` and `granted = true` respectively; no duplicate permission strings per role |

### Gate 0 Test File Format

Each test category is a separate `.sql` file in `supabase/tests/` (D-G0-02).

```
supabase/tests/
  G0-01_cross_tenant_isolation.sql
  G0-02_client_isolation.sql
  G0-03_assistant_scope.sql
  G0-04_senior_assistant_scope.sql
  G0-05_coach_scope.sql
  G0-06_storage_path_isolation.sql
  G0-07_service_role_guard.sql
  G0-08_direct_write_block.sql
  G0-09_rpc_correctness.sql
  G0-10_trigger_correctness.sql
  G0-11_default_deny.sql
  G0-12_private_helpers.sql
  G0-13_role_type_consistency.sql
  G0-14_forbidden_permissions.sql
  G0-15_super_admin_isolation.sql
  G0-16_seed_data_baseline.sql
```

### Gate 0 Run Command

```bash
# Pre-step: install pgTAP (lost on every db reset — D-G0-01)
npx supabase@2.98.2 db query --local "CREATE EXTENSION IF NOT EXISTS pgtap;"

# Run Gate 0 tests against local Supabase instance (D-G0-02)
npx supabase@2.98.2 test db
```

### Gate 0 Pass Criteria

- All test files exit with 0 failing tests
- Results are copied into the `PROJECT_STATE.md` Verification Log
- Claude Code must not proceed to T1-00 unless the Verification Log entry is written

---

## Gate Structure (All Tiers)

| Gate | After | Proves |
|---|---|---|
| Gate 0 | Tier 0 (all 13 migrations) | Database security foundation is correct |
| Gate 1 | Tier 2 (core loop complete) | Full coach signup → flash card loop works end-to-end |
| Gate 2 | Tier 3 (communication) | Messaging works; push/email delivery confirmed |
| Gate 3 | Tier 4 (subscriptions) | Stripe billing, trial → paid conversion, cancellation |
| Gate 4 | Tier 5 (plans + team + admin reads) | Plan builder, team invites, admin read views |
| Gate 5 | Tier 6 (VIP Group, if IN) | VIP Group features work end-to-end |
| Gate 6 | Tier 7 (admin moderation, if IN) | Moderation write paths work and are RLS-guarded |

---

## Regression Rules

1. **All existing tests must pass after every task.** A task that breaks a passing test is not complete.
2. **Do not skip or comment out tests to make a task pass.** Fix the underlying issue.
3. **If a regression is discovered after a task is marked complete**, open a new task to fix it. Do not amend the completed task.
4. **Gate tests are not deleted.** Gate tests remain in the suite and re-run on every subsequent gate.
5. **Test results are recorded in `PROJECT_STATE.md`** Verification Log at task completion.

---

## What Is Not Tested in MVP

| Item | Reason |
|---|---|
| Visual / snapshot tests | Too brittle for rapid MVP iteration |
| Full E2E coverage of every screen | Too slow; Playwright covers critical paths only |
| Load / performance tests | Post-MVP |
| Accessibility audits | Post-MVP |
