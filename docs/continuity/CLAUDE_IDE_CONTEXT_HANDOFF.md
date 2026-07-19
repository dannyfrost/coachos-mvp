# Claude IDE Context Handoff

> **Superseded by `PROJECT_STATE.md`.** This file was last updated 2026-05-25 (T1-16) and predates T1-17 and T1-18 (latest: commit `5303292`, T1-18 complete 2026-07-01). The "latest pushed commit" and "Current Project State" sections below are stale — see `PROJECT_STATE.md` for current status.

**Created:** 2026-05-14
**Updated:** 2026-05-25 (T1-16 complete — Gate 1 PASS; 19/19 integration tests PASS; tsc + build + lint PASS)
**Purpose:** Preserve Claude Code working context before auto-compact. Allows accurate resume without drifting from project rules, current state, or task sequence.

---

## 1. Session Purpose

This file captures the current Claude IDE working context before auto-compact occurs.

**Role split:**
- **Claude CMD** (browser/Opus) — thinking, review, prompt generation, continuity maintenance. Never edits repo files directly.
- **Claude IDE** (Code) — actual file creation, migration writing, verification commands, control file updates.

After compacting, Claude IDE must read this file and the listed control files before doing anything.

---

## 2. Current Project State

**Project:** Coaching Platform MVP
**Stack:** Supabase (Postgres 15+), Next.js 14, React Native/Expo, pnpm monorepo
**Repo:** `e:\Claude-project-Coaching-app-MVP`
**Latest pushed commit:** `b5a12fa` — feat(api): add POST /api/signup coach signup route

> **State as of 2026-05-25:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 through T1-16 ALL COMPLETE. T1-16 - Gate 1 PASS; apps/web/.env.local created with real JWT keys; 19/19 integration tests PASS; web UI smoke test PASS; tsc + build + lint PASS. Phase 3 (Tier 1 auth + Tier 2 core loop) COMPLETE. Next: Tier 3 planning — requires founder approval.

| Item | Status |
| ---- | ------ |
| T0-06.5 — Bootstrap Local Supabase | COMPLETE |
| Local Supabase (12 services active, 3 stopped non-blocking) | HEALTHY |
| T0-06b — `007_rls_enable.sql` | COMPLETE |
| T0-07 — `008_rls_policies.sql` | COMPLETE (2026-05-15) — 82 policies |
| T0-08 — `010_rpc_functions.sql` | COMPLETE (2026-05-15) — 23 SECURITY DEFINER RPCs |
| T0-09 — `011_revoke_grants.sql` | COMPLETE (2026-05-16) — 4 table-level REVOKEs |
| T0-10 — `012_storage_policies.sql` | COMPLETE (2026-05-16) — 6 storage policies |
| T0-11 — `013_seed_data.sql` | COMPLETE (2026-05-16) — 6 roles, 46 permissions |
| T0-12 — TypeScript type generation | COMPLETE (2026-05-16) — 39,355 bytes, V1–V7 passed |
| DECISIONS.md — D-G0-01 through D-G0-05 added | COMPLETE (2026-05-16) |
| TESTING_STRATEGY.md — stale refs fixed, 16 categories, supabase/tests/ path | COMPLETE (2026-05-16) |
| GATE0_CLAUDE_IDE_PROMPT.md — implementation prompt generated | COMPLETE (2026-05-16) |
| Gate 0 — 16 pgTAP files, 84 tests, 0 failures | COMPLETE (2026-05-16) |
| T1-00 — Next.js 14 scaffold + Supabase client utilities | COMPLETE (2026-05-17) — build + typecheck passed; no auth routes |
| Current next task | Tier 3 planning — pending explicit founder approval |

---

## 3. Completed Work

| Task | Description | Status |
| ---- | ----------- | ------ |
| T0-00 | Project Bootstrap and Control Files | Complete — approved by founder |
| T0-01 | Enum Types Migration (`001_create_enums.sql`) | Complete — approved by founder |
| T0-02 | Tables Migration (`002_create_tables.sql`) | Complete — approved by founder 2026-05-11 |
| T0-03 | Composite Constraints Migration (`003_composite_constraints.sql`) | Complete — approved by founder 2026-05-11 |
| T0-04 | Indexes Migration (`004_indexes.sql`) | Complete — approved by founder 2026-05-11 |
| T0-05 | Triggers Migration (`005_triggers.sql`) | Complete — approved by founder 2026-05-11 |
| T0-06a | Private Schema Migration (`006_private_schema.sql`) | Complete — approved by founder 2026-05-11 |
| T0-06.5 | Bootstrap Local Supabase | Complete 2026-05-14 |
| T0-06b | Enable RLS Migration (`007_rls_enable.sql`) | Complete 2026-05-14 |
| T0-07 | RLS Policies Migration (`008_rls_policies.sql`) | Complete 2026-05-15 — V1–V7 passed |
| T0-08 | RPC Functions Migration (`010_rpc_functions.sql`) | Complete 2026-05-15 — V1–V8 passed |
| T0-09 | Revoke Grants Migration (`011_revoke_grants.sql`) | Complete 2026-05-16 — V1–V8 passed |
| T0-10 | Storage Policies Migration (`012_storage_policies.sql`) | Complete 2026-05-16 — V1–V8 passed |
| T0-11 | Seed Data Migration (`013_seed_data.sql`) | Complete 2026-05-16 — V1–V13 passed |
| T0-12 | TypeScript type generation (`packages/supabase/database.types.ts`) | Complete 2026-05-16 — V1–V7 passed |
| Gate 0 | pgTAP security acceptance suite (`supabase/tests/` G0-01 through G0-16) | Complete 2026-05-16 — 16 files, 84 tests, 0 failures |
| T1-00 | Next.js 14 App Router scaffold (`apps/web/`), Turborepo (`turbo.json`), Supabase client utilities (`packages/supabase/`) | Complete 2026-05-17 — build + typecheck passed; no auth routes |

Note: `009_csa_staff_id_idx.sql` is a hotfix index migration between T0-07 and T0-08. Applied automatically. Immutable.

No application source code has been touched. Migrations 001–013 exist on disk, pushed to GitHub, verified locally.

---

## 4. Environment Fixes Resolved

These blockers were resolved during T0-06.5. Already resolved — do not retry.

| Blocker ID | Description | Resolution |
| ---------- | ----------- | ---------- |
| B-ENV-001 | Docker Desktop daemon crash (SIGBUS / dockerd panic) | Windows restart — clean re-pull of postgres image |
| B-ENV-004 | Vector/analytics container failed (Docker TCP socket not exposed) | Docker Desktop -> Settings -> General -> enable "Expose daemon on tcp://localhost:2375 without TLS" |
| B-ENV-005 | Supabase storage image corruption (`server.js` 0 bytes) | `docker image rm public.ecr.aws/supabase/storage-api:v1.54.1` + re-pull on next `supabase start` |

Storage, vector, and analytics are healthy. 3 services stopped (imgproxy, edge_runtime, pooler) — non-blocking for Gate 0.

---

## 5. Key Locked Decisions (summary)

| Decision | Detail |
| -------- | ------ |
| S-03 | Direct UPDATE on messages and flash_cards revoked — enforced in 011 |
| S-07 | Direct INSERT on messages revoked — enforced in 011 |
| S-08 | Direct UPDATE on platform_users revoked — enforced in 011 |
| P-01 | VIP tables OUT of MVP — never reference in any creation context |
| P-03 | super_admin suspend/ban/restore OUT of MVP — not seeded in 013 |
| N-10 | Two-layer role model: platform_users.role_type (4 values) + staff_assignments.role_id |
| N-11 | modify_plans seeded for senior_assistant only |
| N-12 | mark_payment seeded for billing_operations only |

Full decision log: `DECISIONS.md`

---

## 6. Policy and Schema Counts (locked)

| Item | Count | Locked |
| ---- | ----- | ------ |
| Public RLS policies (008) | 82 | YES |
| Storage policies (012) | 6 | YES |
| SECURITY DEFINER RPCs (010) | 23 | YES |
| Seeded roles (013) | 6 | YES |
| Seeded role_permissions (013) | 46 | YES |

---

## 7. Important Project Rules

From `WORKING_RULES.md` — must be preserved across compact events:

1. Read `PROJECT_STATE.md` before starting any task.
2. Respect `WORKING_RULES.md` (10 constitutional rules) and `DECISIONS.md` (all LOCKED entries).
3. Do not modify files outside the approved task scope. Migrations 001–013 are now immutable.
4. One migration per session, one task per session. Do not mix migrations.
5. Do not touch application source code during migration tasks unless explicitly approved.
6. Stop and report if any verification step fails. Never attempt fixes without reporting first.
7. Update `PROJECT_STATE.md` and `TASK_LOG.md` only after all verification steps pass.
8. Every migration header must reference the Gate 0 test category (G0-XX).
9. Do not start the next task without explicit founder/human approval.
10. Do not run `supabase db push` — use `supabase db reset` only.

**VIP exclusion (DECISIONS.md P-01):** Never mention `vip_groups`, `vip_group_members`, `vip_group_posts`, `vip_post_reactions` in any creation context.

---

## 8. Files to Read After Compacting

Read all of these in full before doing anything:

- `PROJECT_STATE.md`
- `TASK_LOG.md`
- `BLOCKERS.md`
- `WORKING_RULES.md`
- `DECISIONS.md`
- `ROLE_SEED_MATRIX.md`
- `TESTING_STRATEGY.md`
- `supabase/migrations/006_private_schema.sql`
- `supabase/migrations/008_rls_policies.sql`
- `supabase/migrations/010_rpc_functions.sql`
- `supabase/migrations/011_revoke_grants.sql`
- `supabase/migrations/013_seed_data.sql`
- `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` (this file)

---

## 9. Gate 0 Decisions (ALL RESOLVED)

Gate 0 is COMPLETE. These decisions are locked in DECISIONS.md (D-G0-01 through D-G0-05).

| Decision | Resolution |
| -------- | ---------- |
| D-G0-01 | `CREATE EXTENSION IF NOT EXISTS pgtap` as Gate 0 test setup only; not in migrations |
| D-G0-02 | Test files in `supabase/tests/`; runner: `npx supabase@2.98.2 test db` |
| D-G0-03 | 16 categories: G0-01 through G0-16 (including 4 new: G0-13 role-type, G0-14 forbidden perms, G0-15 super admin isolation, G0-16 seed baseline) |
| D-G0-04 | Transaction rollback (`BEGIN...ROLLBACK`) as default test data isolation strategy |
| D-G0-05 | TESTING_STRATEGY.md stale "001–012" reference corrected to "001–013" |

---

## 10. Resume Instruction After Compacting

**After compacting, do not assume context from memory. First read this handoff file and all listed control files, then summarize the current state before modifying anything.**

Gate 0 is COMPLETE. Gate 1 is COMPLETE. T1-00 through T1-16 are COMPLETE. Confirm before Tier 3:

1. Latest commit is the T1-16 commit (git --no-pager log --oneline -5).
2. apps/web/.env.local exists and contains real JWT keys (NOT sb_publishable_* / sb_secret_* format).
3. Local Supabase is running (npx supabase@2.98.2 --workdir . status).
4. Dev server: pnpm --filter web dev (background, port 3000).

---

## 11. Open Risks and Reminders

| Risk / Reminder | Detail |
| --------------- | ------ |
| Docker TCP daemon | "Expose daemon on tcp://localhost:2375 without TLS" must remain enabled. |
| Supabase CLI | Native binary not installed. Use `npx supabase@2.98.2` for all CLI commands. |
| pgTAP lost on db reset | Every `supabase db reset` drops pgTAP. Gate 0 prompt must include CREATE EXTENSION IF NOT EXISTS pgtap as a pre-step. |
| Migrations 001–013 immutable | Do not edit without explicit founder approval and new task prompt. |
| UTF-8 BOM on database.types.ts | First line has BOM (U+FEFF). Transparent to TypeScript compiler. May affect downstream string-handling tooling in Tier 1. No action needed now. |
| TESTING_STRATEGY.md | Updated — 16 categories, supabase/tests/ path, migration count 001–013 corrected (D-G0-05 applied). |
| Prompt formatting rule | Any command containing SQL or a PowerShell redirect must be delivered via a file (not chat) to avoid markdown line-wrap corruption. |
| Compact hook ParserError | Non-blocking SessionStart hook error occurred during compaction. No repo files affected. Gate 0 results unaffected. |
| `apps/web/.eslintrc.json` missing | Creation blocked by config-protection hook. `next lint` fails. Non-blocking for build/typecheck. Requires founder decision to resolve. |
| pnpm binary path | pnpm not in default Bash PATH. Use `export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"` or PowerShell for all pnpm commands. |
| T1-00 not committed | Scaffold files (`turbo.json`, `tsconfig.json`, `packages/supabase/*`, `apps/web/*`) are uncommitted. Commit before T1-01 starts. |
| Auth method locked | T1-02 decision: email+password only. No OAuth, no magic links. Do not implement other auth methods. |
