# DECISIONS.md

**Project:** Coaching Platform MVP  
**Status:** Active — append only. Do not edit or remove locked decisions.  
**Last updated:** 2026-05-25 (T1-16 decisions locked)

---

## How to use this file

- **LOCKED** — decision is final. Do not reopen without a written justification entry below it.
- **PENDING** — decision is required before the named tier/task starts.
- All entries include the date locked and the reason.

---

## Architecture

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| A-01 | Monorepo: `apps/web`, `apps/mobile`, `packages/shared`, `packages/supabase`, `supabase/migrations` | LOCKED | 2026-05-09 | Keeps web, mobile, and shared logic co-located; enables single `pnpm` install |
| A-02 | Package manager: **pnpm** with workspace configuration | LOCKED | 2026-05-09 | Strong monorepo support, content-addressable store, removes ambiguity for Claude Code |
| A-03 | Backend: **Supabase** (Postgres + Auth + Storage + Realtime) | LOCKED | 2026-05-09 | Single managed backend covers auth, DB, storage, and real-time without additional services |
| A-04 | Web framework: **Next.js** (App Router) | LOCKED | 2026-05-09 | SSR + API routes in one; standard for Supabase + TypeScript stacks |
| A-05 | Mobile framework: **Expo** (React Native) | LOCKED | 2026-05-09 | Cross-platform, OTA updates, compatible with Expo Go for pilot testing |
| A-06 | Language: **TypeScript** throughout (web, mobile, shared packages) | LOCKED | 2026-05-09 | Type safety across the full stack; required for shared package reuse |
| A-07 | Database migrations: sequential numbered SQL files in `supabase/migrations/` | LOCKED | 2026-05-09 | Matches Supabase CLI conventions; avoids ORM migration drift |
| A-08 | Supabase workflow: **local-first** — use `supabase start` for development and migrations; remote Supabase project is used for staging/production only, not as the first development target | LOCKED | 2026-05-09 | Local dev gives fast migration iteration, offline capability, and no risk of polluting a production project during Tier 0 |

---

## Security

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| S-01 | RLS enabled on all tables from Tier 0 | LOCKED | 2026-05-09 | Security is not retrofitted; all tables are row-level secured before any app code runs |
| S-02 | Service role key used server-side only (API routes / Edge Functions) | LOCKED | 2026-05-09 | Anon key exposed to browser; service role key never leaves the server |
| S-03 | Direct `UPDATE` on `messages` and `flash_cards` revoked for `authenticated` role | LOCKED | 2026-05-09 | Mutation goes through RPC only; prevents client-side table write bypass |
| S-04 | Private schema (`private` or `_internal`) for helper functions not callable via PostgREST | LOCKED | 2026-05-09 | Internal logic not exposed via API surface |
| S-05 | Storage paths are tenant-scoped (`/{tenant_id}/...`) | LOCKED | 2026-05-09 | Cross-tenant storage access blocked by path convention + RLS policies |
| S-06 | All RLS policies written before any Tier 1 task begins (Gate 0 must pass) | LOCKED | 2026-05-09 | Gate 0 proves isolation before any user-facing code is written |
| S-07 | Direct INSERT on `messages` revoked for `authenticated` role | LOCKED | 2026-05-15 | Message send is RPC-only (009_rpc_functions). No INSERT policy prevents client-to-client messaging and unscoped assistant messaging at schema level. |
| S-08 | Direct UPDATE on `platform_users` revoked for `authenticated`; client UPDATE on `clients` deferred to RPC | LOCKED | 2026-05-15 | `platform_users` has no column-level restrictions in 001–007; any UPDATE policy allows role_type self-promotion. Profile updates and client record edits go through RPC in 009. |

---

## Naming

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| N-01 | DB table names: `snake_case`, plural | LOCKED | 2026-05-09 | Postgres convention; consistent with Supabase generated types |
| N-02 | TypeScript types/interfaces: `PascalCase` | LOCKED | 2026-05-09 | Standard TypeScript convention |
| N-03 | API routes: `kebab-case` | LOCKED | 2026-05-09 | Standard URL convention |
| N-04 | RPC function names: `snake_case` verb-noun format (e.g. `create_client_invite`) | LOCKED | 2026-05-09 | Postgres convention; readable from both SQL and TypeScript call sites |
| N-05 | Environment variable names: `SCREAMING_SNAKE_CASE` | LOCKED | 2026-05-09 | Standard convention across all runtimes |
| N-06 | Shared package scope: `@coaching/*` (e.g. `@coaching/shared`, `@coaching/supabase`) | LOCKED | 2026-05-09 | Clear namespace; avoids conflicts with npm public packages |
| N-07 | Constraint naming convention (Postgres-default style): UNIQUE = `<table>_<columns>_key`; foreign keys = `<table>_<columns>_fkey`; check constraints = `<table>_<description>_chk`; primary keys = `<table>_pkey` (Postgres default; do not override). Established by `003_composite_constraints.sql`. Applies to all migrations from 004 onward; 001 and 002 already follow this style implicitly via Postgres defaults. | LOCKED | 2026-05-11 | Matches Postgres's auto-generated names so error messages, `pg_dump` output, and Supabase Studio displays all line up |
| N-08 | RLS helper composition pattern: the five private helpers in `006_private_schema.sql` inline their `role_type` lookups against `public.platform_users` rather than calling `private.get_my_role()` from within each other. This is a performance optimization (one platform_users read per RLS evaluation instead of two or three). Trade-off: if the role-resolution strategy changes (e.g., supporting JWT-claim caching), three functions must be updated, not one (`get_my_role`, `get_my_coach_id`, `is_my_assigned_client`). | LOCKED | 2026-05-13 | Performance — inline lookups avoid redundant function calls during RLS evaluation; cost is captured maintenance burden if role resolution changes. |
| N-09 | RLS team-scope differentiator: `clients:read_team_scope` — granted to `senior_assistant` in `013_seed_data`; checked via `private.has_permission('clients:read_team_scope')` in all 008 policies that branch on client scope. Regular assistants fall back to explicit `client_staff_assignments` scope. | LOCKED | 2026-05-15 | Single permission string decouples RLS logic from role names; future scope reassignment requires no schema change. |
| N-10 | Two-layer role model: `platform_users.role_type` (4-value enum: super_admin, coach, assistant, client) drives `private.get_my_role()` for broad RLS gating. `staff_assignments.role_id → roles(id)` drives `private.has_permission()` for fine-grained action control. `senior_assistant` and `billing_operations` are roles table entries (staff roles) only — they are NOT `platform_users.role_type` values. All assistant-type users carry `role_type = 'assistant'`; their staff role (assistant / senior_assistant / billing_operations) is assigned via `staff_assignments.role_id`. | LOCKED | 2026-05-16 | Confirmed via `006_private_schema.sql` has_permission() query — it joins staff_assignments to role_permissions, not platform_users. Separating platform role type from staff role allows one `role_type = 'assistant'` check to cover all assistant subtypes at the RLS layer while still enabling granular permission differentiation. |
| N-11 | `modify_plans` permission seeded for `senior_assistant` only. Standard assistant and billing_operations do not receive it. Plan assignment via `assign_plan` RPC is therefore blocked for those roles. Coach is exempt (coach-only gate in RPC runs before permission check). | LOCKED | 2026-05-16 | Plan assignment is high-risk coaching content control; senior assistant scope is appropriate; standard assistants and billing staff should not modify plan assignments. |
| N-12 | `mark_payment` permission seeded for `billing_operations` only. Standard assistant and senior_assistant do not receive it. Payment confirmation via `confirm_client_payment` RPC is therefore billing-staff-only. Coach is exempt (coach-only gate). | LOCKED | 2026-05-16 | Payment confirmation is a billing action; restricting it to billing_operations assistants prevents standard coaching staff from confirming payments. |

---

## Product / Scope

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| P-01 | VIP Group feature: **OUT of MVP-core**. No VIP tables, no VIP RPCs, no VIP UI. Do not add VIP schema to migration 002. Revisit only after Gate 5 passes. | LOCKED | 2026-05-09 | Simplifies Tier 0 schema; VIP adds no value to the core coach → flash card loop |
| P-02 | Admin client directory | PENDING | — | See `MVP_SCOPE_LOCK.md`. Required before admin panel work starts. |
| P-03 | Super admin moderation write paths (suspend / ban / restore) | OUT OF MVP | 2026-05-16 | Blocked by MVP_SCOPE_LOCK.md P-03. Not seeded in 013. Introduce in a future migration only when corresponding RPC/API enforcement exists. |
| P-04 | Mobile pilot platform (Expo Go vs TestFlight vs Play Store internal) | PENDING | — | Required before mobile build begins. Affects OTA update strategy. |
| P-05 | Push notification provider | PENDING | — | Required before messaging / reminder work starts. |
| P-06 | Client mobile profile screen scope | PENDING | — | Required before Tier 2 client profile task. |

---

## Build Process

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| B-01 | Tier gates are mandatory — no tier starts until the previous gate passes | LOCKED | 2026-05-09 | Prevents broken foundations from being built on |
| B-02 | Gate 0 results documented in `PROJECT_STATE.md` Verification Log before Tier 1 starts | LOCKED | 2026-05-09 | Audit trail; forces explicit sign-off |
| B-03 | Stripe billing is a parallel track starting at Tier 1B, not a blocker for the core loop | LOCKED | 2026-05-09 | Core coach → flash card loop must work without billing |
| B-04 | No architecture changes beyond the current task | LOCKED | 2026-05-09 | Prevents scope creep inside Claude Code sessions |

---

## Schema — Enum Types (locked in T0-01)

Source of truth: Schema Doc Status Enums Reference + Task Prompt Guide.
The enum names and values below supersede any earlier enum decisions in this file.

| #    | Enum type                           | Values                                                                                     | Status | Locked on  |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------ | ------ | ---------- |
| E-01 | `public.user_status`                | `pending`, `active`, `paused`, `suspended`, `banned`, `deactivated`                        | LOCKED | 2026-05-10 |
| E-02 | `public.role_type`                  | `super_admin`, `coach`, `assistant`, `client`                                              | LOCKED | 2026-05-10 |
| E-03 | `public.trial_status`               | `trial_not_started`, `trial_active`, `trial_expired`, `paid_active`, `paid_skipped_trial`  | LOCKED | 2026-05-10 |
| E-04 | `public.coach_subscription_status`  | `active`, `past_due`, `cancelled`, `expired`                                               | LOCKED | 2026-05-10 |
| E-05 | `public.client_subscription_status` | `active`, `expired`, `overdue`                                                             | LOCKED | 2026-05-10 |
| E-06 | `public.staff_status`               | `active`, `disabled`                                                                       | LOCKED | 2026-05-10 |
| E-07 | `public.flash_status`               | `green`, `yellow`, `red`                                                                   | LOCKED | 2026-05-10 |
| E-08 | `public.plan_type_enum`             | `meal`, `workout`                                                                          | LOCKED | 2026-05-10 |
| E-09 | `public.plan_status`                | `active`, `archived`                                                                       | LOCKED | 2026-05-10 |
| E-10 | `public.plan_assign_status`         | `active`, `completed`, `replaced`                                                          | LOCKED | 2026-05-10 |
| E-11 | `public.absence_level`              | `24h`, `48h`, `72h`                                                                        | LOCKED | 2026-05-10 |
| E-12 | `public.absence_action`             | `pending`, `message_sent`, `escalated_to_coach`, `resolved`                                | LOCKED | 2026-05-10 |

Excluded (not in schema doc): `account_status`, `subscription_status`, `flash_card_color`, `invite_status`, `message_type`.
No VIP-specific enums — VIP is OUT of MVP-core.

---

## Gate 0 — pgTAP Security Acceptance Suite

Decisions locked before Gate 0 implementation begins. All approved by founder 2026-05-16.

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| D-G0-01 | pgTAP installation: `CREATE EXTENSION IF NOT EXISTS pgtap` runs as a pre-step in the Gate 0 prompt (not in a migration). Must be re-run after every `db reset`. | LOCKED | 2026-05-16 | pgTAP is lost on every `supabase db reset`; pre-step is the only safe install point that doesn't pollute the migration sequence. |
| D-G0-02 | Gate 0 test files live in `supabase/tests/` (Supabase CLI default). Run command: `npx supabase@2.98.2 test db`. `tests/gate0/` directory is abandoned. | LOCKED | 2026-05-16 | Supabase CLI `test db` command defaults to `supabase/tests/`; using the default avoids custom path flags and aligns with Supabase conventions. |
| D-G0-03 | Gate 0 includes 16 categories: G0-01 through G0-12 (original) plus G0-13 (role-type consistency), G0-14 (forbidden permission check), G0-15 (super admin isolation), G0-16 (seed data baseline). | LOCKED | 2026-05-16 | Four additional categories cover gaps identified in Gate 0 pre-check: role/permission consistency, forbidden-perm absence, super_admin data isolation, and seed row counts. |
| D-G0-04 | Test data isolation strategy: each test file wraps test data in a transaction that is rolled back at the end of the test. No explicit DELETE; no separate test schema. | LOCKED | 2026-05-16 | Transaction rollback is the cleanest isolation: test data never persists, no cleanup code required, works with pgTAP `plan()` / `finish()` pattern. |
| D-G0-05 | Fix stale references in `TESTING_STRATEGY.md`: migration count "001–012" → "001–013"; category count "12" → "16"; test path `tests/gate0/` → `supabase/tests/`; add G0-13 through G0-16 to table. | LOCKED | 2026-05-16 | Doc accuracy; ensures Gate 0 prompt generated from TESTING_STRATEGY.md reflects actual counts and paths. |

---

## Tier 1 — Application Foundation (T1-00)

Decisions locked before T1-00 scaffold begins. All approved by founder 2026-05-17.

| # | Decision | Status | Locked on | Reason |
|---|---|---|---|---|
| T1-01 | Monorepo build pipeline: **Turborepo** added in T1-00. `turbo.json` created alongside Next.js scaffold. Pipelines: `dev`, `build`, `lint`, `typecheck`. | LOCKED | 2026-05-17 | Provides parallel task execution and build caching across apps/packages from day one. `.turbo/` already gitignored. pnpm handles package installation; Turborepo handles task orchestration. |
| T1-02 | Coach signup/login auth method: **email + password** (`supabase.auth.signUp` / `signInWithPassword`). No magic link, no OAuth in Tier 1. | LOCKED | 2026-05-17 | Simplest Supabase auth path; no email provider dependency in local dev; works with Inbucket if email confirmation is enabled. Magic link can be added later as an alternative without schema changes. |

---

## Later Decisions (not blocking Phase 0 or Tier 0)

| Item | Required before |
|---|---|
| Admin role boundary | Admin panel tasks |
| Stripe final pricing tiers | Paid rollout |
| Backup restore test procedure | Pre-launch |
| Legal / privacy copy | Pilot onboarding |

---

## Tier 1 - Coach Signup API Route (T1-01)

All decisions below approved by founder on 2026-05-20 before implementation begins.

#: D-T1-01
Decision: Signup transaction strategy: create auth user first via auth.admin.createUser, then insert public.platform_users, then insert public.coaches. This is a compensating rollback flow, not a true atomic transaction. If any public-schema insert fails after auth user creation, immediately call auth.admin.deleteUser(userId) to remove the orphaned auth user, then return a clean failure response.
Status: LOCKED
Locked on: 2026-05-20
Reason: Auth creation and DB inserts span two systems; true atomicity is not possible. Compensating rollback on failure is the only strategy that prevents orphaned auth users.
────────────────────────────────────────
#: D-T1-02
Decision: workspace_name is required at signup. No deferred onboarding step in Tier 1.
Status: LOCKED
Locked on: 2026-05-20
Reason: coaches row requires workspace_name (NOT NULL, no default). Deferring creates out-of-scope onboarding state machine.
────────────────────────────────────────
#: D-T1-03
Decision: Email confirmation is disabled for local dev. Controlling setting: [auth] enable_confirmations = false in supabase/config.toml (already set). Pass email_confirm: true to auth.admin.createUser so the email is marked verified at creation time. Re-enable for production deployment - deploy-time config change only, no code change required.
Status: LOCKED
Locked on: 2026-05-20
Reason: Prevents blocking dev iteration on email delivery during local MVP development.
────────────────────────────────────────
#: D-T1-04
Decision: Signup implemented as a Next.js App Router API route at apps/web/app/api/signup/route.ts. Do not use a Server Action for T1-01.
Status: LOCKED
Locked on: 2026-05-20
Reason: API route is curl-testable, has no form coupling, aligns with Gate 1 test surface.
────────────────────────────────────────
#: D-T1-05
Decision: Input validation (trim all strings before validating): email - valid email format; password - minimum 8 characters; full_name - minimum 2, maximum 100 characters after trim; workspace_name - minimum 2, maximum 50 characters after trim, only letters/numbers/spaces/hyphens/apostrophes allowed.
Status: LOCKED
Locked on: 2026-05-20
Reason: Minimum viable boundary validation at the API surface.
────────────────────────────────────────
#: D-T1-06
Decision: If auth user creation succeeds but any subsequent DB insert fails, call auth.admin.deleteUser(userId) and return a signup failure response. No orphaned auth users are acceptable.
Status: LOCKED
Locked on: 2026-05-20
Reason: Orphaned auth users create irrecoverable state in local dev and production.
────────────────────────────────────────
#: D-T1-07
Decision: All server-side operations use the service role client (createServiceRoleClient() from @coaching/supabase/server). Service role key must never reach browser code. Do not add unauthenticated INSERT policies to support signup.
Status: LOCKED
Locked on: 2026-05-20
Reason: Confirmed by S-02. RLS INSERT policies block anon inserts on platform_users and coaches.

────────────────────────────────────────

## Tier 1 - Coach Login API Route (T1-02)

All decisions below approved by founder on 2026-05-20 before implementation begins.

#: D-T1-02-01
Decision: Route location: apps/web/app/api/login/route.ts
Status: LOCKED
Locked on: 2026-05-20
Reason: Consistent with T1-01 App Router API route convention.
────────────────────────────────────────
#: D-T1-02-02
Decision: Auth client: use a server-side anon Supabase client with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Do not use createServiceRoleClient(). Do not expose the service role key. packages/supabase/server.ts has no anon server helper — create packages/supabase/auth-server.ts with a minimal createAnonServerClient() for this route.
Status: LOCKED
Locked on: 2026-05-20
Reason: Login is normal credential authentication. Service role is reserved for admin/privileged operations only (signup, cleanup, cron, Stripe webhooks, admin actions).
────────────────────────────────────────
#: D-T1-02-03
Decision: Auth method: supabase.auth.signInWithPassword({ email, password })
Status: LOCKED
Locked on: 2026-05-20
Reason: Standard Supabase credential auth. Returns access_token and refresh_token in session object.
────────────────────────────────────────
#: D-T1-02-04
Decision: Success response (HTTP 200): { id, email, access_token, refresh_token }
Status: LOCKED
Locked on: 2026-05-20
Reason: API-only stage. Tokens returned in body for explicit token management; cookie/session handling deferred until UI form is built (D-T1-02-07).
────────────────────────────────────────
#: D-T1-02-05
Decision: Validation: email — trim then validate email format. password — non-empty check only, do NOT trim (passwords may legitimately contain leading/trailing spaces).
Status: LOCKED
Locked on: 2026-05-20
Reason: Trimming passwords silently corrupts credentials that were set without trimming.
────────────────────────────────────────
#: D-T1-02-06
Decision: Return 401 for all authentication failures. Do not distinguish wrong password from unknown email. Single generic error message: 'Invalid credentials'. No user enumeration.
Status: LOCKED
Locked on: 2026-05-20
Reason: Differentiating wrong password vs unknown email enables user enumeration attacks.
────────────────────────────────────────
#: D-T1-02-07
Decision: Cookies and session management deferred. Return tokens in response body only. Proper browser session and cookie handling deferred until UI form is built.
Status: LOCKED
Locked on: 2026-05-20
Reason: No UI exists yet. Cookie-based session management belongs with the browser form layer, not a bare API route.

────────────────────────────────────────

## Tier 1 - Coach Session/Profile State API Route (T1-03)

All decisions below approved by founder on 2026-05-20 before implementation begins.

#: D-T1-03-01
Decision: Route location: apps/web/app/api/me/route.ts
Status: LOCKED
Locked on: 2026-05-20
Reason: Consistent with T1-01 and T1-02 App Router API route convention.
────────────────────────────────────────
#: D-T1-03-02
Decision: HTTP method: GET. Token from Authorization: Bearer <token> header only. No request body.
Status: LOCKED
Locked on: 2026-05-20
Reason: Standard REST pattern for session/profile reads. No mutation, no body needed.
────────────────────────────────────────
#: D-T1-03-03
Decision: Auth validation client: anon client via createAnonServerClient(). Call supabase.auth.getUser(token). Return 401 if token is missing, malformed, or rejected by Supabase.
Status: LOCKED
Locked on: 2026-05-20
Reason: getUser() validates the JWT server-side without trusting client-supplied claims.
────────────────────────────────────────
#: D-T1-03-04
Decision: DB query client: create a second Supabase client initialized with the user's access token as the Authorization header so RLS evaluates under the caller identity. Do not use service role for DB reads on this route. Pattern: createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
Status: LOCKED
Locked on: 2026-05-20
Reason: /api/me is a user-session route. RLS should evaluate under the caller identity. Service role bypasses RLS without justification.
────────────────────────────────────────
#: D-T1-03-05
Decision: Success response shape (HTTP 200): { user: { id, email, full_name, role_type, status, email_verified }, coach: { workspace_name, trial_status, trial_started_at, trial_expires_at }, next_action }
Status: LOCKED
Locked on: 2026-05-20
Reason: Minimal fields needed for client routing and session hydration. No PII beyond what the authenticated user already owns.
────────────────────────────────────────
#: D-T1-03-06
Decision: Error handling — missing or malformed Authorization header: 401 { error: "Unauthorized" }; token rejected by auth.getUser(): 401 { error: "Unauthorized" }; platform_users row not found: 401 { error: "Unauthorized" }; role_type is not coach: 403 { error: "Forbidden" }; status is not active: 403 { error: "Forbidden" }; unexpected server error: 500 { error: "Internal server error" }.
Status: LOCKED
Locked on: 2026-05-20
Reason: 401 for identity failures, 403 for authorization failures, 500 for infra faults. No information leakage about internal state.
────────────────────────────────────────
#: D-T1-03-07
Decision: next_action computed in order: (1) coach.workspace_name null or empty string -> "workspace_setup"; (2) coach.trial_status = "trial_expired" -> "billing"; (3) all other valid states -> "dashboard".
Status: LOCKED
Locked on: 2026-05-20
Reason: Client uses next_action to determine post-login redirect. Workspace setup gates everything else. Billing gates the main loop.
────────────────────────────────────────
#: D-T1-03-08
Decision: If platform_users exists but coaches row is absent, return 500 { error: "Internal server error" }. Do not return partial data.
Status: LOCKED
Locked on: 2026-05-20
Reason: Missing coaches row is a data integrity failure from an incomplete signup. Returning partial data would mask the corruption.

────────────────────────────────────────

## Tier 1 - Coach Workspace Setup API Route (T1-04)

All decisions below approved by founder on 2026-05-20 before implementation begins.

#: D-T1-04-01
Decision: Route location: apps/web/app/api/workspace/route.ts
Status: LOCKED
Locked on: 2026-05-20
Reason: Consistent with T1-01 through T1-03 App Router API route convention.
────────────────────────────────────────
#: D-T1-04-02
Decision: HTTP method PATCH. Body: { workspace_name: string }. Token from Authorization: Bearer <token> header only. No other request fields.
Status: LOCKED
Locked on: 2026-05-20
Reason: PATCH is the correct HTTP method for partial resource updates. workspace_name is the only mutable field exposed by this route.
────────────────────────────────────────
#: D-T1-04-03
Decision: Auth validation client: anon client via createAnonServerClient(). Call supabase.auth.getUser(token). Return 401 if missing, malformed, or rejected.
Status: LOCKED
Locked on: 2026-05-20
Reason: Same pattern as T1-03. getUser() validates JWT server-side without trusting client-supplied claims.
────────────────────────────────────────
#: D-T1-04-04
Decision: DB read/write client: createUserClient(token) from packages/supabase/auth-server.ts. RLS applies to all reads and writes. Do not use service role unless an RLS limitation is discovered and reported to founder before proceeding.
Status: LOCKED
Locked on: 2026-05-20
Reason: Consistent with T1-03. RLS enforces tenant isolation on writes. Service role bypass is not justified for workspace setup.
────────────────────────────────────────
#: D-T1-04-05
Decision: Validation rules for workspace_name: required (non-null, non-empty after trim); trim whitespace before validation; min 2 characters after trim; max 50 characters after trim; allowed characters: Unicode letters, Unicode digits, spaces, hyphen, apostrophe; regex: /^[\p{L}\p{N} \-']{2,50}$/u. Return 400 with a clear message if any rule fails.
Status: LOCKED
Locked on: 2026-05-20
Reason: Unicode support handles international coach names. 2-50 bounds prevent trivial or excessively long workspace names.
────────────────────────────────────────
#: D-T1-04-06
Decision: Trial activation logic — if coaches.trial_status = 'trial_not_started': set trial_status = 'trial_active', trial_started_at = now(), trial_expires_at = now() + 30 days. If trial_status is any other value: update workspace_name only; do not touch trial fields. Trial activation is one-way; no reset under any condition in this route.
Status: LOCKED
Locked on: 2026-05-20
Reason: Workspace setup triggers the trial. First workspace save starts the clock. Subsequent saves (idempotent) must not reset the trial.
────────────────────────────────────────
#: D-T1-04-07
Decision: Success response (HTTP 200): { workspace_name, trial_status, trial_started_at, trial_expires_at }. No next_action in response. This is a mutation endpoint, not a session state endpoint.
Status: LOCKED
Locked on: 2026-05-20
Reason: Client needs to know the resulting trial state to decide the next redirect. next_action belongs to GET /api/me (T1-03), not mutation endpoints.
────────────────────────────────────────
#: D-T1-04-08
Decision: Error handling — missing or malformed Authorization header: 401 { error: "Unauthorized" }; token rejected by auth.getUser(): 401 { error: "Unauthorized" }; platform_users row not found: 401 { error: "Unauthorized" }; role_type is not coach: 403 { error: "Forbidden" }; status is not active: 403 { error: "Forbidden" }; coaches row not found: 500 { error: "Coach profile missing" }; validation failure: 400 { error: "<message>" }; unexpected server error: 500 { error: "Internal server error" }.
Status: LOCKED
Locked on: 2026-05-20
Reason: Consistent 401/403/400/500 pattern across all Tier 1 routes. "Coach profile missing" is distinct from generic 500 to aid debugging.
────────────────────────────────────────
#: D-T1-04-09
Decision: Route is idempotent. If workspace_name already set and trial already active, PATCH succeeds and updates workspace_name. Trial dates are never reset.
Status: LOCKED
Locked on: 2026-05-20
Reason: UI may retry workspace setup without side effects. Idempotency prevents accidental trial clock resets.

────────────────────────────────────────

## Tier 1 - Client List API Route (T1-06)

All decisions below approved by founder on 2026-05-24 before implementation begins.

#: D-T1-06-01
Decision: Route location: apps/web/app/api/clients/route.ts. The clients/ directory already exists (contains invite/route.ts). GET /api/clients resolves to clients/route.ts. POST /api/clients/invite resolves to clients/invite/route.ts. No conflict in Next.js App Router.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with App Router API route convention. Next.js resolves route.ts at each directory level independently.
────────────────────────────────────────
#: D-T1-06-02
Decision: HTTP method: GET. Token from Authorization: Bearer <token> header only. No request body.
Status: LOCKED
Locked on: 2026-05-24
Reason: Standard REST for read-only list endpoint. No mutation, no body needed.
────────────────────────────────────────
#: D-T1-06-03
Decision: Auth validation client: anon client via createAnonServerClient(). Call supabase.auth.getUser(token). Return 401 if missing, malformed, or rejected.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with T1-03 through T1-05. getUser() validates JWT server-side without trusting client-supplied claims.
────────────────────────────────────────
#: D-T1-06-04
Decision: DB query client: createUserClient(token) from packages/supabase/auth-server.ts. RLS applies. Do not use service role.
Status: LOCKED
Locked on: 2026-05-24
Reason: Read route. RLS enforces coach_id = auth.uid() on clients, flash_cards, client_subscriptions, client_staff_assignments. No privileged operation requires service role.
────────────────────────────────────────
#: D-T1-06-05
Decision: Coach guard: query platform_users where id = auth user id. Select id, role_type, status. If row not found: 401. If role_type !== 'coach': 403. If status !== 'active': 403. Same guard pattern as all prior T1 routes.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent guard pattern across all Tier 1 routes.
────────────────────────────────────────
#: D-T1-06-06
Decision: Optional query param ?status. Valid values: active, pending, paused, deactivated. No param returns all statuses. Any other value returns 400 { error: 'Invalid status value' }. Filter applied in application code after DB fetch.
Status: LOCKED
Locked on: 2026-05-24
Reason: Server-side filter covering the primary triage use case. Application-code filter avoids PostgREST embedded-table filter syntax complexity.
────────────────────────────────────────
#: D-T1-06-07
Decision: No pagination. Hard LIMIT 500 applied to the clients table query. All clients returned in one response.
Status: LOCKED
Locked on: 2026-05-24
Reason: MVP coach workspaces are small. Pagination complexity not warranted for pilot scale.
────────────────────────────────────────
#: D-T1-06-08
Decision: Default sort: flash card severity ascending (red=0, yellow=1, green=2, no flash card=3), then full_name ASC as tiebreaker. Applied in application code after all data is merged.
Status: LOCKED
Locked on: 2026-05-24
Reason: Client list is a triage surface. At-risk clients (red) must appear first. Alphabetical tiebreaker is predictable.
────────────────────────────────────────
#: D-T1-06-09
Decision: Response shape: { clients: ClientListItem[], total: number }. Each ClientListItem: { id, full_name, email, status, onboarding_completed, created_at, flash_card: { status, reason, last_log_at } | null, subscription: { status, end_date } | null, assigned_staff: { id, full_name, email }[] }. flash_card is null when no flash_cards row exists. subscription is the raw latest client_subscriptions row. assigned_staff is [] when no assignments exist.
Status: LOCKED
Locked on: 2026-05-24
Reason: Approved D5 + D10 response shape. Raw data only — no derived computation in this route.
────────────────────────────────────────
#: D-T1-06-10
Decision: Implementation uses separate sequential and parallel queries merged in TypeScript. Query order: (1) clients — id, onboarding_completed, created_at, LIMIT 500, RLS scopes to coach's clients automatically; early return if empty. (2) Parallel: platform_users for all client IDs, flash_cards for all client IDs, client_subscriptions for all client IDs ordered by created_at DESC, client_staff_assignments for all client IDs. (3) Sequential: platform_users for all distinct staff_id values from client_staff_assignments (only if staff assignments exist). Merge in TypeScript: latest subscription = first subscription row per client_id (already DESC ordered); assigned_staff = matched platform_users for each client's staff IDs.
Status: LOCKED
Locked on: 2026-05-24
Reason: Avoids PostgREST nested select type complexity. Parallel queries minimize round-trips. Simple array merges in TypeScript are readable and type-safe.
────────────────────────────────────────
#: D-T1-06-11
Decision: Error handling — missing or malformed Authorization header: 401 { error: 'Unauthorized' }; token rejected: 401 { error: 'Unauthorized' }; platform_users row not found: 401 { error: 'Unauthorized' }; role_type not coach: 403 { error: 'Forbidden' }; status not active: 403 { error: 'Forbidden' }; invalid ?status value: 400 { error: 'Invalid status value' }; clients query error: 500; platform_users (client IDs) query error: 500; client_staff_assignments query error: 500; platform_users (staff IDs) query error: 500; flash_cards query error: non-fatal, treat as no flash cards; client_subscriptions query error: non-fatal, treat as no subscriptions; zero clients after filter: 200 { clients: [], total: 0 }; outer catch: 500 { error: 'Internal server error' }.
Status: LOCKED
Locked on: 2026-05-24
Reason: flash_cards and subscriptions may genuinely not exist yet for new clients — errors there must not fail the list. Core identity and assignment data errors are fatal.

────────────────────────────────────────

## Tier 1 - Client Activation API Route (T1-07)

All decisions below approved by founder on 2026-05-24 before implementation begins.

#: D-T1-07-01
Decision: Route location: apps/web/app/api/client-activation/complete/route.ts (POST handler only)
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with App Router API route convention. Separate directory from /api/clients/ to signal this is a public, unauthenticated activation endpoint.
────────────────────────────────────────
#: D-T1-07-02
Decision: Public endpoint. No Authorization header. Request body: { token: string, password: string }. Raw token is the credential; hash it server-side to look up the client.
Status: LOCKED
Locked on: 2026-05-24
Reason: Activation link contains the raw token. No Bearer token exists yet — the client has no account credentials until this route completes.
────────────────────────────────────────
#: D-T1-07-03
Decision: DB client — service role for all activation reads/writes: token hash lookup on clients, read platform_users, auth.admin.updateUserById, update platform_users.status, clear clients.activation_token_hash and activation_expires_at. Anon client only for final signInWithPassword to generate session tokens.
Status: LOCKED
Locked on: 2026-05-24
Reason: Token lookup and activation writes require service role (no caller JWT exists at activation time; platform_users UPDATE is revoked from authenticated role per S-08). signInWithPassword uses anon client per standard Supabase auth pattern.
────────────────────────────────────────
#: D-T1-07-04
Decision: Token lookup — hash raw token using crypto.createHash('sha256').update(token).digest('hex'). Query clients WHERE activation_token_hash = <hash> via service role. No row found -> 401. Row found but activation_expires_at <= now() -> 401. Both cases return identical body: { "error": "Invalid or expired activation token" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: SHA-256 matches the hashing used in the create_client_invite RPC (encode(sha256(v_raw_token::bytea), 'hex')). Identical 401 for not-found and expired prevents token enumeration.
────────────────────────────────────────
#: D-T1-07-05
Decision: Already-activated guard — after token lookup, fetch platform_users.status. status = active -> 409 { "error": "Already activated" }. status in (suspended, banned, deactivated) -> 403 { "error": "Forbidden" }. any unexpected status -> 500 { "error": "Internal server error" }. status = pending -> proceed.
Status: LOCKED
Locked on: 2026-05-24
Reason: Different statuses warrant different HTTP semantics. 409 signals a re-submission (idempotent re-try). 403 signals the account is blocked and no further action is possible.
────────────────────────────────────────
#: D-T1-07-06
Decision: Activation sequence — run in order, do not call this flow atomic. (1) auth.admin.updateUserById(clientId, { password }): Supabase password rejection -> 422 { "error": "Password not accepted" }; other failure -> 500; no state changed yet. (2) Update platform_users.status to active: failure -> console.error('PARTIAL ACTIVATION — auth password set but platform_users.status not updated: ' + clientId) -> 500; do not proceed. (3) Clear clients.activation_token_hash and activation_expires_at: failure -> console.error('PARTIAL ACTIVATION — status active but token not cleared: ' + clientId) -> 500; do not proceed. (4) anonClient.auth.signInWithPassword({ email, password }): failure -> do not roll back activation; console.error('ACTIVATION COMPLETE BUT SIGN-IN FAILED: ' + clientId) -> 500 { "error": "Activation completed but sign-in failed" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Each step has irreversible side effects. Explicit logging at each partial-failure point enables manual recovery. Step 1 is the only safe rollback point. After step 2, the client is active and rolling back would cause data inconsistency.
────────────────────────────────────────
#: D-T1-07-07
Decision: Enforce password >= 8 characters in route before calling Supabase. Return 400 { "error": "password must be at least 8 characters" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Supabase default minimum is 6 chars. 8-char minimum is a basic security baseline. Route-level check returns a clear 400 before any service role call.
────────────────────────────────────────
#: D-T1-07-08
Decision: Success response (HTTP 200): { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }. Same shape as T1-02 /api/login. Client is immediately signed in after activation.
Status: LOCKED
Locked on: 2026-05-24
Reason: Activation completes in one step — no separate login call needed. Token shape matches T1-02 for consistent client handling.
────────────────────────────────────────
#: D-T1-07-09
Decision: Error codes — missing/non-string token or password: 400 { "error": "token and password are required" }; password < 8 chars: 400 { "error": "password must be at least 8 characters" }; token not found or expired: 401 { "error": "Invalid or expired activation token" }; already activated: 409 { "error": "Already activated" }; suspended/banned/deactivated: 403 { "error": "Forbidden" }; Supabase password rejection: 422 { "error": "Password not accepted" }; partial activation failures (steps 2-3): 500 { "error": "Internal server error" }; activation done but sign-in failed: 500 { "error": "Activation completed but sign-in failed" }; unexpected status: 500 { "error": "Internal server error" }; any other failure: 500 { "error": "Internal server error" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent HTTP semantics across all cases. 401/403/409 are distinguishable by client for UX. Partial activation errors are 500 to trigger alerting without leaking internal state.
────────────────────────────────────────
#: D-T1-07-10
Decision: Do not accept email from caller. Fetch email from platform_users.email via service role after token lookup.
Status: LOCKED
Locked on: 2026-05-24
Reason: Accepting email from caller would allow an attacker with a stolen token to associate any email with the activated account. Email is a server-authoritative field.
────────────────────────────────────────
#: D-T1-07-11
Decision: clients.onboarding_completed stays false after activation. Onboarding is a separate later flow.
Status: LOCKED
Locked on: 2026-05-24
Reason: Activation and onboarding are distinct lifecycle steps. Conflating them would require a separate mechanism to distinguish first-time onboarding from re-activation.

────────────────────────────────────────

## Tier 1 - Storage Signed Upload URL API Route (T1-08)

All decisions below approved by founder on 2026-05-24 before implementation begins.

Resequencing note: MVP_Build_Sequencing.md originally listed Client Mobile Home/Today (Task 16) before the storage signed URL routes. signed-upload-url is pulled forward as T1-08 because it unblocks complete client daily logging with meal photos. Full Client Mobile Home/Today implementation follows after this route ships.

Scope: Authenticated active client meal-photo upload only. Coach and admin upload flows are deferred.

#: D-T1-08-01
Decision: Route location: apps/web/app/api/storage/signed-upload-url/route.ts (POST only)
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with App Router API route convention. Dedicated storage/ directory for all storage-related routes.
────────────────────────────────────────
#: D-T1-08-02
Decision: Bearer token required. Anon client getUser(token) — 401 if invalid. Read platform_users.role_type and status. Only role_type = 'client' and status = 'active' may proceed. Any other role or status -> 403.
Status: LOCKED
Locked on: 2026-05-24
Reason: Upload URL issuance is a privileged operation. Only active clients upload meal photos in T1-08 scope. Coach/admin upload flows are deferred.
────────────────────────────────────────
#: D-T1-08-03
Decision: Request body: { "path": string, "content_type": string, "size": number }. All three fields required. size is the declared byte count of the file the client intends to upload.
Status: LOCKED
Locked on: 2026-05-24
Reason: Server validates path ownership and content rules before issuing a signed URL. Declared size check is a cheap early gate before any Storage API call.
────────────────────────────────────────
#: D-T1-08-04
Decision: Path validation — path must match {coach_id}/{client_id}/{filename} where coach_id and client_id are valid UUIDs and filename is 1–255 chars (alphanumeric plus period, hyphen, underscore). client_id segment must equal auth.uid(). coach_id segment must equal the caller's clients.coach_id (read via createUserClient). Invalid format or mismatched IDs -> 403 { "error": "Forbidden" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Path structure enforces tenant isolation. client_id check prevents a client writing to another client's path. coach_id check prevents path fabrication with an arbitrary coach ID.
────────────────────────────────────────
#: D-T1-08-05
Decision: Content type validation — accepted: image/jpeg, image/png only. Anything else -> 400 { "error": "content_type must be image/jpeg or image/png" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Meal photo upload use case. Only JPEG and PNG are permitted. Validation is by declared content_type value; actual byte-level enforcement happens at upload time via storage policies.
────────────────────────────────────────
#: D-T1-08-06
Decision: Size validation — max 5MB = 5,242,880 bytes. size <= 0 -> 400. size > 5,242,880 -> 400 { "error": "size must not exceed 5MB" }. This route validates the declared size only. Actual byte-level enforcement is the responsibility of the Supabase bucket max file size configuration — not Storage RLS. Storage RLS enforces tenant path access only.
Status: LOCKED
Locked on: 2026-05-24
Reason: Cheap early gate. Declared size check catches clients that have already read the file size and are sending an oversized file before any Storage API call. Bucket-level enforcement is the authoritative guard.
────────────────────────────────────────
#: D-T1-08-07
Decision: DB client for path verification — use createUserClient(token) to read clients.coach_id for the caller. RLS ensures the client reads only their own row. No service role for DB reads.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with prior routes. RLS provides the tenancy guarantee; service role is reserved for Storage operations only.
────────────────────────────────────────
#: D-T1-08-08
Decision: Signed URL generation — use createServiceRoleClient().storage.from('tenant-media').createSignedUploadUrl(path, { upsert: false }). No TTL parameter exists in the installed API (storage-js 2.105.4). The SDK does not expose expires_in in its response. Therefore expires_in in the route response is null. Do not fabricate a TTL value.
Status: LOCKED
Locked on: 2026-05-24
Reason: Verified against installed storage-js 2.105.4 type declarations. createSignedUploadUrl signature: createSignedUploadUrl(path: string, options?: { upsert: boolean }). No TTL option exists. SDK response shape: { data: { signedUrl: string, token: string, path: string }, error: null }. upsert: false prevents overwriting an existing upload at the same path.
────────────────────────────────────────
#: D-T1-08-09
Decision: Success response (HTTP 200): { "signed_url": "...", "path": "...", "expires_in": null }. expires_in is null because the SDK does not expose TTL. Do not forward raw Supabase SDK response fields (signedUrl camelCase, token) — normalize to signed_url snake_case and omit token from route response.
Status: LOCKED
Locked on: 2026-05-24
Reason: API consumers expect snake_case consistent with all other T1 routes. Token field is internal to the Supabase signed upload flow and must not be exposed in the route response.
────────────────────────────────────────
#: D-T1-08-10
Decision: Error codes — missing/invalid JWT: 401 { "error": "Unauthorized" }; platform_users row not found: 401 { "error": "Unauthorized" }; role_type != client: 403 { "error": "Forbidden" }; status != active: 403 { "error": "Forbidden" }; missing body fields: 400 { "error": "path, content_type, and size are required" }; invalid path format or ID mismatch: 403 { "error": "Forbidden" }; invalid content_type: 400 { "error": "content_type must be image/jpeg or image/png" }; size <= 0 or > 5MB: 400 { "error": "size must not exceed 5MB" }; clients row not found: 403 { "error": "Forbidden" }; storage URL generation failure: 500 { "error": "Internal server error" }; any other failure: 500 { "error": "Internal server error" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent HTTP semantics. Path and ID mismatches return 403 (not 400) to avoid leaking structural information about valid paths.
────────────────────────────────────────
#: D-T1-08-11
Decision: No filename sanitization beyond path regex. Path regex validation (alphanumeric plus period, hyphen, underscore, 1–255 chars for filename segment) is the only normalization applied. Route does not rename or transform filenames. Storage RLS and path structure provide the isolation boundary.
Status: LOCKED
Locked on: 2026-05-24
Reason: Filename content beyond the character set is the client's concern. Server responsibility is path ownership validation, not filename normalization.
────────────────────────────────────────
#: D-T1-08-12
Decision: Constraints — no migrations, no RLS changes, no database.types.ts changes, no signed-download-url or delete-object implementation, no mobile Home/Today implementation, no coach/admin upload flows.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope is limited to the single server route required to unblock T1-08. All deferred items require separate founder approval.

────────────────────────────────────────

## Tier 1 - Flash Card Compute Cron Route (T1-09)

All decisions below approved by founder on 2026-05-24 before implementation begins.

#: D-T1-09-01
Decision: Route location: apps/web/app/api/flash-cards/compute/route.ts (POST only)
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with App Router API route convention. flash-cards/ directory for all flash card server routes.
────────────────────────────────────────
#: D-T1-09-02
Decision: Auth model — cron secret. Validate Authorization: Bearer <secret> against process.env.CRON_SECRET. CRON_SECRET missing, Authorization header missing, or token mismatch -> 401 { "error": "Unauthorized" }. This is not Supabase JWT auth. No user identity exists at cron invocation time.
Status: LOCKED
Locked on: 2026-05-24
Reason: Cron jobs have no user identity. Shared secret is the standard guard for Next.js cron endpoints. CRON_SECRET must be set in server environment — the route fails closed if it is absent.
────────────────────────────────────────
#: D-T1-09-03
Decision: Do not call refresh_flash_card RPC. The RPC requires coach JWT (auth.uid() as coach ID, get_my_role() = 'coach'). Service role carries no JWT — auth.uid() is null — the RPC raises permission denied. Cron route reimplements computation logic in TypeScript using service role reads/writes. The RPC remains unchanged and valid for coach-triggered single-client refresh via authenticated coach session.
Status: LOCKED
Locked on: 2026-05-24
Reason: Two separate execution paths: cron (service role, no JWT) and coach-triggered (user JWT). RPC was designed for the second path only.
────────────────────────────────────────
#: D-T1-09-04
Decision: Paused clients are processed (not skipped). For paused clients: status = yellow, reason = 'client paused', interpretation = null. Paused clients are excluded from absence detection, but not from flash card computation. Their flash card must show a clear paused state to avoid stale dashboard data.
Status: LOCKED
Locked on: 2026-05-24
Reason: A stale flash card for a paused client is misleading on the coach dashboard. Consistent with what refresh_flash_card would produce if called manually.
────────────────────────────────────────
#: D-T1-09-05
Decision: Use service role for all reads and writes. Bypasses RLS. Required — no user identity at cron invocation time; must read across all coaches.
Status: LOCKED
Locked on: 2026-05-24
Reason: Cron has no caller identity. Service role is the only viable DB access strategy for batch cross-tenant operations.
────────────────────────────────────────
#: D-T1-09-06
Decision: Computation scope — process clients whose platform_users.status IN ('active', 'paused'). Exclude deactivated, suspended, banned, and pending clients. No separate skipped counter; excluded clients are filtered by the query and not counted.
Status: LOCKED
Locked on: 2026-05-24
Reason: Only active and paused clients require an up-to-date flash card. Deactivated/suspended/banned/pending clients are off the coach's triage surface.
────────────────────────────────────────
#: D-T1-09-07
Decision: Computation logic — per client, using the client's coach's coaches.settings with fallback defaults: absence_warning_days default 2, absence_critical_days default 4, weight_stagnation_days default 7. Logic: (1) paused -> yellow/client paused/null; (2) no daily_logs row -> red/no check-ins recorded/no data available; (3) else compute days_absent (server-side UTC date minus last log_date). Thresholds: days_absent > critical_days -> red/no check-in for N days/extended absence detected. days_absent > warning_days -> yellow/missed check-in for N days/absence warning threshold reached. Else check weight stagnation: if all weight values over the last weight_stagnation_days logs are identical AND count >= weight_stagnation_days -> yellow/weight unchanged for N days/stagnation despite compliance. Else -> green/on track/null. food_summary: last 3 non-null meal_description values ordered by log_date DESC, joined with ' | '.
Status: LOCKED
Locked on: 2026-05-24
Reason: Exact TypeScript reimplementation of refresh_flash_card RPC behavior. Same thresholds and defaults ensure cron and coach-triggered recomputes produce identical results.
────────────────────────────────────────
#: D-T1-09-08
Decision: Upsert on flash_cards.client_id (existing UNIQUE constraint). If no row exists: insert client_id, coach_id, status, reason, food_summary, interpretation, last_log_at, computed_at. If row exists: update only status, reason, food_summary, interpretation, last_log_at, computed_at. Never write or overwrite notes under any condition.
Status: LOCKED
Locked on: 2026-05-24
Reason: notes is a coach-private annotation that must survive recomputation. Overwriting it on every hourly cron run would destroy coach work.
────────────────────────────────────────
#: D-T1-09-09
Decision: Date logic — server-side UTC date: new Date().toISOString().slice(0, 10) yields YYYY-MM-DD. Do not implement coach-timezone day-boundary logic in T1-09. Deferred to absence detection and later refinement.
Status: LOCKED
Locked on: 2026-05-24
Reason: UTC date is consistent and deterministic. Coach-timezone boundary logic adds significant complexity not required for MVP accuracy.
────────────────────────────────────────
#: D-T1-09-10
Decision: Error handling — if one client's computation fails, log console.error('FLASH CARD COMPUTE FAILED for client: ' + clientId, error) and continue to next client. Increment errors counter. Do not abort the job for a single client failure.
Status: LOCKED
Locked on: 2026-05-24
Reason: A failure for one client must not block computation for all remaining clients. Logged errors enable manual recovery without stopping the batch.
────────────────────────────────────────
#: D-T1-09-11
Decision: Response shape (HTTP 200): { "processed": <number>, "errors": <number> }. processed = clients successfully upserted. errors = clients that failed computation or upsert. No skipped counter.
Status: LOCKED
Locked on: 2026-05-24
Reason: Simple counters sufficient for cron monitoring. Excluded clients are filtered by query and not tracked separately.
────────────────────────────────────────
#: D-T1-09-12
Decision: Do not implement /api/flash-cards/compute-all, cron scheduling config, dashboard, client profile, mobile screens, or T1-10+.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope limited to single cron route. All deferred items require separate founder approval.

────────────────────────────────────────

## Tier 1 - Storage Signed Download URL API Route (T1-10)

All decisions below approved by founder on 2026-05-24 before implementation begins.

#: D-T1-10-01
Decision: Route location: apps/web/app/api/storage/signed-download-url/route.ts (POST only)
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent with App Router API route convention. Companion to T1-08 signed-upload-url in the storage/ directory.
────────────────────────────────────────
#: D-T1-10-02
Decision: Bearer token required. Validate JWT with anon client getUser(token). Missing/invalid JWT -> 401 { "error": "Unauthorized" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent JWT validation pattern across all authenticated T1 routes.
────────────────────────────────────────
#: D-T1-10-03
Decision: Allowed callers — only platform_users.status = 'active' and role_type IN ('coach', 'client', 'assistant'). All other roles and all non-active statuses -> 403 { "error": "Forbidden" }. Each role has a separate authorization path (D-T1-10-06, D-T1-10-07, D-T1-10-08).
Status: LOCKED
Locked on: 2026-05-24
Reason: Download URLs expose client photo data. All three roles have legitimate access to client media in their assigned scope, but each scope is validated differently.
────────────────────────────────────────
#: D-T1-10-04
Decision: Request body: { "path": string }. Missing or non-string path -> 400 { "error": "path is required" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Download requires only the storage path. No content_type or size needed.
────────────────────────────────────────
#: D-T1-10-05
Decision: Path format: {coach_id}/{client_id}/{filename} where both IDs are UUIDs and filename is 1–255 chars (alphanumeric plus period, hyphen, underscore). Invalid format -> 403 { "error": "Forbidden" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Same path structure as T1-08. Format validation is the first tenant-isolation check.
────────────────────────────────────────
#: D-T1-10-06
Decision: Coach authorization — coach_id path segment must equal auth.uid(). Coach may only download files from their own tenant. Mismatch -> 403 { "error": "Forbidden" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: coaches.id = platform_users.id for coaches. auth.uid() is sufficient to verify tenant ownership.
────────────────────────────────────────
#: D-T1-10-07
Decision: Client authorization — client_id path segment must equal auth.uid(). coach_id path segment must equal caller's clients.coach_id (read via createUserClient). Missing clients row or either mismatch -> 403 { "error": "Forbidden" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Client may only download their own files within their assigned coach's tenant. Two-part check prevents path fabrication.
────────────────────────────────────────
#: D-T1-10-08
Decision: Assistant authorization — (1) read staff_assignments where user_id = auth.uid() and status = 'active' via createUserClient; (2) coach_id path segment must equal staff_assignments.coach_id; (3) read client_staff_assignments where staff_id = auth.uid() and client_id = path client_id via createUserClient; (4) missing assignment or any mismatch -> 403 { "error": "Forbidden" }. Note: staff_assignments column is user_id (not staff_id) per the schema in 002_create_tables.sql.
Status: LOCKED
Locked on: 2026-05-24
Reason: Assistant scope is constrained to their active coach tenant and explicitly assigned clients. Both checks are required. Column name user_id verified from 002_create_tables.sql.
────────────────────────────────────────
#: D-T1-10-09
Decision: DB read model — use createUserClient(token) for all caller-scoped reads: platform_users (self), clients (own row), staff_assignments (own active row via user_id), client_staff_assignments (own assigned-client rows via staff_id). Use service role only for storage signed URL generation. If a createUserClient read returns no row where one is expected, treat as authorization denial -> 403, not 500.
Status: LOCKED
Locked on: 2026-05-24
Reason: RLS policies established in T0-07 enforce these read scopes. Service role is reserved for the storage operation only — no RLS bypass for verification reads.
────────────────────────────────────────
#: D-T1-10-10
Decision: Signed URL generation — createServiceRoleClient().storage.from('tenant-media').createSignedUrl(path, 300). TTL = 300 seconds. Verified: createSignedUrl(path, expiresIn: number) in storage-js 2.105.4 accepts a configurable TTL. Returns { data: { signedUrl: string }, error }.
Status: LOCKED
Locked on: 2026-05-24
Reason: 300 seconds (5 minutes) balances usability and security. TTL is configurable in this SDK version (unlike signed upload URL).
────────────────────────────────────────
#: D-T1-10-11
Decision: Response shape (HTTP 200): { "signed_url": "...", "path": "...", "expires_in": 300 }. Normalize SDK signedUrl (camelCase) to signed_url (snake_case). Do not forward raw SDK response.
Status: LOCKED
Locked on: 2026-05-24
Reason: snake_case consistent with all other T1 routes. expires_in: 300 is accurate since we control the TTL argument.
────────────────────────────────────────
#: D-T1-10-12
Decision: Error codes — missing/invalid JWT: 401 { "error": "Unauthorized" }; platform_users row not found: 401 { "error": "Unauthorized" }; role not coach/client/assistant: 403 { "error": "Forbidden" }; status not active: 403 { "error": "Forbidden" }; missing/non-string path: 400 { "error": "path is required" }; invalid path format: 403 { "error": "Forbidden" }; coach_id mismatch: 403 { "error": "Forbidden" }; client client_id or coach_id mismatch or missing clients row: 403 { "error": "Forbidden" }; assistant missing active staff assignment or not assigned to client: 403 { "error": "Forbidden" }; storage URL generation failure: 500 { "error": "Internal server error" }; any other failure: 500 { "error": "Internal server error" }.
Status: LOCKED
Locked on: 2026-05-24
Reason: Consistent HTTP semantics. All path and ID mismatches return 403 to avoid leaking structural information.
────────────────────────────────────────
#: D-T1-10-13
Decision: Constraints — no migrations, no RLS changes, no database.types.ts changes, no delete-object route, no VIP Group, no dashboard UI, no client profile UI, no mobile Log History, no T1-11 or later.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope limited to this single route.
────────────────────────────────────────
#: D-T1-09-13
Decision: Constraints — no migrations, no RLS changes, no database.types.ts changes, no compute-all route, no cron scheduling config, no dashboard, no client profile, no T1-10 or later.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope control.
────────────────────────────────────────
## T1-11 — Coach Dashboard (/dashboard) + Login Page (/login)
────────────────────────────────────────
#: D-T1-11-01
Decision: Route and page locations — apps/web/middleware.ts (auth guard); apps/web/app/login/page.tsx (login UI); apps/web/app/(coach)/layout.tsx (server-side auth gate for all coach pages); apps/web/app/(coach)/dashboard/page.tsx (server component, fetches data); apps/web/app/(coach)/dashboard/loading.tsx (loading skeleton); apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx (client component, all interactive UI); apps/web/app/(coach)/dashboard/_components/FlashCard.tsx (individual flash card with refresh button).
Status: LOCKED
Locked on: 2026-05-24
Reason: Route group (coach) applies auth-protected layout to all current and future coach pages without per-page repetition. (coach) does not appear in the URL — /dashboard is the resolved path.
────────────────────────────────────────
#: D-T1-11-02
Decision: Real implementation — not a skeleton. Flash card grid with live data, summary stats, status filter, search, sort, per-card refresh button, read-only notes display, conditional billing banner, loading skeleton, empty state, error state.
Status: LOCKED
Locked on: 2026-05-24
Reason: Gate 1 (core loop testable with a real coach) requires the dashboard to function, not just exist.
────────────────────────────────────────
#: D-T1-11-03
Decision: Required data sources — flash_cards (all fields), platform_users (id, full_name, status), clients (id, activation_token_hash, activation_expires_at, coach_id), daily_logs (client_id, log_date for today UTC), coaches (trial_status), coach_subscriptions (status — handle missing row gracefully). All reads via Layer 1 PostgREST, RLS-scoped to the authenticated coach. No service role in frontend.
Status: LOCKED
Locked on: 2026-05-24
Reason: All data required for dashboard sections exists in these tables and is accessible via RLS-scoped reads with the coach's session.
────────────────────────────────────────
#: D-T1-11-04
Decision: API layer choice — Layer 1 PostgREST for all reads; Layer 2 RPC for flash card refresh (refresh_flash_card) and future notes editing (update_flash_card_notes, deferred). No new Layer 3 Next.js API routes for T1-11. No service role exposed to frontend.
Status: LOCKED
Locked on: 2026-05-24
Reason: All dashboard data is RLS-scoped; no business logic beyond row filtering needed for reads. Mutations go through existing Layer 2 RPCs.
────────────────────────────────────────
#: D-T1-11-05
Decision: Auth/session model — LOCKED: @supabase/ssr with cookie-based session. Add @supabase/ssr to apps/web/package.json. Create packages/supabase/browser.ts (createBrowserClient from @supabase/ssr, used in login page and client components). Create packages/supabase/ssr-server.ts (factory function accepting a cookie adapter object, wraps createServerClient from @supabase/ssr — works for both middleware and server components via different adapter implementations). Option A (localStorage) is rejected: cannot be read by middleware, no server-side protection, causes auth flicker, creates rework for future routes.
Status: LOCKED
Locked on: 2026-05-24
Reason: Cookie-based session with @supabase/ssr is the canonical Supabase Next.js App Router pattern. SSR-safe, no auth flicker, readable by both middleware and server components.
────────────────────────────────────────
#: D-T1-11-06
Decision: Trial/expired handling — server component reads coaches.trial_status and coach_subscriptions.status (maybeSingle — handle missing row gracefully). Show billing banner if: trial_status = 'trial_expired' OR coach_subscriptions.status IN ('past_due', 'cancelled', 'expired'). Banner is informational text only — no Stripe link (Stripe not yet integrated). Full flash card grid visible in all states. If no coach_subscriptions row, banner only when trial_status = 'trial_expired'.
Status: LOCKED
Locked on: 2026-05-24
Reason: Trial/expired state must be communicated. Stripe CTA deferred until payment integration.
────────────────────────────────────────
#: D-T1-11-07
Decision: Dashboard sections included in T1-11 — flash card grid (real data); status filter (All/Green/Yellow/Red/Paused); client name search (client-side); sort by severity (default)/name/last update; summary stats row (active, paused, pending activations, missing check-ins today); Open Profile link per card to /clients/:id (present even though page 404s until T1-12); per-card refresh button (refresh_flash_card RPC); notes read-only; stale indicator if computed_at older than 24h; billing banner (conditional); loading.tsx skeleton; empty state; fetch error state.
Status: LOCKED
Locked on: 2026-05-24
Reason: Minimum sections to make the dashboard useful for a real coach in the Gate 1 test.
────────────────────────────────────────
#: D-T1-11-08
Decision: Deferred sections — alerts bar (absence/messaging/subscription counts omitted entirely — no stub zeros); flash card notes inline editing (T1-12); Message client action button (T2); Review Diet action button (T1-12+); Stripe-linked renewal CTA (after Stripe); client list screen /clients (T1-12 candidate); client profile screen /clients/:id (T1-12 candidate).
Status: LOCKED
Locked on: 2026-05-24
Reason: All-zero alerts bar is misleading for a new workspace with no data. Deferred until underlying data sources are operational.
────────────────────────────────────────
#: D-T1-11-09
Decision: Flash card refresh — per-card Refresh button in FlashCard client component. Uses createSupabaseBrowserClient(). On click: (1) set card loading; (2) call supabase.rpc('refresh_flash_card', { [param]: clientId }) — verify exact parameter name against packages/supabase/database.types.ts (may be p_client_id or client_id per the SQL function definition); (3) on success: call onRefresh callback to update that card's entry in DashboardClient local state; (4) on error: show per-card error text, revert loading. No new API route. RPC is coach-only per RLS.
Status: LOCKED
Locked on: 2026-05-24
Reason: refresh_flash_card RPC exists from T0-08, is coach-only, and runs correctly under the authenticated browser session.
────────────────────────────────────────
#: D-T1-11-10
Decision: Notes display — flash_cards.notes displayed read-only in flash card, truncated at 120 chars with ellipsis. Notes inline editing (update_flash_card_notes RPC) deferred to T1-12. Notes field is never written by the compute cron (D-T1-09-11 locked).
Status: LOCKED
Locked on: 2026-05-24
Reason: Editing adds modal/form complexity scoped to a dedicated task.
────────────────────────────────────────
#: D-T1-11-11
Decision: Alerts bar — OMITTED entirely from T1-11. No stub, no placeholder zeros.
Status: LOCKED
Locked on: 2026-05-24
Reason: Absence events, messages, and client_subscriptions data are empty in a new workspace. Misleading zeros are worse UX than omission.
────────────────────────────────────────
#: D-T1-11-12
Decision: Summary stats — four values above the flash card grid: (1) active clients (platform_users status='active' in coach's client IDs); (2) paused clients (status='paused'); (3) pending activations (clients WHERE activation_token_hash IS NOT NULL AND activation_expires_at > now()); (4) missing check-ins today (active client count minus daily_logs count WHERE log_date = today UTC). All computed server-side in dashboard/page.tsx before passing to DashboardClient.
Status: LOCKED
Locked on: 2026-05-24
Reason: All four stats are meaningful and derivable from existing tables with no additional infrastructure.
────────────────────────────────────────
#: D-T1-11-13
Decision: Filtering/sorting/search — all client-side in DashboardClient, applied to already-loaded data. Status filter: 'all'|'green'|'yellow'|'red'|'paused'. Search: case-insensitive substring on clientName. Sort 'severity' (default): red=0, yellow=1, green=2, paused=3, no-card=4, then last_log_at DESC NULLS LAST. Sort 'name': clientName A-Z. Sort 'lastUpdate': last_log_at DESC NULLS LAST.
Status: LOCKED
Locked on: 2026-05-24
Reason: Client-side filtering on a pre-fetched array avoids additional API round-trips and is correct for typical coach client counts.
────────────────────────────────────────
#: D-T1-11-14
Decision: Error/empty/loading states — loading: loading.tsx skeleton component; empty (no flash cards): "No clients yet. Invite your first client." with /invites link; fetch error in server component: render error UI (or use Next.js error.tsx); paused cards: distinct paused pill; stale computed_at (> 24h): grey indicator on card; unauthenticated: redirect to /login via middleware and layout.
Status: LOCKED
Locked on: 2026-05-24
Reason: All states required for a production-ready dashboard.
────────────────────────────────────────
#: D-T1-11-15
Decision: Files to create — apps/web/middleware.ts; apps/web/app/login/page.tsx; apps/web/app/(coach)/layout.tsx; apps/web/app/(coach)/dashboard/page.tsx; apps/web/app/(coach)/dashboard/loading.tsx; apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx; apps/web/app/(coach)/dashboard/_components/FlashCard.tsx; packages/supabase/browser.ts; packages/supabase/ssr-server.ts. Files to modify: apps/web/package.json (add @supabase/ssr only); packages/supabase/package.json (add ./browser and ./ssr-server exports); apps/web/app/layout.tsx (minimal only if strictly required by @supabase/ssr provider pattern — otherwise leave untouched); pnpm-lock.yaml (via pnpm install only).
Status: LOCKED
Locked on: 2026-05-24
Reason: Minimal file set for a complete working coach dashboard with proper SSR auth.
────────────────────────────────────────
#: D-T1-11-16
Decision: Files NOT to modify — supabase/migrations/*, RLS policies, packages/supabase/database.types.ts, packages/supabase/client.ts, packages/supabase/server.ts, packages/supabase/auth-server.ts, existing API routes (signup/login/me/workspace/clients/*/client-activation/*/storage/*/flash-cards/*), apps/mobile/*, unrelated pages/components.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope control. All existing API routes unchanged.
────────────────────────────────────────
#: D-T1-11-17
Decision: Validation — pnpm --filter web exec tsc --noEmit (zero errors required); pnpm --filter web build (passes; /dashboard and /login in route table); pnpm --filter web lint (passes or fails only on .eslintrc.json missing — known non-blocking). Integration tests SKIPPED: apps/web/.env.local missing (non-blocking, consistent with T1-07 through T1-10).
Status: LOCKED
Locked on: 2026-05-24
Reason: TypeScript/build/lint remain the verification baseline.
────────────────────────────────────────
#: D-T1-11-18
Decision: Login page behavior — 'use client' component; form with email + password + submit; on submit: createSupabaseBrowserClient().auth.signInWithPassword({ email, password }); on success: router.push('/dashboard') + router.refresh() (refresh triggers middleware to re-read session cookie); on failure: display 'Invalid email or password.' (never surface raw Supabase error strings); middleware redirects authenticated users away from /login before page renders; no OAuth, no magic link, no signup link, no new API route.
Status: LOCKED
Locked on: 2026-05-24
Reason: router.refresh() is required to force Next.js to re-run middleware after session cookie is set by Supabase Auth.
────────────────────────────────────────
#: D-T1-11-19
Decision: middleware.ts behavior — createSupabaseServerClient from packages/supabase/ssr-server.ts with request/response cookie adapter; call supabase.auth.getUser() (NOT getSession() — getUser() revalidates JWT server-side); if /dashboard/* and no user: redirect to /login; if /login and user: redirect to /dashboard; return supabaseResponse (not a new NextResponse) so cookie mutations propagate; matcher: ['/dashboard', '/dashboard/:path*', '/login'].
Status: LOCKED
Locked on: 2026-05-24
Reason: getUser() over getSession() is the security-correct choice — getSession() trusts cookies without revalidation. Returning supabaseResponse ensures token refresh propagates.
────────────────────────────────────────
#: D-T1-11-20
Decision: (coach)/layout.tsx behavior — async server component; reads cookies via next/headers cookies(); calls createSupabaseServerClient from packages/supabase/ssr-server.ts with server cookie adapter; calls supabase.auth.getUser(); if no user: redirect('/login') as belt-and-suspenders behind middleware; renders children only (no navigation shell in T1-11 — deferred).
Status: LOCKED
Locked on: 2026-05-24
Reason: Server-side gate in the layout is belt-and-suspenders insurance behind middleware. Navigation shell deferred to avoid over-scoping T1-11.
────────────────────────────────────────
#: D-T1-12-01
Decision: Task scope — build Coach Client List screen at /clients. New files: apps/web/app/(coach)/clients/loading.tsx, apps/web/app/(coach)/clients/_components/ClientsClient.tsx, apps/web/app/(coach)/clients/page.tsx. Also fix one dead-code bug in apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx (remove <option value="paused">). No new API routes. No new DB migrations. No RLS changes.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope bounded to unblocked UI work. Mutation actions (pause/archive) deferred until later tasks.
────────────────────────────────────────
#: D-T1-12-02
Decision: Assigned assistant column — NOT shown in T1-12. Defer to a later task. The clients table has no assistant assignment in the current schema.
Status: LOCKED
Locked on: 2026-05-24
Reason: Schema does not support it yet. Avoid building UI for non-existent data.
────────────────────────────────────────
#: D-T1-12-03
Decision: Read-only table actions — T1-12 table exposes View Profile link only. No pause/unpause. No archive/deactivate. No mutation actions.
Status: LOCKED
Locked on: 2026-05-24
Reason: Mutation actions require additional design and backend work not in scope for T1-12.
────────────────────────────────────────
#: D-T1-12-04
Decision: Invite new client — inline modal (not a separate page, not a link to /invites). Modal triggered by "Invite Client" button. Modal calls existing POST /api/clients/invite route with { email: string, full_name: string } body and Authorization: Bearer <token> header. On 201 success: show activation_token in a read-only field with copy-to-clipboard button so coach can share with client (no email delivery at MVP). On error: show error.error string in modal, keep modal open. No new API route created.
Status: LOCKED
Locked on: 2026-05-24
Reason: /invites page does not exist yet. Inline modal avoids broken navigation. Displaying activation_token is the MVP delivery mechanism.
────────────────────────────────────────
#: D-T1-12-05
Decision: DashboardClient.tsx bug fix — remove the line <option value="paused">Paused</option> from the flash status filter. The flash_status enum is "green" | "yellow" | "red" only — "paused" does not exist in the enum. This fix ships in the T1-12 commit.
Status: LOCKED
Locked on: 2026-05-24
Reason: Dead code that can never match real data. Removing it prevents silent filter bugs.
────────────────────────────────────────
#: D-T1-12-06
Decision: Client data fetch — page.tsx fetches in parallel: (1) supabase.from('clients').select('id, coach_id, onboarding_completed, created_at, platform_users(full_name, email, status)').eq('coach_id', user.id) using FK join clients.id → platform_users.id; (2) supabase.from('client_subscriptions').select('*').in('client_id', clientIds); (3) supabase.from('flash_cards').select('id, client_id, status, last_log_at, computed_at').in('client_id', clientIds). All three queries run via Promise.all.
Status: LOCKED
Locked on: 2026-05-24
Reason: Three queries cover all required display fields. Parallel fetch minimizes latency.
────────────────────────────────────────
#: D-T1-12-07
Decision: Latest subscription per client — PostgREST cannot do per-group LIMIT 1. Solution: fetch all client_subscriptions for the coach's client IDs, then in page.tsx JavaScript sort by start_date DESC and build a Map<client_id, row> taking the first entry per client_id.
Status: LOCKED
Locked on: 2026-05-24
Reason: PostgREST limitation. Client-side deduplication is simple and correct for MVP scale.
────────────────────────────────────────
#: D-T1-12-08
Decision: "Expiring soon" badge logic — computed client-side in page.tsx: subscription.status is not 'expired' or 'overdue' AND end_date <= today UTC + 7 days. Displayed as yellow badge next to status. No separate filter UI for expiring soon in T1-12.
Status: LOCKED
Locked on: 2026-05-24
Reason: Simple client-side computation avoids extra RPC. Badge provides visual signal without requiring separate filter.
────────────────────────────────────────
#: D-T1-12-09
Decision: Bearer token pattern for invite modal — ClientsClient.tsx is a 'use client' component. To call POST /api/clients/invite (which expects Authorization: Bearer <token>): call createSupabaseBrowserClient().auth.getSession() to get session.access_token, then pass as Authorization: Bearer <token> header in the fetch call. This is consistent with all existing T1-01 through T1-10 API route patterns.
Status: LOCKED
Locked on: 2026-05-24
Reason: Existing API routes use Bearer token auth. Browser client must retrieve token from session to match contract. getSession() is acceptable in browser/client components — the server-side getUser() rule applies only to server components and middleware.
────────────────────────────────────────
#: D-T1-12-10
Decision: Client table columns — Name, Email, Status (from platform_users.status), Flash (from flash_cards.status or "—" if none), Last Log (from flash_cards.last_log_at or "—"), Subscription (from client_subscriptions.status or "—"), Actions (View Profile link to /clients/[id]).
Status: LOCKED
Locked on: 2026-05-24
Reason: Covers all currently available data fields. No invented columns.
────────────────────────────────────────
#: D-T1-12-11
Decision: Client list filters — filter by platform_users.status (all/active/pending/paused) and by flash_cards.status (all/green/yellow/red). Search by name or email (client-side substring match). Sort by name (default), last log date, or subscription status. All filtering/search/sort done client-side on the data fetched in page.tsx.
Status: LOCKED
Locked on: 2026-05-24
Reason: MVP scale does not require server-side filtering. Client-side is simpler and sufficient.
────────────────────────────────────────
#: D-T1-12-12
Decision: Files NOT to modify — supabase/migrations/*, RLS policies, packages/supabase/database.types.ts, packages/supabase/client.ts, packages/supabase/server.ts, packages/supabase/ssr-server.ts, packages/supabase/browser.ts, existing API routes (signup/login/me/workspace/clients/invite/client-activation/*/storage/*/flash-cards/*), apps/mobile/*, apps/web/app/(coach)/dashboard/page.tsx, apps/web/app/(coach)/layout.tsx, apps/web/middleware.ts.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope control. Only the four files listed in D-T1-12-01 are in scope.
────────────────────────────────────────
#: D-T1-12-13
Decision: Validation — pnpm --filter web exec tsc --noEmit (zero errors required); pnpm --filter web build (passes; /clients in route table); pnpm --filter web lint (passes or fails only on .eslintrc.json missing — known non-blocking). Integration tests conditional: if apps/web/.env.local exists run smoke tests for /clients render and invite modal 201/409/validation paths; otherwise skip (non-blocking, consistent with prior tasks).
Status: LOCKED
Locked on: 2026-05-24
Reason: TypeScript/build/lint remain the verification baseline. Integration tests require real Supabase credentials.
────────────────────────────────────────
#: D-T1-13-01
Decision: Task scope — scaffold Expo React Native app in apps/mobile (currently .gitkeep only); build Client Activation screen; build minimal Home placeholder. New files: apps/mobile/package.json, apps/mobile/app.json, apps/mobile/tsconfig.json, apps/mobile/babel.config.js, apps/mobile/.env.example, apps/mobile/app/_layout.tsx, apps/mobile/app/index.tsx, apps/mobile/app/activate.tsx, apps/mobile/app/(client)/_layout.tsx, apps/mobile/app/(client)/home.tsx, packages/supabase/mobile.ts. Modified files: packages/supabase/package.json (add ./mobile export).
Status: LOCKED
Locked on: 2026-05-24
Reason: Core loop cannot advance until client can activate on mobile. Scaffold is a prerequisite for all future mobile tasks.
────────────────────────────────────────
#: D-T1-13-02
Decision: P-04 resolved — mobile pilot distribution is Expo Go for now; EAS Build (TestFlight / Play Store Internal Track) deferred until push notifications are required (Chain Task 24). No EAS config in T1-13. Development uses `npx expo start` and QR scan with Expo Go.
Status: LOCKED
Locked on: 2026-05-24
Reason: Fastest path for development and pilot testing. EAS/native builds add setup cost not needed at this stage.
────────────────────────────────────────
#: D-T1-13-03
Decision: Navigation library — Expo Router ~4 (file-based routing, built on React Navigation). Expo SDK ~52. Root layout: apps/mobile/app/_layout.tsx with Stack navigator, headerShown: false. Route groups: (client)/ for authenticated screens. Entry point apps/mobile/app/index.tsx checks session and redirects to /activate or /(client)/home. apps/mobile/package.json main field: "expo-router/entry".
Status: LOCKED
Locked on: 2026-05-24
Reason: File-based routing aligns with Next.js App Router mental model. Supports deep-link activation cleanly via useLocalSearchParams.
────────────────────────────────────────
#: D-T1-13-04
Decision: Mobile styling — React Native StyleSheet.create() only. No NativeWind, Tamagui, or any external UI/styling library in T1-13. Inline styles forbidden; all styles in StyleSheet.create blocks at the bottom of each file.
Status: LOCKED
Locked on: 2026-05-24
Reason: Zero styling dependency. Keep scaffold simple and stable before adding UI libraries.
────────────────────────────────────────
#: D-T1-13-05
Decision: Activation token delivery — manual text entry is the primary path. app.json registers scheme "coachapp" for future deep links. activate.tsx reads useLocalSearchParams<{ token?: string }>() — if token param is present (from deep link), pre-fill the token input field. Manual entry works regardless. No deep link handling implementation beyond param read.
Status: LOCKED
Locked on: 2026-05-24
Reason: Manual entry must work for pilot even if deep linking is not configured. Param pre-fill is zero-cost and sets up future deep link UX.
────────────────────────────────────────
#: D-T1-13-06
Decision: Supabase mobile client — packages/supabase/mobile.ts exports createMobileSupabaseClient() using createClient<Database> from @supabase/supabase-js with AsyncStorage from @react-native-async-storage/async-storage as the auth.storage adapter (autoRefreshToken: true, persistSession: true, detectSessionInUrl: false). @react-native-async-storage/async-storage added as peerDependency (optional) in packages/supabase/package.json and as direct dependency in apps/mobile/package.json. Export ./mobile added to packages/supabase/package.json exports map.
Status: LOCKED
Locked on: 2026-05-24
Reason: Separate mobile.ts avoids importing @supabase/ssr (web-only) in mobile. Peer dep pattern avoids installing React Native packages in web builds.
────────────────────────────────────────
#: D-T1-13-07
Decision: Session storage after activation — on 200 response from POST /api/client-activation/complete: call createMobileSupabaseClient().auth.setSession({ access_token: json.access_token, refresh_token: json.refresh_token }). Supabase client persists session to AsyncStorage automatically. Then call router.replace('/(client)/home') to navigate to Home.
Status: LOCKED
Locked on: 2026-05-24
Reason: setSession stores credentials via the AsyncStorage adapter. autoRefreshToken handles expiry. router.replace (not push) prevents back-navigation to the activation screen after success.
────────────────────────────────────────
#: D-T1-13-08
Decision: Environment variables — apps/mobile reads EXPO_PUBLIC_API_BASE_URL (Next.js API host, e.g. http://localhost:3000 for dev), EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY. All three stored in apps/mobile/.env.local (gitignored). apps/mobile/.env.example documents all three with placeholder values. Expo exposes EXPO_PUBLIC_* vars to the app at build time.
Status: LOCKED
Locked on: 2026-05-24
Reason: Expo's EXPO_PUBLIC_ prefix is required for vars accessible in app code. Separate from web .env.local.
────────────────────────────────────────
#: D-T1-13-09
Decision: Activation screen flow — (1) User enters token (text input, autoCapitalize off, autoCorrect off) and password (secureTextEntry) and confirm password (secureTextEntry). (2) Client-side validation: token required and non-empty after trim; password length >= 8; password === confirmPassword. (3) POST EXPO_PUBLIC_API_BASE_URL/api/client-activation/complete with { token: token.trim(), password }. (4) On 200: setSession then router.replace('/(client)/home'). (5) On error: show tailored message per status code, keep screen open.
Status: LOCKED
Locked on: 2026-05-24
Reason: Matches API contract exactly. Client-side validation prevents needless API calls for obvious input errors.
────────────────────────────────────────
#: D-T1-13-10
Decision: Activation error messages per status code — 400: display json.error verbatim (already user-friendly from API); 401: "Invalid or expired activation token. Ask your coach to re-invite you."; 403: "Your account is not available. Please contact your coach."; 409: "This account is already activated. Please log in instead."; 422: "Password not accepted. Try a stronger password."; 500 or network error: "Something went wrong. Check your connection and try again." Never surface raw exception messages.
Status: LOCKED
Locked on: 2026-05-24
Reason: Each error code has a distinct user-facing meaning that generic messages would obscure.
────────────────────────────────────────
#: D-T1-13-11
Decision: index.tsx behavior — async session check on mount using createMobileSupabaseClient().auth.getSession(). Show ActivityIndicator while loading. If session exists: router.replace('/(client)/home'). If no session: router.replace('/activate'). No sign-in form on index — it is a routing gate only.
Status: LOCKED
Locked on: 2026-05-24
Reason: Single entry point that routes based on auth state. Prevents activated users from seeing the activation screen again.
────────────────────────────────────────
#: D-T1-13-12
Decision: Home screen — apps/mobile/app/(client)/home.tsx renders a View with two Text elements: a title "Home" and subtitle "Daily logging — coming in T1-14." No data fetching. No state. StyleSheet.create for layout. This is the entire implementation of the Home screen in T1-13.
Status: LOCKED
Locked on: 2026-05-24
Reason: Scope boundary. Full Home/Today daily logging is Task 16 (T1-14). Placeholder confirms navigation works without building the full screen.
────────────────────────────────────────
#: D-T1-13-13
Decision: Expo scaffold package.json dependencies — expo: ~52.0.0, expo-router: ~4.0.0, expo-status-bar: ~2.0.0, expo-linking: ~7.0.0, expo-constants: ~17.0.0, react: 18.3.2, react-native: 0.76.x, react-native-safe-area-context: 4.12.0, react-native-screens: ~4.0.0, @react-native-async-storage/async-storage: 1.23.1, @coaching/supabase: workspace:*. devDependencies: @babel/core: ^7.25.0, @types/react: ~18.3.0, typescript: ^5.3.0, babel-preset-expo: latest. If npx expo install resolves different compatible versions for any package, accept those versions.
Status: LOCKED
Locked on: 2026-05-24
Reason: Expo SDK 52 with Expo Router 4 is the current stable pairing. Workspace reference to @coaching/supabase provides Database type and mobile client.
────────────────────────────────────────
#: D-T1-13-14
Decision: babel.config.js — apps/mobile/babel.config.js with content: module.exports = function(api) { api.cache(true); return { presets: ['babel-preset-expo'] }; }. Required by Expo bundler (Metro).
Status: LOCKED
Locked on: 2026-05-24
Reason: Expo requires babel-preset-expo. Without this file Metro will fail to start.
────────────────────────────────────────
#: D-T1-13-15
Decision: Files NOT to modify — supabase/migrations/*, RLS policies, packages/supabase/database.types.ts, packages/supabase/client.ts, packages/supabase/server.ts, packages/supabase/auth-server.ts, packages/supabase/browser.ts, packages/supabase/ssr-server.ts, apps/web/app/api/**, apps/web/app/(coach)/**, apps/web/middleware.ts, root package.json, root turbo.json. Do not modify any web app files.
Status: LOCKED
Locked on: 2026-05-24
Reason: T1-13 is mobile-only. All web files are out of scope.
────────────────────────────────────────
#: D-T1-13-16
Decision: Validation — (1) pnpm install (install mobile deps into workspace); (2) pnpm --filter @coaching/mobile exec tsc --noEmit (zero TypeScript errors required); (3) pnpm dev:mobile starts without crash (Metro bundler starts). Runtime test: scan QR in Expo Go, confirm activation screen renders, confirm token + password fields exist, confirm error messages display correctly for bad input. Integration test: submit valid token+password against local dev Supabase instance if apps/web/.env.local exists; otherwise skip.
Status: LOCKED
Locked on: 2026-05-24
Reason: TypeScript check is the primary automated gate. Metro start confirms scaffold is valid. Expo Go scan confirms the screen renders on device.
────────────────────────────────────────
#: D-T1-14-01
Decision: Screen file — replace apps/mobile/app/(client)/home.tsx in place. No sub-folder. No sub-components extracted to _components/ unless PhotoPicker warrants it (see D-T1-14-04).
Status: LOCKED
Locked on: 2026-05-24
Reason: Screen is self-contained. Sub-folder adds structure overhead with no benefit at this stage. File already exists as placeholder.
────────────────────────────────────────
#: D-T1-14-02
Decision: Navigation — keep (client) Stack. No tab bar in T1-14. apps/mobile/app/(client)/_layout.tsx remains unchanged.
Status: LOCKED
Locked on: 2026-05-24
Reason: Only one client screen exists. Tab bar can be added when Profile screen is built in a later task. Adding it now creates empty/broken tabs.
────────────────────────────────────────
#: D-T1-14-03
Decision: Form fields — steps (integer input), weight in kg (decimal input), meal_description (multiline TextInput, max 1000 chars), meal photo (PhotoPicker component calling signed upload URL), questions (multiline TextInput, max 2000 chars). All fields map directly to update_today_log RPC args. Empty strings treated as null before RPC call.
Status: LOCKED
Locked on: 2026-05-24
Reason: Matches update_today_log RPC signature exactly. All args are optional; omit null values rather than passing null strings.
────────────────────────────────────────
#: D-T1-14-04
Decision: Photo upload included in T1-14. Use expo-image-picker. Check apps/mobile/package.json first; if expo-image-picker is absent, install via: pnpm --filter @coaching/mobile exec expo install expo-image-picker (do not pick a version manually). Extract a PhotoPicker component to apps/mobile/app/(client)/_components/PhotoPicker.tsx if photo logic exceeds ~40 lines.
Status: LOCKED
Locked on: 2026-05-24
Reason: Signed upload URL route already exists. expo-image-picker is a first-party Expo package requiring no native build for Expo Go. Deferring would create a half-useful daily logging screen.
────────────────────────────────────────
#: D-T1-14-05
Decision: Weight unit — kg only. No unit selector. Display label "kg" next to input. No schema change.
Status: LOCKED
Locked on: 2026-05-24
Reason: No client preference table exists. Simplest correct implementation for MVP.
────────────────────────────────────────
#: D-T1-14-06
Decision: Edit mode — screen always editable. On mount, fetch today's log; if it exists, prefill all fields. Submitting via update_today_log RPC overwrites today's row (RPC is an upsert). No lock-after-submit behavior.
Status: LOCKED
Locked on: 2026-05-24
Reason: RPC is idempotent. Simpler UX. No additional state management needed.
────────────────────────────────────────
#: D-T1-14-07
Decision: Status banners — on mount, also read platform_users.status and client_subscriptions.status (RLS-scoped query). If platform_users.status === 'paused': show banner "Your account is paused. Contact your coach to resume." and disable submit. If platform_users.status is 'deactivated', 'suspended', or 'banned': show "Your account is not active. Contact your coach." and disable submit. If client_subscriptions.status is 'expired' or 'overdue': show "Your subscription has expired. Contact your coach." and disable submit. If status === 'active' and subscription === 'active': no banner, submit enabled.
Status: LOCKED
Locked on: 2026-05-24
Reason: Graceful UX. Shows intent to user rather than letting RLS silently reject the RPC. No redirect — banners keep navigation simple.
────────────────────────────────────────
#: D-T1-14-08
Decision: Prefill strategy — fetch today's daily_log using: supabase.from('daily_logs').select('*').eq('log_date', todayISO).maybeSingle() where todayISO is new Date().toISOString().slice(0,10). No new RPC needed. RLS limits reads to client's own rows. If log exists, prefill all fields. If not, fields start empty.
Status: LOCKED
Locked on: 2026-05-24
Reason: Direct client query is sufficient. RLS already scopes reads. No new migration or RPC required.
────────────────────────────────────────
#: D-T1-14-09
Decision: Validation rules — steps: integer >= 0, max 99999 (reject decimals client-side); weight: float >= 0, max 999.9, up to 1 decimal place; meal_description: max 1000 chars; questions: max 2000 chars; meal_photo_key: set only if upload succeeded, otherwise omit.
Status: LOCKED
Locked on: 2026-05-24
Reason: Prevents obviously invalid data reaching the RPC. Limits match MVP data model expectations.
────────────────────────────────────────
#: D-T1-14-10
Decision: Offline behavior — no offline support. If submit attempted with no network, show generic error "Check your connection and try again." No local queue, no optimistic caching.
Status: LOCKED
Locked on: 2026-05-24
Reason: No offline persistence library installed. Adds significant complexity out of scope for T1-14.
────────────────────────────────────────
#: D-T1-14-11
Decision: Loading/error/success states — mount: ActivityIndicator while fetching today's log + status; submit: disable button + inline spinner; success: show inline "Logged ✓" text, stay on screen (no navigation); fetch error: show banner above form, form still renders with empty fields; submit error: inline error text below form, form remains editable.
Status: LOCKED
Locked on: 2026-05-24
Reason: Inline success avoids disrupting the screen. Graceful fetch error keeps screen usable.
────────────────────────────────────────
#: D-T1-14-12
Decision: Photo upload flow — (1) ImagePicker.launchImageLibraryAsync with mediaTypes: Images, allowsEditing: true, quality: 0.8. (2) If user cancels, photo field remains unset. (3) On pick: read file URI + mimeType (image/jpeg or image/png). (4) Fetch file size via expo-file-system or from ImagePicker result (fileSize if available). (5) Construct path as {coach_id}/{client_id}/{timestamp}.{ext} where coach_id fetched from clients.coach_id, client_id = supabase.auth.user().id. (6) POST to EXPO_PUBLIC_API_BASE_URL/api/storage/signed-upload-url with Bearer token, { path, content_type, size }. (7) PUT image binary to signed_url (fetch PUT with ArrayBuffer body). (8) On success use path as p_meal_photo_key. (9) On any step failure, clear photo selection and show error.
Status: LOCKED
Locked on: 2026-05-24
Reason: Matches signed upload URL API contract exactly. PUT to signed_url is how Supabase Storage signed uploads work. Path ownership is verified server-side.
────────────────────────────────────────
#: D-T1-14-13
Decision: Files allowed — modify apps/mobile/app/(client)/home.tsx (replace placeholder); create apps/mobile/app/(client)/_components/PhotoPicker.tsx (if photo logic extracted); modify apps/mobile/package.json only if expo-image-picker must be added; pnpm-lock.yaml updated automatically by pnpm install. Update control docs at final step only.
Status: LOCKED
Locked on: 2026-05-24
Reason: Minimal scope. All changes are mobile-only. No web files touched.
────────────────────────────────────────
#: D-T1-14-14
Decision: Files NOT to modify — apps/web/*, existing web API routes, supabase/migrations/*, RLS policies, packages/supabase/database.types.ts, apps/mobile/app/_layout.tsx, apps/mobile/app/index.tsx, apps/mobile/app/activate.tsx, apps/mobile/app/(client)/_layout.tsx, packages/supabase/mobile.ts, packages/supabase/package.json.
Status: LOCKED
Locked on: 2026-05-24
Reason: T1-14 is a single-screen replacement. All shared infrastructure, web files, and other mobile screens are out of scope.
────────────────────────────────────────
#: D-T1-14-15
Decision: Validation commands — (1) pnpm --filter @coaching/mobile exec tsc --noEmit (zero errors required). (2) Metro / Expo Go runtime: run if device available; if not, report as "skipped — no device connected" and log reason. Both results must be explicitly reported.
Status: LOCKED
Locked on: 2026-05-24
Reason: TypeScript is the primary automated gate. Metro/Expo Go is the functional gate but requires a device not guaranteed in all environments.

────────────────────────────────────────
## T1-15 — Coach Client Profile Screen (/clients/[id])
────────────────────────────────────────
#: D-T1-15-01
Decision: T1-15 = Coach Client Profile screen at apps/web/app/(coach)/clients/[id]/. Fix the current /clients/[id] 404 caused by ClientsClient.tsx already emitting href={`/clients/${c.id}`} links with no matching route. All data infrastructure exists; no new migrations, RLS, or RPCs required.
Status: LOCKED
Locked on: 2026-05-24
Reason: /clients links to /clients/[id] today but the route does not exist. Highest-priority broken link. All backend RPCs and storage routes are already in place.
────────────────────────────────────────
#: D-T1-15-02
Decision: Files allowed — create only: apps/web/app/(coach)/clients/[id]/page.tsx, apps/web/app/(coach)/clients/[id]/loading.tsx, apps/web/app/(coach)/clients/[id]/_components/ClientProfileClient.tsx. Modify only after implementation: PROJECT_STATE.md, TASK_LOG.md, docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.
Status: LOCKED
Locked on: 2026-05-24
Reason: T1-15 is a new route under an existing auth group. No other files need modification.
────────────────────────────────────────
#: D-T1-15-03
Decision: Files NOT to modify — apps/web/app/(coach)/clients/_components/ClientsClient.tsx, apps/web/app/(coach)/clients/page.tsx, apps/web/app/(coach)/dashboard/**, apps/web/app/(coach)/layout.tsx, apps/web/app/api/**, apps/mobile/**, packages/supabase/**, supabase/migrations/**, supabase/tests/**, untracked claude agents/ directory.
Status: LOCKED
Locked on: 2026-05-24
Reason: T1-15 adds a new sub-route only. All shared infrastructure and other routes are out of scope.
────────────────────────────────────────
#: D-T1-15-04
Decision: Server/client split — page.tsx is a server component: verify auth, verify client ownership (clients.coach_id = coach user id), fetch all app-table data via RLS-scoped session client, batch-generate signed URLs via service role after ownership verified, pass serializable props to ClientProfileClient. ClientProfileClient.tsx is a client component: pause/unpause RPC calls, flash-card notes RPC calls, photo lightbox state.
Status: LOCKED
Locked on: 2026-05-24
Reason: Server component handles auth + data fetch with RLS. Client component handles interactive mutations and modal state only. Follows pattern established in T1-11/T1-12.
────────────────────────────────────────
#: D-T1-15-05
Decision: Data sources — all app-table reads use the coach session client (not service role). Fetch in parallel: (1) clients: id, coach_id, onboarding_completed, created_at — filter id=clientId AND coach_id=userId — abort to redirect('/clients') if not found; (2) platform_users: full_name, email, status, created_at — filter id=clientId; (3) client_subscriptions: status, start_date, end_date — filter client_id=clientId, order start_date DESC, limit 1, maybeSingle(); (4) flash_cards: id, status, last_log_at, computed_at, notes — filter client_id=clientId, order computed_at DESC, limit 1, maybeSingle(); (5) daily_logs: id, log_date, steps, weight, meal_description, meal_photo_key, questions — filter client_id=clientId, order log_date DESC, limit 30.
Status: LOCKED
Locked on: 2026-05-24
Reason: All tables are RLS-scoped to the authenticated coach. Subscription filter corrected to client_id (not id). Ownership check on clients table is the authorization gate for all subsequent fetches.
────────────────────────────────────────
#: D-T1-15-06
Decision: Signed URL strategy — use createServiceRoleClient().storage.from('tenant-media').createSignedUrls(photoKeys, 300) after ownership verified and photo keys derived only from the fetched daily_logs. If createSignedUrls unavailable, fall back to Promise.all over createSignedUrl(path, 300) per key. Do NOT call POST /api/storage/signed-download-url from the server component (circular). Service role must not read app tables.
Status: LOCKED
Locked on: 2026-05-24
Reason: Direct service role Storage call avoids HTTP round-trip to own API. Ownership is already verified before this step. TTL 300s acceptable for MVP server-rendered page.
────────────────────────────────────────
#: D-T1-15-07
Decision: Sections included — (1) client header: name, email, status badge, subscription badge (if row exists), member since date; (2) quick actions: Pause button (status=active) / Unpause button (status=paused) / neither for other statuses; (3) flash card: status badge, last_log_at, computed_at, editable notes textarea, Save notes button; (4) daily log timeline: last 30 entries — log_date, steps, weight, meal_description truncated 80 chars, meal photo thumbnail 60x60, questions truncated 60 chars; (5) photo lightbox: click thumbnail opens full-size overlay, close via X or outside click.
Status: LOCKED
Locked on: 2026-05-24
Reason: These are the minimum sections to make the profile screen useful to a coach. All required data and RPCs exist.
────────────────────────────────────────
#: D-T1-15-08
Decision: Sections deferred — staff assignment, plan assignment, absence management, payment confirmation, flash-card manual refresh (refresh_flash_card RPC), messaging history, deactivate/ban/suspend client, daily-log pagination.
Status: LOCKED
Locked on: 2026-05-24
Reason: These features are out of Tier 1 scope or require additional infrastructure.
────────────────────────────────────────
#: D-T1-15-09
Decision: Pause/unpause RPC calls — verified parameter names from database.types.ts: pause_client Args: { p_client_id: string }; unpause_client Args: { p_client_id: string }. Use: supabase.rpc('pause_client', { p_client_id: clientId }) and supabase.rpc('unpause_client', { p_client_id: clientId }). On success: update local displayed status. On error: show inline error below action area. Calls use browser Supabase client with coach session cookie.
Status: LOCKED
Locked on: 2026-05-24
Reason: RPC parameter names verified against database.types.ts. RPCs are SECURITY DEFINER — role enforcement is internal.
────────────────────────────────────────
#: D-T1-15-10
Decision: Flash-card notes RPC — verified parameter names from database.types.ts: update_flash_card_notes Args: { p_card_id: string; p_notes: string }. Use: supabase.rpc('update_flash_card_notes', { p_card_id: flashCard.id, p_notes: notesValue }). No auto-save or debounce. Explicit save button only. Success: show "Saved ✓" for 2s. Error: show inline error below textarea. If no flash card row: show "Flash card data not yet computed." and hide notes field.
Status: LOCKED
Locked on: 2026-05-24
Reason: RPC parameter names verified against database.types.ts. Explicit save avoids accidental overwrites.
────────────────────────────────────────
#: D-T1-15-11
Decision: Photo behavior — use plain <img> tag (not next/image). Signed URL TTL = 300s. No auto-refresh for expired photos. Missing/broken photo shows gray bg-gray-100 placeholder. Click thumbnail opens lightbox modal (client state selectedPhoto: string | null). Full-size photo in overlay. Close via X button or outside click.
Status: LOCKED
Locked on: 2026-05-24
Reason: next/image caching is incorrect for short-TTL signed URLs. Plain img is correct. Lightbox is minimal client state.
────────────────────────────────────────
#: D-T1-15-12
Decision: Empty/loading/error states — loading.tsx shows skeleton; client not found/not owned → redirect('/clients') from server; no subscription row → suppress subscription badge; no flash card row → "Flash card data not yet computed." (notes field hidden); no daily logs → "No logs recorded yet."; missing photo URL → gray placeholder; pause/unpause RPC error → inline error below action; notes save error → inline error below textarea.
Status: LOCKED
Locked on: 2026-05-24
Reason: Covers all realistic data absence scenarios without crashing the screen.
────────────────────────────────────────
#: D-T1-15-13
Decision: Validation commands — (1) pnpm --filter web exec tsc --noEmit — must pass, zero errors; (2) pnpm --filter web build — must pass, /clients/[id] must appear in route table; (3) pnpm --filter web lint — must pass or only known non-blocking issue; (4) git status --short — must show only intended T1-15 files plus control docs staged; claude agents/ must remain untracked and not staged.
Status: LOCKED
Locked on: 2026-05-24
Reason: TypeScript + build are the primary automated gates. Git status check ensures claude agents/ tooling directory is never accidentally committed.

────────────────────────────────────────

## T1-16 — Core Loop Validation + Environment Setup

All decisions below approved by founder on 2026-05-25 before implementation begins.

#: D-T1-16-01
Decision: T1-16 = Core Loop Validation + Environment Setup. The task is validation-first, not a feature task. The core loop (T1-01 through T1-15) has never been end-to-end tested because apps/web/.env.local was missing. Tier 3 (messaging) must not start on an unvalidated stack. Gate 1 must pass before any Tier 3 work begins.
Status: LOCKED
Locked on: 2026-05-25
Reason: All Tier 1 routes had integration tests deferred due to missing .env.local. Gate 1 is the declared prerequisite for Tier 3.
────────────────────────────────────────
#: D-T1-16-02
Decision: T1-16 scope — five sequential phases: Phase 1: verify .env.example files + code for required env var names, then create apps/web/.env.local from local Supabase credentials (not committed). Phase 2: inspect each route file to confirm exact status codes and response shapes, then run API integration tests for T1-01 through T1-10 routes (happy paths + primary error paths). Phase 3: web UI smoke test — verify /login loads, /dashboard loads after login, /clients loads, /clients/[id] loads for a created client. Phase 4: fix any verified non-migration bugs found. Phase 5: declare Gate 1 PASS or BLOCKED in PROJECT_STATE.md.
Status: LOCKED
Locked on: 2026-05-25
Reason: Environment setup unblocks all deferred integration tests. Route contract verification before tests prevents false failures from wrong expected values. Smoke test confirms the full coach flow end-to-end.
────────────────────────────────────────
#: D-T1-16-03
Decision: All feature tasks deferred. Do not build messaging, plans, admin panel, push notifications, or any Tier 2+ feature in T1-16. Tier 3 planning begins only after Gate 1 PASS is declared.
Status: LOCKED
Locked on: 2026-05-25
Reason: Building new features on an unvalidated stack risks compounding bugs. Validation first.
────────────────────────────────────────
#: D-T1-16-04
Decision: Environment variable values — derived from `npx supabase@2.98.2 --workdir . status` output: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from status>, SUPABASE_SERVICE_ROLE_KEY=<service_role key from status>, NEXT_PUBLIC_APP_URL=http://localhost:3000, CRON_SECRET=local-dev-cron-secret. Do not invent env vars unless code requires them. Read apps/web/.env.example and root .env.example first; also grep for process.env in apps/web/ and packages/supabase/ to confirm the exact set of required names before writing .env.local.
Status: LOCKED
Locked on: 2026-05-25
Reason: Using only required variable names prevents accumulating stale or unused config. CRON_SECRET=local-dev-cron-secret is local-only and must never be committed.
────────────────────────────────────────
#: D-T1-16-05
Decision: Mobile validation excluded from T1-16. Metro/Expo Go runtime validation requires a physical device and remains deferred. Its deferred status must be preserved in PROJECT_STATE.md.
Status: LOCKED
Locked on: 2026-05-25
Reason: No device available. Mobile exclusion does not affect Gate 1 declaration, which covers web only.
────────────────────────────────────────
#: D-T1-16-06
Decision: .gitignore additions — add `claude agents/` and `.codex/` to the root .gitignore. These are pre-existing untracked local tooling directories that must never be committed. Do not stage or commit the directories themselves. Only the .gitignore change is committed.
Status: LOCKED
Locked on: 2026-05-25
Reason: Both directories have appeared as `??` in git status since T1-13. Adding them to .gitignore prevents accidental staging by future IDE sessions.
────────────────────────────────────────
#: D-T1-16-07
Decision: Files allowed — create: apps/web/.env.local (local only, not committed); modify: .gitignore (add claude agents/ and .codex/ entries); modify: PROJECT_STATE.md, TASK_LOG.md, docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md (control doc updates after Gate 1 declared). If bugs are found and fixed: the buggy route/component files are also allowed. Commit: only .gitignore + control doc updates (and any bug fix files). Never commit apps/web/.env.local.
Status: LOCKED
Locked on: 2026-05-25
Reason: Minimal file set. Validation produces no new app files. Bug fixes are in-scope only if tests expose them.
────────────────────────────────────────
#: D-T1-16-08
Decision: Files NOT to modify — supabase/migrations/001–013 (immutable), supabase/tests/G0-01 through G0-16 (Gate 0 suite), packages/supabase/database.types.ts, any RLS policies or schema objects. If a test failure requires modifying any of these, STOP and report to founder before changing anything.
Status: LOCKED
Locked on: 2026-05-25
Reason: Gate 0 suite and migrations are immutable by project rule. Schema issues require founder review before any change.
────────────────────────────────────────
#: D-T1-16-09
Decision: Gate 1 PASS criteria — all of the following must be true: (1) local Supabase running; (2) apps/web/.env.local created and gitignored; (3) pnpm dev:web starts without crash; (4) all API integration test assertions pass (happy paths + primary error paths for T1-01 through T1-10 routes); (5) /login page loads; (6) /dashboard loads after login; (7) /clients loads; (8) /clients/[id] loads for a created client; (9) TypeScript still passes (zero errors); (10) build still passes if any files were changed; (11) lint still passes or only known non-blocking issue; (12) .gitignore updated for claude agents/ and .codex/. If any blocking check fails, declare Gate 1 BLOCKED and document the exact blocker. Mobile runtime validation remains deferred and does not affect Gate 1.
Status: LOCKED
Locked on: 2026-05-25
Reason: All 12 criteria must pass to confirm the Tier 1 core loop is end-to-end functional. Blocking check failure must be documented precisely for founder review.
────────────────────────────────────────
#: D-T1-16-10
Decision: Route contract verification before running any integration test — for each route being tested, read the actual route file and confirm: (a) the HTTP status code returned on success (do not assume 200 vs 201), (b) the exact JSON shape of the success response, (c) the HTTP status codes returned on primary error paths. Use these observed values as the expected values in tests. Do not assume any contract from memory or prior summaries.
Status: LOCKED
Locked on: 2026-05-25
Reason: Several routes were implemented by Claude IDE and status codes were not always explicitly confirmed in prior sessions. Testing against wrong expected values produces false failures that waste debugging time.
────────────────────────────────────────
#: D-T1-16-11
Decision: Bug fix rule — if tests reveal ordinary route or UI bugs (wrong status code, wrong response shape, missing field, auth regression, RLS-scoped data visible to wrong role), fix them inside T1-16. If tests reveal schema, RLS policy, migration, or RPC issues, STOP and report the exact finding to founder before making any change.
Status: LOCKED
Locked on: 2026-05-25
Reason: Ordinary app bugs are in scope. Schema/RLS changes require founder sign-off because they affect Gate 0 invariants.
────────────────────────────────────────
#: D-T1-16-12
Decision: Test data strategy — use unique timestamped emails for signup/invite calls (e.g., test+<timestamp>@example.com) to avoid collisions across test runs. All test data is local-only. No cleanup step required — local Supabase resets on `supabase db reset`.
Status: LOCKED
Locked on: 2026-05-25
Reason: Unique emails prevent "email already exists" 409 errors on repeated test runs without requiring teardown logic.
────────────────────────────────────────
#: D-T1-16-13
Decision: Validation sequence at end of T1-16 (if any app files were modified by bug fixes) — (1) pnpm --filter web exec tsc --noEmit — zero errors; (2) pnpm --filter web build — passes; (3) pnpm --filter web lint — passes or known non-blocking; (4) git status --short — only intended files staged; apps/web/.env.local must NOT appear in git status (must be gitignored); claude agents/ and .codex/ must be gitignored.
Status: LOCKED
Locked on: 2026-05-25
Reason: If bug fixes modified app files, TypeScript + build must still pass. .env.local must never appear in git state.
