# T1-20 Session Handoff — First Hosted Supabase + Vercel Deployment Validation

> **CLOSED — T1-20 COMPLETE, PASS (2026-07-07).** `PROJECT_STATE.md` is the authoritative status source; see its T1-20 Verification Log entry for the full evidence. This file is kept as the T1-20 session record.

## 1. Repo State

- **Repo:** E:\Claude-project-Coaching-app-MVP
- **Branch:** main
- **Working tree:** clean throughout T1-20 (documentation-only closing changes at the end)

## 2. T1-20 Final Status

- T1-17 closed and pushed (`dc50b4c`)
- T1-18 closed and pushed (`5303292`)
- T1-19 closed and pushed (`1d4d454`)
- **T1-20 — COMPLETE, PASS (2026-07-07):**
  - Preflight inspection — COMPLETE
  - Hosted Supabase staging link + dry-run — COMPLETE
  - Real Supabase staging migration push — COMPLETE (13 migrations)
  - Post-push validation — COMPLETE, all checks passed
  - Vercel production deployment — COMPLETE, Ready; stable URL `https://claude-project-coaching-app-mvp-web.vercel.app`
  - Unauthenticated production checks — PASS (`/login` 200; `/api/me` and `/api/clients` 401; `/dashboard` 307 → login, no loop; malformed signup 400)
  - Disposable staging coach created via `POST /api/signup` — HTTP 201, response contained only `id` + `email`
  - Authenticated validation — PASS (browser login → `/dashboard` redirect; dashboard empty state; `/clients` empty list; no 500s)
  - Staging account rows verified read-only (Management API): `auth.users` (id `d020e2fa-7acc-4915-a221-ce23e865c7fa`, email confirmed) + `platform_users` (`role_type=coach`, `status=active`) + `coaches` (`workspace_name=Staging Workspace`, `trial_status=trial_not_started`); exactly one auth user in project
  - Vercel runtime logs — zero 5xx in captured window; empty function-log arrays; code inspection confirms no path logs passwords/tokens/keys
  - Staging coach retained (not deleted) as validation evidence

### Environment-configuration problems found and resolved during Vercel setup (no values recorded)

1. `SUPABASE_SERVICE_ROLE_KEY` missing from Vercel environment — added
2. Invalid server secret key value — replaced
3. Invalid `NEXT_PUBLIC_SUPABASE_ANON_KEY` value — replaced (build-time variable; required redeploy)

### Known limitations / findings

1. Cross-tenant live validation NOT exercised (single tenant in staging); Gate-0 RLS/pgTAP suite (16 files, 84 tests, 0 failures) remains the isolation evidence
2. **OPEN SECURITY FINDING → T1-21 — Gate or Disable Public Coach Signup:** `POST /api/signup` is unauthenticated, publicly reachable, and creates full coach accounts via the service role; must be addressed or explicitly deferred by the founder before further pilot/public rollout. **Tier 2+ must not start until T1-21 is approved or deferred.**
3. Plain UI styling — outside T1-20 scope

## 3. Hosted Supabase Staging Project Status

- **Project name:** coaching-platform-mvp-staging
- **Project ref:** `zvpzbppfmvtybampxcsi`
- **Supabase CLI:** logged in successfully; local repo linked to this staging project
- Local `db push --dry-run` succeeded before the real push (13 migrations previewed, remote list was empty beforehand)

## 4. Migration Push Result and Validation Summary

**Migration push:** All 13 local migrations (`001_create_enums.sql` through `013_seed_data.sql`) applied successfully to the hosted staging project, in order, no errors. Only a cosmetic pre-existing warning appeared (`[inbucket]` config section deprecated) — not blocking, unrelated to the push itself.

**Post-push validation — all passed:**

| Check | Expected | Actual | Pass |
|---|---|---|---|
| Public schema table count | 16 | 16 | ✓ |
| `roles` row count | 6 | 6 | ✓ |
| `role_permissions` row count | 46 | 46 | ✓ |
| `tenant-media` bucket exists | private, 5MB limit | confirmed private, 5,242,880 bytes limit | ✓ |
| RLS enabled table count | 16 | 16 | ✓ |
| SECURITY DEFINER RPC count | 23 | 23 | ✓ |

Git status stayed clean throughout — no files were modified by the link, dry-run, push, or validation queries.

## 5. Vercel Project Setup Plan (EXECUTED — deployment Ready at `https://claude-project-coaching-app-mvp-web.vercel.app`)

- **Import GitHub repo:** `RedaBenDZ/Claude-project-Coaching-app-MVP`
- **Suggested Vercel project name:** `coaching-platform-mvp-web`
- **Framework:** Next.js
- **Root Directory:** `apps/web`
- **Install Command:** `pnpm install`
- **Build Command:** `pnpm --filter web build`
- **Output Directory:** default / empty

## 6. Required Vercel Environment Variable Names (names only — no values recorded except the one safe public URL below)

- `NEXT_PUBLIC_SUPABASE_URL` — safe to record: `https://zvpzbppfmvtybampxcsi.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — secret, not recorded here
- `SUPABASE_SERVICE_ROLE_KEY` — secret, not recorded here
- `NEXT_PUBLIC_APP_NAME` — not secret, value not recorded here (cosmetic)
- `NEXT_PUBLIC_APP_URL` — not secret; actual value depends on the Vercel-assigned URL, which only exists after first deploy — see note in prior session report: this variable is `NEXT_PUBLIC_*` and baked in at build time, so setting/changing it requires a full redeploy, not just a restart
- `EMAIL_FROM` — not secret, value not recorded here
- `RESEND_API_KEY` — secret, not recorded here
- `CRON_SECRET` — secret, not recorded here

No Supabase secret key, publishable/anon key, Resend API key, `CRON_SECRET`, database password, or access token values are recorded in this file or anywhere in this repo.

## 7. Resume Point

**T1-20 is CLOSED (PASS, 2026-07-07). Nothing to resume.** Next task: **T1-21 — Gate or Disable Public Coach Signup** (see `PROJECT_STATE.md` → Next Up). Do not rerun Supabase migrations. Do not start Tier 2+ until T1-21 is explicitly approved or deferred by the founder.

## 8. Hard Constraints (carry forward)

- Do not reset any database
- Do not rerun migrations unless explicitly approved
- Do not modify schema / RLS / migrations / `database.types.ts`
- Do not modify package files
- Do not modify mobile app / EAS config
- Do not commit secrets
- Do not deploy from CLI unless explicitly approved
- Do not start Tier 2 or Tier 3

---
---

# T1-21 Public Coach Signup Inspection — Session Handoff

> **Added 2026-07-07 (inspection), updated same day at T1-21 closure. T1-20 history above is preserved unchanged.** **T1-21 is CLOSED — PASS.** Public uncontrolled coach creation is blocked in production; `POST /api/signup` works only with the valid server-side invitation code.

## 1. Goal

T1-21 — Gate or Disable Public Coach Signup. Private-pilot security objective — all met at closure: prevent uncontrolled public coach creation while preserving (a) existing coach login, (b) the already-validated client invite + activation flow (T1-17), and (c) the existing staging coach.

## 2. Current state (at T1-21 closure, 2026-07-07)

- Repo: `E:\Claude-project-Coaching-app-MVP`; branch `main`; commits `4efc381` (implementation) + `01bed7c` (docs/local validation) pushed to `origin/main`; closeout docs commit follows this update.
- T1-20: fully closed. **T1-21: CLOSED — PASS** (implemented, locally validated, pushed, deployed from `01bed7c`, hosted negative-path validated).
- Production: deployment `01bed7c` Ready; `SIGNUP_INVITE_CODE` configured server-side in Vercel Production by the founder; value never recorded in repo, docs, or chat.
- **Hosted positive-path (valid-code) signup: intentionally skipped by founder decision** — to be validated during the next founder-approved real pilot-coach onboarding.
- Tier 2 / Tier 3: not started. **The next project task is not selected and requires explicit founder selection and approval.**

## 3. Active files (T1-21-relevant only)

- `apps/web/app/api/signup/route.ts` — the vulnerable route; only coach-registration path in the repo; the file T1-21 will change.
- `packages/supabase/server.ts` — `createServiceRoleClient()`; the privileged client the route uses.
- `packages/supabase/auth-server.ts` — `createAnonServerClient()` / `createUserClient()`; RLS-scoped clients used by guards (unchanged by T1-21).
- `packages/supabase/browser.ts` — browser client with public anon key; relevant to the native `auth.signUp` bypass question.
- `apps/web/app/login/page.tsx` — no signup link exists; login must remain unaffected.
- `apps/web/app/page.tsx` — placeholder landing; no signup entry point.
- `apps/web/middleware.ts` — matcher covers only `/dashboard*` and `/login`; API routes unprotected by middleware.
- `apps/web/app/api/flash-cards/compute/route.ts` — in-repo precedent for a server-side env-secret gate (`CRON_SECRET`, fail-closed).
- `.env.example` — env-variable names; will gain `SIGNUP_INVITE_CODE` placeholder if Option B is approved.
- `DECISIONS.md` — T1-02 (`:136`, auth method), signup rollback strategy (`:156`), email-confirmation note (`:168`).
- `supabase/config.toml` (`:171` `enable_signup = true`) — **local-dev** auth config only; hosted setting not represented in repo.
- Tests: **none exist** for signup (no `*.test.*`/`*.spec.*` anywhere in apps/packages; T1-16 integration tests were manual).
- Continuity: `PROJECT_STATE.md`, `TASK_LOG.md`, this file.

## 4. Changes made (full T1-21 arc)

- Inspection step: handoff-file update only.
- Implementation (commit `4efc381`): `apps/web/app/api/signup/route.ts` — invitation gate before any Supabase Auth/DB operation (server-only `SIGNUP_INVITE_CODE`; missing/wrong/empty code or unset env → generic 403, fail closed; code never logged or echoed) + approved error hardening (generic 422 `{"error":"Signup failed"}`; orphan rollback UUIDs removed from 500 responses — server logs only). `.env.example` — variable name + placeholder.
- Documentation (commits `01bed7c` and the closeout commit after this update): `PROJECT_STATE.md`, `TASK_LOG.md`, this file.
- Founder (outside repo): set `SIGNUP_INVITE_CODE` in Vercel Production; redeployed; production runs `01bed7c`.
- No schema, migration, RLS, `database.types.ts`, dependency, mobile, EAS, or middleware changes. One local disposable coach was created in the **local** Docker DB during the successful-path test; **no hosted coach was created**; staging coach untouched.

## 5. Failed attempts

- Inspection: none. One item remains **Not verified**: the hosted Supabase project's Auth dashboard setting for public email signups (not represented in code; low impact — native signups cannot become coaches because `platform_users`/`coaches` have no INSERT policies). Worth a read-only dashboard check someday.
- Local validation: first successful-path test returned 422 (`fetch failed`) because `NEXT_PUBLIC_*` values are baked at build time and the standing build carried a stale unreachable LAN Supabase URL from T1-17-era `.env.local`; resolved by rebuilding locally with a process-level URL override (no file changes; `.next` is gitignored). Does not affect any conclusion.
- Pushes: two transient GitHub connection timeouts on this date (`Failed to connect to github.com port 443`); both resolved on simple retry — local network flap, no project impact.

## 6. Findings and evidence (confirmed unless marked otherwise)

- **Exposure (confirmed, High):** `POST /api/signup` (`apps/web/app/api/signup/route.ts`, handler `POST`, lines 40–99) accepts **unauthenticated** requests — no token read, no session check, no invite/allowlist/code, no rate limit, no CAPTCHA, no origin check. T1-20 confirmed it live in production.
- **Privileged path:** uses `createServiceRoleClient()` (`packages/supabase/server.ts:5-9`, `SUPABASE_SERVICE_ROLE_KEY`); calls `auth.admin.createUser({ email, password, email_confirm: true })` (lines 56–60) — creates a **pre-confirmed** auth user; then inserts `platform_users` (`role_type='coach'`, `status='active'`, lines 71–73) and `coaches` (`workspace_name`, lines 85–87). `trial_status` defaults to `trial_not_started`. Result: one POST = full active coach tenant.
- **Validation present:** format-only (`validateBody`, lines 11–38): email regex, password ≥ 8, name/workspace length+charset. No identity/approval control of any kind.
- **Direct API vs UI:** there is **no signup UI anywhere** (no page, form, link, or redirect; login page has none). The API is the entire surface — hiding/removing UI is a no-op for this risk.
- **Alternate paths:** none. All 10 API routes enumerated; the only other `auth.admin.createUser` is the coach-authenticated client-invite route (`apps/web/app/api/clients/invite/route.ts`). Mobile and packages contain zero signup references. No code calls native `auth.signUp`.
- **Native `auth.signUp` bypass (theoretical, Low):** browser anon key + supabase-js could create bare `auth.users` rows **if** the hosted project allows public email signups (**Not verified** — dashboard check pending). Even then: `platform_users` and `coaches` have **zero INSERT policies** (migration 008) and the `enforce_coach_role` trigger blocks coach rows, so the result is auth-table pollution only, never a working coach account.
- **Rollback (confirmed):** compensating, not atomic (`DECISIONS.md:156`): on insert failure, `auth.admin.deleteUser` (route lines 76, 90); if that also fails, an orphan auth user remains, its UUID is logged and also returned in the 500 body (line 79) — minor leak. Duplicate email → 422 passing `authError.message` through (lines 62–67) — account-existence disclosure, minor.
- **Env names referenced by the flow:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (route); `NEXT_PUBLIC_SUPABASE_ANON_KEY` (guards/browser). Service-role key is server-side only — never in `NEXT_PUBLIC_*` or the browser bundle (confirmed).
- **Protections enforced in code today:** input format validation; compensating rollback; server-only service key; no tokens in responses. **Missing (T1-21-relevant):** any authentication/authorization, invite code/allowlist/approval, rate limiting, generic error responses.
- **Useful precedent:** `CRON_SECRET` gate in `apps/web/app/api/flash-cards/compute/route.ts:12-20` — server-side env shared secret, fail-closed when unset; Option B can copy this pattern.

## 7. Decisions and approvals

### Confirmed project decisions

- Private-pilot phase; uncontrolled public coach creation unacceptable (T1-20 finding, recorded in `PROJECT_STATE.md`).
- Implementation must be minimal: no dependency, schema, migration, RLS, `database.types.ts`, mobile, or EAS changes unless unavoidable.
- Existing coach login, client invite + activation (already implemented and validated in Tier 1/T1-17 — NOT future work), and the staging coach must remain intact.
- T1-21 must be implemented and validated, or explicitly deferred by the founder, before later Tier 2 work.

### Founder decisions taken (all explicitly approved, 2026-07-07)

- **Option B approved and implemented** — server-validated invitation code (`SIGNUP_INVITE_CODE`, server-only env var), chosen over A (disable — no provisioning path existed), C (email allowlist — heavier ops), D (admin provisioning — no admin auth pattern exists; oversized for pilot).
- Error hardening approved and implemented: generic 422; orphan UUIDs out of responses (server logs only).
- No signup UI added. Pilot coaches receive the code **privately from the founder**; rotation policy: rotate immediately on suspected disclosure (cohort-based policy deferred).
- Hosted negative-path validation approved and executed (PASS). **Hosted positive-path test intentionally skipped** — will be validated at the next founder-approved real pilot-coach onboarding instead of creating unnecessary production data.
- T1-21 closure approved after documentation + commit + push.

## 8. Risks and blockers (post-closure)

- **Resolved:** the T1-20 High-risk finding — hosted `POST /api/signup` now returns generic 403 for missing/wrong/empty codes, verified live; zero rows created by rejected attempts.
- Residual, accepted: shared invitation code can leak → rotate immediately on suspicion (founder holds the value); hosted positive path unverified until next pilot onboarding (local positive path PASS; gate order proven hosted).
- Still worth a later read-only check: hosted Supabase dashboard setting for native public email signups (**Not verified**; low impact — native signups cannot become coaches).
- No sequencing blocker remains from T1-21. **Next task not selected — requires explicit founder selection and approval.** Tier 2 core loop is already built and validated (Tier 1/T1-17); Tier 3+ untouched.

## 9. Next steps

1. Founder selects and approves the next project task (nothing pre-selected). Candidates noted in `PROJECT_STATE.md` → Next Up: hosted positive-path signup validation during next real pilot-coach onboarding (deferred from T1-21); Tier 3 planning; EAS/mobile build planning; web/mobile automated tests.
2. When onboarding the first real pilot coach: use the invitation code privately, confirm hosted 201 + login + dashboard — that completes the deferred positive-path validation.
3. Optional read-only check when convenient: hosted Supabase Auth dashboard — disable native public email signups (no code relies on them).
