# CoachOS — Continuity Handoff

**Purpose:** This file is the entry point for any new AI session (CMD agent, browser session, anyone) to take over the planning/review/prompt-engineering role currently held by Claude Opus in the browser. It does NOT replace Claude Code in the IDE, which keeps coding. It replaces the upstream planning/review layer.

**Last updated:** 2026-05-11
**Active phase:** Tier 0 migrations, between T0-06a (complete) and T0-06b (next)
**Repo location:** `e:\Claude project\`

---

## 1. Project at a glance

**Product:** CoachOS — multi-tenant B2B2C SaaS for fitness coaches managing remote client rosters. Three surfaces:
- Coach Web App (Next.js 14, desktop-first, on Vercel)
- Super Admin Panel (Next.js, desktop-first, on Vercel)
- Client Mobile App (React Native / Expo, iOS + Android)

**Central product object:** Flash Card — one per client, auto-computed, color-coded green / yellow / red, with coach-editable notes. The dashboard is a grid of Flash Cards. Everything else exists to feed or act on them.

**Stack (locked):**
- Database / Auth / Storage / Realtime: Supabase (PostgreSQL 15+)
- Frontend: Next.js 14 + React + Tailwind + shadcn/ui (web/admin); React Native + Expo (mobile)
- Server state: TanStack Query (React Query)
- Validation: Zod
- Testing: pgTAP (Gate 0 DB tests), Vitest (app unit tests), Playwright (E2E, later)
- Package manager: pnpm (monorepo)
- Billing: Stripe (coach subscriptions only; deferred to Tier 1B+)
- File storage: Supabase Storage (`tenant-media` private bucket); Cloudflare R2 reserved for future backup paths
- Mobile push: Expo Push Notifications (deferred)

**Design system (locked):** "Iron Ledger" — light neutral surfaces, deep navy/ink primary, semantic status colors, structured spacing, one sans-serif. Web + Admin use the same light system, not a dark variant.

**MVP scope decision:** VIP Group is OUT of MVP-core. Revisit only after Gate 5. All 16 MVP-core tables (no VIP tables). See `MVP_SCOPE_LOCK.md`.

---

## 2. Current state — what is built, what is next

### Migrations (in `supabase/migrations/`)

| File | Status | Contents |
|---|---|---|
| 001_create_enums.sql | Written, not yet applied to local DB | 12 enum types |
| 002_create_tables.sql | Written | 16 MVP-core tables; `end_date NOT NULL` correction applied during T0-03 remediation |
| 003_composite_constraints.sql | Written | 2 parent UNIQUE(id, coach_id); 7 composite FKs; 1 CHECK (end_date >= start_date). ON DELETE NO ACTION on six FKs; RESTRICT on plan_assignments→plans |
| 004_indexes.sql | Written | 9 indexes including `staff_one_active_per_user` partial unique (RLS prerequisite) |
| 005_triggers.sql | Written | 4 trigger functions + 4 triggers: role-type enforcement, locked-role protection |
| 006_private_schema.sql | Written | `private` schema + 5 SECURITY DEFINER STABLE helpers |
| **007_rls_enable.sql** | **NEXT** | ALTER TABLE ENABLE RLS on 16 MVP-core tables |
| 008_rls_policies.sql | Not started | ~60 policies (16 tables × 4 roles × CRUD) |
| 009_rpc_functions.sql | Not started | ~20 RPCs from API spec |
| 010_revoke_grants.sql | Not started | REVOKE UPDATE on messages/flash_cards; GRANT EXECUTE on RPCs |
| 011_storage_policies.sql | Not started | tenant-media bucket policies |
| 012_seed_data.sql | Not started | Roles, role_permissions, Super Admin |

**Critical pre-007 decision pending:** Local Supabase has never been bootstrapped. All migrations exist only as files on disk. Strong recommendation: bootstrap local Supabase (install CLI, `supabase init`, `supabase start`, `supabase db reset`) BEFORE writing 007 so the foundation is verified to work. Otherwise we write 5 more migrations on top of an unverified base.

### Control files (in repo root)

| File | Status | Notes |
|---|---|---|
| PROJECT_STATE.md | Live, actively maintained | Last entry: T0-06a + G0-12 disambiguation |
| DECISIONS.md | Live | N-01 through N-07 locked. N-08 (RLS helper composition pattern) pending |
| MVP_SCOPE_LOCK.md | Live | VIP excluded |
| TESTING_STRATEGY.md | Live | pgTAP locked; 12 Gate 0 categories (G0-01 through G0-12) |
| FLASH_CARD_RULES.md | Listed in Phase 0 outputs as required | Thresholds not yet specified — this BLOCKS Tier 2 |
| ROLE_SEED_MATRIX.md | Listed in Phase 0 outputs as required | Senior Assistant permission profile may still be open |
| HANDOFF.md | This file | New as of 2026-05-11 |
| WORKING_RULES.md | New as of 2026-05-11 | Extracted operating discipline |
| BUG_LOG.md | New as of 2026-05-11 | B-001 through B-003 documented |

### Deferred verifications (run at Gate 0)

1. T0-03 negative test — cross-tenant INSERT on `daily_logs` must fail with FK violation on `daily_logs_client_coach_fkey`. Cannot run until local Supabase is bootstrapped.
2. T0-04 staff_id index decision — evaluate whether `client_staff_assignments(staff_id)` non-unique index is needed once 008 RLS policies are written. Speculative until then.
3. T0-06a private helper tests (G0-12) — positive + negative tests for all 5 helpers. Test file `tests/gate0/G0-12_private_helpers.sql` to be authored after T0-12.

### Pending product decisions (do not block 007, may block later tiers)

From `MVP_CURRENT_BUILD_STATUS_FOR_REVIEW.md` section 13:
1. Flash card green/yellow/red threshold percentages — **blocks Tier 2 core loop**
2. Flash card cron frequency
3. Flash card no-data display behavior (paused, grey, no logs)
4. Senior assistant permission details (5 boolean defaults)
5. Client own profile write access scope
6. Mobile pilot platform (iOS / Android / both)
7. Mobile test framework
8. Admin client directory scope
9. Super admin moderation write permissions
10. Admin role boundary

---

## 3. Working rules — how the project is operated

**One-task-per-Claude-Code-session discipline.** Every Tier 0 migration is its own session. The session writes one file, updates PROJECT_STATE.md, and stops. The browser/CMD agent reviews the output before the next task starts. This discipline has caught real bugs (ON DELETE CASCADE policy in T0-03, search_path quoting in T0-05). Do not abandon it.

**Three-agent architecture.**
- **Claude Code in IDE** — writes code, edits files, runs tools.
- **Browser/CMD agent (this role)** — produces task prompts, reviews Claude Code's outputs, escalates decisions to the human, maintains continuity files.
- **Human (Adnan)** — final decision authority. Resolves ambiguities, picks paths, approves transitions.

The browser/CMD agent NEVER edits files directly in the repo. The browser/CMD agent produces *prompts* that Claude Code executes. This is the contract.

**Constitutional rules for the planner agent** are captured in detail in `WORKING_RULES.md`. Summary:

1. Scope discipline — every prompt states what NOT to touch
2. Review pattern — manual checklist with quoted evidence; never trust summaries
3. Verify, don't assume — demand file content when artifacts are referenced
4. Honest about uncertainty — say "I haven't seen this file" rather than fabricate
5. Naming convention N-07 — Postgres-default style; schema-qualify references
6. VIP exclusion — no VIP tables in creation contexts
7. Deferred-decision tracking — every deferred item lands in PROJECT_STATE.md
8. Date discipline — use actual application dates in verification logs
9. Cross-reference Gate 0 — every migration header references G0-XX
10. Stop conditions — never start the next task without explicit human approval

### Conventions inherited and reaffirmed

- Identity model: `coaches.id = clients.id = platform_users.id` (single UUID per user)
- Tenant integrity: composite FKs on every child of clients and plans
- Soft delete everywhere; hard delete via Erasure Matrix runbook only
- 7-day subscription grace period is computed at runtime, not stored
- Single STAFF role with 5 boolean permissions per staff member
- Plan PDFs only at MVP (no in-app builder)
- Messaging: flat thread per coach + participant pair, sender/recipient model
- Client mobile: read-only past logs; today's log editable

---

## 4. How a new planner agent should continue

**Immediate task on bootstrap:** read this file, then read all six on-disk control files (see Export Checklist in the continuity package). Then propose a prompt for the next Tier 0 task. The next task is either local Supabase bootstrap or T0-06b (007_rls_enable.sql) — the human decides which based on the Q1 recommendation.

**Prompt production pattern.** Every Claude Code prompt produced by the planner follows the locked 7-section structure documented in WORKING_RULES.md section 3.

**Review pattern.** When Claude Code reports back, produce: pass/fail verdict, manual review checklist with quoted evidence, flagged judgment-call deviations, action items, and an explicit "cleared to start <next>" or "blocked on <X>". Details in WORKING_RULES.md section 4.

**Escalation triggers.** Product decisions, spec ambiguities, judgment-call deviations, security/integrity risks, or token-budget risks → escalate to Adnan. Details in WORKING_RULES.md section 6.

**Never:**
- Edit repo files directly. Always go through Claude Code.
- Approve a Claude Code output based on summary only. Demand artifacts.
- Skip the manual review checklist.
- Make product decisions unilaterally.

---

## 5. Open recommendations the human must decide

1. **Bootstrap local Supabase now vs. defer to T0-13.** Strong recommendation: now. Cost is small. Information value is high — finding a problem in 002 or 003 now is trivial; finding it after 6 more migrations layered on top is painful.
2. **Add N-08 to DECISIONS.md.** Documents the RLS helper inline-dispatch pattern observed in T0-06a (helpers inline `role_type` lookups rather than calling `private.get_my_role()` from each other). Performance-driven; trade-off documented. Pending.
3. **FLASH_CARD_RULES.md content.** Thresholds, cron frequency, no-data behavior. Blocks Tier 2 but not Tier 0/1.
4. **Mobile pilot platform.** iOS / Android / both. Affects Expo project setup in Tier 2.

---

## 6. G0-11 / G0-12 disambiguation history

During T0-06a review, a numbering conflict was identified between TESTING_STRATEGY.md (where G0-11 = "Default-deny") and the header comment in 006_private_schema.sql (which referenced G0-11 for private helper tests). Resolution: G0-11 retained as "Default-deny"; new G0-12 created for "Private helper functions". Three files coordinated:

1. TESTING_STRATEGY.md — count `11 → 12`, new G0-12 row in category table, new file in test file list
2. 006_private_schema.sql — header reference `G0-11_private_helpers.sql → G0-12_private_helpers.sql`
3. PROJECT_STATE.md — deferred verifications row `(G0-11) → (G0-12)`

Applied 2026-05-11. Status: locked. The actual `G0-12_private_helpers.sql` test file is not yet authored; it will be written after T0-12 (seed data) when test fixtures can be set up.

---

## 7. End-of-handoff stop signals

The planner agent should refuse to proceed when:
- Any of the six on-disk control files has not been read.
- The human has not confirmed the bootstrap-timing decision (Q1).
- A migration about to be written would touch files outside the spec.

Resume signals: human approval + scoped prompt produced + Claude Code session opened in IDE.
