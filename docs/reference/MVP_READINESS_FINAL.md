# MVP_READINESS_FINAL.md

> **OUTDATED — 2026-05-08.** This document describes the project at ground zero, before Phase 0 or any Tier 0 work existed. As of 2026-07-01 the project has completed Tier 0, Gate 0, Gate 1, and Tasks T1-00 through T1-18. **`PROJECT_STATE.md` (repo root) is the current, authoritative source of status — read that file instead.** This document is kept for historical record only.

**Project:** Coaching Platform MVP
**Document type:** Canonical pre-build readiness reference
**Date:** 2026-05-08
**Owner:** Solo founder (Claude Code-assisted build)

---

## 1. Status

The project is at ground zero. No code has been written. Documentation is mature: schema, RLS, API, screens, build sequencing, environment setup, and per-task Claude Code prompts are all in place. Design is locked at 168 of 171 screens.

The project is **documentation-ready, but not execution-ready yet.** A short Phase 0 preparation session is required before any Tier 0 implementation work can begin.

---

## 2. Superseded Documents

This document is the single source of truth for the project's pre-build readiness status. It supersedes all previous readiness reviews:

- `project_readiness_review_coaching_platform.md`
- `coaching_platform_readiness_review_corrected.md`
- `review_of_corrected_readiness_review_clean.md`
- `review_of_clean_readiness_review.md`

Older readiness reviews should be marked as superseded or moved to an archive folder. Do not consult them for current decisions. Use only this document.

---

## 3. Final Verdict

**Start with Phase 0 (bootstrap and control files), then Tier 0 (database foundation).**

Do not start app screens, dashboard UI, mobile UI, messaging, VIP Group, admin panel, or Stripe billing yet. Those depend on the foundation being locked first.

The next concrete Claude Code task is:

> **T0-00: Project Bootstrap and Control Files**

After Phase 0 outputs exist and Tier 0 migrations + Gate 0 acceptance tests pass, the project is safe to enter Tier 1 (auth) and Tier 2 (core loop).

---

## 4. Readiness Scores

### Current readiness (pre-Phase-0)

| Category | Score |
|---|---:|
| Documentation completeness | 82 / 100 |
| Technical architecture clarity | 80 / 100 |
| Claude Code execution readiness | 68 / 100 |
| **Overall practical readiness** | **74 / 100** |

The execution-readiness score is held down by missing control files, missing decision/rule files, and unspecified package manager — not by gaps in architecture.

### Projected readiness (post-Phase-0)

| Category | Projected score |
|---|---:|
| Documentation completeness | ~90 / 100 |
| Technical architecture clarity | ~85 / 100 |
| Claude Code execution readiness | ~85 / 100 |
| **Overall practical readiness** | **~88 / 100** |

These projected scores assume the 10 Phase 0 outputs (Section 7) are produced cleanly. They do not assume any code has been written — only that decisions are locked and control files exist.

---

## 5. What Can Start Now

The following work is greenlit and can begin once Phase 0 outputs are written:

- Project repo bootstrap
- Control files (`PROJECT_STATE.md`, `DECISIONS.md`, scope and rule files)
- Tier 0 database foundation (migrations 001–005: enums, tables, composite constraints, indexes, triggers)
- Tier 0 security layer (migrations 006–011: private helper functions, RLS enable, RLS policies, RPC functions, revoke grants, storage policies)
- Tier 0 seed data (migration 012: roles, role_permissions, Super Admin)
- Gate 0 RLS acceptance test suite (11 test categories per task guide)

Work proceeds tier by tier, with each gate passing before the next tier opens.

---

## 6. What Must Not Start Yet

The following must not be started until their dependencies are met:

- Coach dashboard UI
- Client mobile app UI (Home, Plan, Progress, Messages, VIP)
- Messaging RPCs and screens
- VIP Group features (any tier)
- Admin panel write paths (suspend / ban / restore)
- Admin client directory
- Stripe billing implementation
- Plan builder
- Client profile UI
- Public launch preparation

Each of these depends on Tier 0 being complete and Gate 0 passing. Several depend on founder decisions that are not yet locked (see Section 8, Later Decision Items).

---

## 7. Phase 0 Required Outputs

All 10 outputs below should be produced in **one Phase 0 preparation session** before the first Tier 0 prompt is issued. The blocker grouping in Section 8 is a priority hierarchy within this session, not a reason to defer the core-loop files to a later session.

Estimated effort: **4–6 hours of focused writing.**

| # | Output | Purpose |
|---:|---|---|
| 1 | Repo structure | Monorepo with `apps/web`, `apps/mobile`, `packages/shared`, `packages/supabase`, `supabase/migrations` |
| 2 | `PROJECT_STATE.md` | Current task, completed tasks, in-progress, blocked, next-up, verification log |
| 3 | `DECISIONS.md` | Locked architectural, naming, security, and product decisions |
| 4 | `MVP_SCOPE_LOCK.md` | Explicit yes/no on VIP, admin client directory, super admin moderation, mobile profile, push notifications, mobile pilot platform |
| 5 | `FLASH_CARD_RULES.md` | Green/yellow/red threshold logic, paused/expired overrides, interpretation rule list |
| 6 | `ROLE_SEED_MATRIX.md` | Exact permission strings per seeded role (Assistant, Senior Assistant, Billing Operations) |
| 7 | `TESTING_STRATEGY.md` | Test framework choice, Gate 0 acceptance test format, regression rule procedure |
| 8 | `.env.example` | Documents required environment variables without exposing secrets |
| 9 | `.gitignore` | Prevents secrets, builds, local files, and `node_modules` from being committed |
| 10 | Package manager / monorepo setup | pnpm workspace configuration (see Section 10) |

After all 10 outputs exist, Phase 0 is complete and Tier 0 implementation can begin.

---

## 8. Blockers by Level

### Tier 0 Blockers — Resolve Before Claude Code Starts

These are required before the first real implementation prompt (T0-00).

| Item | Why It Matters |
|---|---|
| `PROJECT_STATE.md` | Claude Code needs durable task state, current task, verification log, and next step. |
| `DECISIONS.md` | Locks naming, architecture, security rules, and scope boundaries. |
| `MVP_SCOPE_LOCK.md` | Scope affects schema decisions — specifically whether VIP tables stay in migration 002 or are deferred. |
| Repo structure | Prevents Claude Code from creating inconsistent folders. |
| Package manager choice (pnpm) | Avoids dependency and workspace inconsistency. |
| `.env.example` | Documents required environment variables without exposing secrets. |
| `.gitignore` | Prevents secrets, builds, and local files from being committed. |

### Core-Loop Blockers — Same Phase 0 Session, Lower Priority

These do not block T0-00 itself, but they must exist before the core-loop tasks (auth, invite, daily log, flash card computation, dashboard) are started. Produce them in the same Phase 0 session to avoid revisiting later.

| Item | Why It Matters |
|---|---|
| `FLASH_CARD_RULES.md` | Defines green/yellow/red logic and priority rules. The flash card is the product's core value. |
| `ROLE_SEED_MATRIX.md` | Defines seeded roles and permissions consistently. |
| `TESTING_STRATEGY.md` | Defines how Gate 0 and later acceptance tests are run. |

### Later Decision Items — Resolve Before Their Affected Tier

These are real decisions, but they should not block Phase 0 or Tier 0.

| Item | Affected Area |
|---|---|
| VIP scope (already covered in `MVP_SCOPE_LOCK.md`) | Tier 6 / community track |
| Admin role boundary | Admin panel / super admin tools |
| Mobile pilot platform | Client mobile build and testing |
| Push notifications | Messaging and reminders |
| Local vs remote Supabase workflow | Developer workflow and migration strategy |
| Stripe final pricing | Paid rollout |
| Backup restore test | Pre-launch reliability |
| Legal / privacy copy | Pilot onboarding compliance |

---

## 9. Correct Build Sequence

### Phase 0 — Bootstrap (one session, 4–6 hours)

Produce all 10 outputs from Section 7. End state: repo exists, control files exist, decisions are locked, package manager is configured.

### Phase 1 — Tier 0 Migrations

Run in this exact order:

1. Enum types migration (`001_create_enums`)
2. Tables migration (`002_create_tables`)
3. Composite constraints migration (`003_composite_constraints`)
4. Indexes migration (`004_indexes`)
5. Triggers migration (`005_triggers`)
6. Private helper functions migration (`006_private_schema`)
7. RLS enable migration (`007_rls_enable`)
8. RLS policies migration (`008_rls_policies`)
9. RPC functions migration (`009_rpc_functions`)
10. Revoke grants migration (`010_revoke_grants`)
11. Storage policies migration (`011_storage_policies`)
12. Seed data migration (`012_seed_data`)

RLS is part of Tier 0, not a later phase.

### Phase 2 — Gate 0 Acceptance Tests

Gate 0 must prove all of the following before any Tier 1 work begins:

- Cross-tenant isolation works
- A client cannot access another client's data
- An assistant sees only assigned clients
- A coach sees only their own tenant
- Storage paths are tenant-scoped
- Service role is used only server-side
- Direct writes are blocked where they should be blocked (UPDATE on `messages` and `flash_cards` revoked for authenticated role)
- Required RPCs work as expected
- Locked-role triggers fire correctly
- Role-type enforcement triggers fire correctly
- Default-deny behavior holds when policies are absent

Document results in `PROJECT_STATE.md` Verification Log. Do not proceed to Phase 3 if any test fails.

### Phase 3 — Tier 1 (Auth) and Tier 2 (Core Loop)

Only after Gate 0 passes, begin in this order:

1. Coach signup (`/api/auth/signup`)
2. Email verification + workspace creation
3. Trial activation logic
4. Coach login + post-login routing
5. Stripe integration (parallel track, not blocking core loop)
6. Client invite flow (`create_client_invite` RPC + activation route)
7. Client mobile activation screen
8. Client mobile Home / Today (daily log + meal photo upload)
9. Flash card computation (RPC + cron)
10. Coach Dashboard with flash card grid
11. Client Profile screen
12. Flash card notes (`update_flash_card_notes` RPC)

End of Phase 3 = Gate 1: full coach signup → flash card loop end-to-end.

### Phase 4 onward

Tier 3 (communication), Tier 4 (follow-up + subscriptions), Tier 5 (plans + team + admin reads), with their respective gates. VIP Group (Tier 6) and admin moderation write paths (Tier 7) remain gated on the founder decisions in `MVP_SCOPE_LOCK.md`.

---

## 10. Claude Code Rules

These rules govern every Claude Code task throughout the build:

- No architecture changes beyond the current task
- No extra endpoints
- No extra tables
- No renaming stable entities
- No modifying unrelated files
- Read `PROJECT_STATE.md` before each task
- Follow `DECISIONS.md`
- Work on only one approved task at a time
- Update `PROJECT_STATE.md` after implementation
- List all created or modified files
- Run existing tests after each task
- Report test results
- Do not mark a task complete without verification
- If a task fails, revert or stash before retrying
- Do not layer fixes on top of broken output

### Package manager

**Package manager: pnpm**

Reasons:

- Strong monorepo workspace support
- Efficient dependency storage (content-addressable store, fewer duplicated `node_modules`)
- Compatible with Turborepo-style workspaces
- Removes ambiguity for Claude Code — locks the choice now so it does not get re-opened at T0-00

This decision is final and should be recorded in `DECISIONS.md`.

---

## 11. Final Go / No-Go

| Area | Decision |
|---|---|
| Create final readiness document | **Go** (this document) |
| Mark older readiness documents as superseded | **Go** |
| Start project setup (T0-00) | **Go** |
| Start control files (Phase 0 outputs) | **Go** |
| Use pnpm as package manager | **Go** |
| Start database foundation (Tier 0 migrations) | **Go after Phase 0 outputs exist** |
| Start RLS policies | **Go as second half of Tier 0 (migrations 006–011)** |
| Start Gate 0 acceptance tests | **Go after Tier 0 migrations are deployed** |
| Start Tier 1 auth | **Go only after Gate 0 passes** |
| Start dashboard UI | **No-go for now** |
| Start mobile app UI | **No-go for now** |
| Start messaging | **No-go for now** |
| Start VIP Group | **No-go** (gated; revisit after Gate 5) |
| Start admin panel write paths | **No-go** (blocked on role boundary decision) |
| Start admin client directory | **No-go** (blocked on product decision) |
| Start Stripe billing | **Later, before paid rollout — parallel track from Tier 1B** |
| Start public launch preparation | **No-go** (blocked on backup test, legal copy, finalized pricing) |

---

## 12. Next Action

The single next action is:

> **Create a Claude Code prompt for `T0-00: Project Bootstrap and Control Files`.**

That prompt must:

- Instruct Claude Code to create the repo structure
- Instruct Claude Code to create all 10 Phase 0 outputs from Section 7
- Specify pnpm as the package manager
- Specify that no application code, no migrations, and no schema work happens in T0-00
- Require Claude Code to update `PROJECT_STATE.md` at task completion with all files created
- Require Claude Code to list verification steps performed

After T0-00 is complete and all 10 Phase 0 outputs exist:

1. Confirm `MVP_SCOPE_LOCK.md` has explicit decisions on VIP, admin directory, super admin moderation, mobile profile, push, and pilot platform
2. Confirm `FLASH_CARD_RULES.md` has the full green/yellow/red rule table with paused and expired overrides
3. Confirm `ROLE_SEED_MATRIX.md` enumerates all permission strings per role
4. Confirm `TESTING_STRATEGY.md` names the test framework and the Gate 0 acceptance test format
5. Issue the next prompt: `T0-01: Create Enum Types Migration`

The project moves from "risky to start" to "safe to start Tier 0" once T0-00 completes cleanly.
