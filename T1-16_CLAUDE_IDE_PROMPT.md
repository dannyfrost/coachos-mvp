# T1-16 — Claude IDE Implementation Prompt
# Core Loop Validation + Environment Setup

**Project:** Coaching Platform MVP  
**Task:** T1-16  
**Working directory:** `E:\Claude-project-Coaching-app-MVP`  
**pnpm binary:** `pnpm` (version pinned in root package.json; use `pnpm` throughout)  
**Supabase CLI:** `npx supabase@2.98.2 --workdir .` (always pass `--workdir .`)  
**Date:** 2026-05-25  
**Locked decisions:** D-T1-16-01 through D-T1-16-13 in DECISIONS.md

---

## Context

T1-01 through T1-15 are complete (tsc + build + lint PASS for all). Every web API integration test has been deferred since T1-01 because `apps/web/.env.local` was missing. This task creates that file, runs the deferred integration tests, performs a web UI smoke test, fixes any bugs found (within scope), and declares Gate 1 PASS or BLOCKED.

Gate 1 must pass before Tier 3 (messaging) begins.

**Do not build any new features. Do not add any new routes, screens, or RPCs. This task is validation only.**

---

## Pre-flight check

Before any other step:

1. Run `git status --short`. Confirm the output shows **only** the following as untracked:
   - `?? "claude agents/"`
   - `?? .codex/`
   
   If any tracked file is modified or staged, STOP and report before proceeding.

2. Run `git log --oneline -3`. Confirm HEAD is `e5a3ded` (control doc hash update after T1-15).

3. Run `npx supabase@2.98.2 --workdir . status`. If local Supabase is not running, run `npx supabase@2.98.2 --workdir . start` and wait for all services to be healthy. Record the output — you will need the `anon key` and `service_role key` values.

---

## Step 0 — Verify Supabase is healthy

After `supabase status` or `supabase start`, confirm:
- API URL: `http://127.0.0.1:54321`
- All services listed as `running` or `healthy`
- Note the exact `anon key` and `service_role key` from the status output

---

## Step 1 — Discover required environment variable names

Before creating `.env.local`, read the following to determine which variables the code actually uses:

1. Read `apps/web/.env.example` (if it exists)
2. Read `.env.example` at the project root (if it exists)
3. Grep for `process.env.` in `apps/web/` recursively — collect all variable names referenced
4. Grep for `process.env.` in `packages/supabase/` recursively — collect all variable names referenced

Cross-reference the discovered names with the approved values below. Do NOT invent variables not found in code or example files.

**Approved local values:**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=local-dev-cron-secret
```

Additional variables (e.g. `NEXT_PUBLIC_APP_NAME`, `SUPABASE_DB_PASSWORD`, `NODE_ENV`) — include **only** if they appear in actual code references. Do not add them speculatively.

---

## Step 2 — Create apps/web/.env.local

Create `apps/web/.env.local` with exactly the variables confirmed in Step 1 (using local values from Step 0).

**This file must never be committed.** Before continuing, verify:
- Run `cat apps/web/.gitignore` — confirm `.env.local` is present
- Run `cat .gitignore` at the root — confirm `.env.local` is also present at root level if applicable

If `.env.local` is not gitignored by either the app-level or root `.gitignore`, add it before proceeding. Do not commit the file.

---

## Step 3 — Update .gitignore for local tooling directories

Add the following entries to the root `.gitignore` if they are not already present:

```
# Local tooling (not part of project)
claude agents/
.codex/
```

Note: the directory name contains a space — `claude agents/`. Verify the gitignore entry handles this correctly (in `.gitignore`, space in directory names does not need special quoting — `claude agents/` works as-is).

After adding, run `git status --short` and confirm `claude agents/` and `.codex/` no longer appear as `??` untracked entries.

---

## Step 4 — Start the web development server

Start the dev server and wait for it to be ready:

```
pnpm --filter web dev
```

Wait for `Ready` or `started server on` in the output. The server must be running at `http://localhost:3000` before any tests execute.

Run the server in the background. Confirm it is accepting connections by fetching `http://localhost:3000` — a non-connection-refused response confirms it is up.

---

## Step 5 — Route contract verification

**Before writing any test assertions, read each route file and record the actual success status code and response shape.** Do not assume any value.

Read the following files:
- `apps/web/app/api/signup/route.ts`
- `apps/web/app/api/login/route.ts`
- `apps/web/app/api/me/route.ts`
- `apps/web/app/api/workspace/route.ts`
- `apps/web/app/api/clients/invite/route.ts`
- `apps/web/app/api/clients/route.ts`
- `apps/web/app/api/client-activation/complete/route.ts`
- `apps/web/app/api/storage/signed-upload-url/route.ts`
- `apps/web/app/api/storage/signed-download-url/route.ts`
- `apps/web/app/api/flash-cards/compute/route.ts`

For each route, record:
- Success HTTP status code (e.g., 200 or 201)
- Success JSON response field names
- Primary error status codes (401, 403, 400, 409, 422, 500)

Use these observed values as expected values in Step 6. If any route file does not exist where expected, STOP and report before continuing.

---

## Step 6 — API integration tests

Run each test using `curl` or PowerShell `Invoke-RestMethod` / `Invoke-WebRequest` against `http://localhost:3000`.

Use a unique timestamp-based email for all signup/invite calls to avoid collisions:

```
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "test+$ts@example.com"
```

Execute the tests **in this exact order** — each test depends on state from the previous ones.

### Test 1 — POST /api/signup (happy path)

```
POST http://localhost:3000/api/signup
Body: { "email": "<unique_test_email>", "password": "TestPass123!", "full_name": "Test Coach" }
```

Expected: status code as confirmed in Step 5. Response contains `id` and `access_token`.  
Store: `$coachAccessToken` and `$coachId` from response.

### Test 2 — POST /api/signup (duplicate email — error path)

```
POST http://localhost:3000/api/signup
Body: { "email": "<same email as Test 1>", "password": "TestPass123!", "full_name": "Test Coach" }
```

Expected: 409 (or the error code confirmed in Step 5 for duplicate).

### Test 3 — POST /api/login (happy path)

```
POST http://localhost:3000/api/login
Body: { "email": "<test email>", "password": "TestPass123!" }
```

Expected: status code as confirmed in Step 5. Response contains `access_token`.  
Store: `$loginAccessToken` from response. Verify it is non-empty.

### Test 4 — POST /api/login (wrong password — error path)

```
POST http://localhost:3000/api/login
Body: { "email": "<test email>", "password": "WrongPassword999" }
```

Expected: 401.

### Test 5 — GET /api/me (happy path)

```
GET http://localhost:3000/api/me
Header: Authorization: Bearer <$coachAccessToken>
```

Expected: 200. Response contains `user.id`, `user.role_type`, `coach` object, `next_action`.  
Verify `next_action` is `"workspace_setup"` (workspace not yet set).

### Test 6 — GET /api/me (no token — error path)

```
GET http://localhost:3000/api/me
(no Authorization header)
```

Expected: 401.

### Test 7 — PATCH /api/workspace (happy path)

```
PATCH http://localhost:3000/api/workspace
Header: Authorization: Bearer <$coachAccessToken>
Body: { "workspace_name": "Test Workspace" }
```

Expected: status code as confirmed in Step 5. Response contains `workspace_name`, `trial_status`.  
Verify `trial_status` is `"trial_active"` (first workspace save activates trial).

### Test 8 — GET /api/me after workspace setup

```
GET http://localhost:3000/api/me
Header: Authorization: Bearer <$coachAccessToken>
```

Expected: 200. Verify `next_action` is now `"dashboard"` (workspace set, trial active).

### Test 9 — POST /api/clients/invite (happy path)

```
POST http://localhost:3000/api/clients/invite
Header: Authorization: Bearer <$coachAccessToken>
Body: { "email": "client+<$ts>@example.com", "full_name": "Test Client" }
```

Expected: status code as confirmed in Step 5. Response contains `activation_token`.  
Store: `$activationToken` and `$clientEmail` and `$clientPassword = "ClientPass123!"` from response.

### Test 10 — POST /api/clients/invite (duplicate email — error path)

```
POST http://localhost:3000/api/clients/invite
Header: Authorization: Bearer <$coachAccessToken>
Body: { "email": "client+<$ts>@example.com", "full_name": "Test Client 2" }
```

Expected: 409 (client already invited with that email).

### Test 11 — GET /api/clients (happy path)

```
GET http://localhost:3000/api/clients
Header: Authorization: Bearer <$coachAccessToken>
```

Expected: 200. Response is an array. Verify it contains the client created in Test 9.  
Store: `$clientId` from the matching client entry.

### Test 12 — POST /api/client-activation/complete (happy path)

```
POST http://localhost:3000/api/client-activation/complete
Body: { "token": "<$activationToken>", "password": "ClientPass123!" }
```

Expected: status code as confirmed in Step 5. Response contains `access_token`.  
Store: `$clientAccessToken` from response.

### Test 13 — POST /api/client-activation/complete (invalid token — error path)

```
POST http://localhost:3000/api/client-activation/complete
Body: { "token": "invalidtoken0000", "password": "ClientPass123!" }
```

Expected: 401.

### Test 14 — POST /api/storage/signed-upload-url (happy path — as client)

```
POST http://localhost:3000/api/storage/signed-upload-url
Header: Authorization: Bearer <$clientAccessToken>
Body: { "path": "<$coachId>/<$clientId>/test-photo-<$ts>.jpg", "content_type": "image/jpeg", "size": 51200 }
```

Expected: status code as confirmed in Step 5. Response contains `signed_url` or `signedUrl` (check Step 5).

### Test 15 — POST /api/storage/signed-upload-url (coach attempting client path — error path)

```
POST http://localhost:3000/api/storage/signed-upload-url
Header: Authorization: Bearer <$coachAccessToken>
Body: { "path": "<$coachId>/<$clientId>/test-photo-<$ts>.jpg", "content_type": "image/jpeg", "size": 51200 }
```

Expected: 403 (coach is not the path owner; route is client-only).

### Test 16 — POST /api/storage/signed-download-url (happy path — as coach)

```
POST http://localhost:3000/api/storage/signed-download-url
Header: Authorization: Bearer <$coachAccessToken>
Body: { "path": "<$coachId>/<$clientId>/test-photo-<$ts>.jpg" }
```

Expected: status code as confirmed in Step 5. Response contains `signed_url` (or field name confirmed in Step 5).

### Test 17 — POST /api/storage/signed-download-url (no token — error path)

```
POST http://localhost:3000/api/storage/signed-download-url
(no Authorization header)
Body: { "path": "<$coachId>/<$clientId>/test-photo-<$ts>.jpg" }
```

Expected: 401.

### Test 18 — POST /api/flash-cards/compute (happy path)

```
POST http://localhost:3000/api/flash-cards/compute
Header: Authorization: Bearer local-dev-cron-secret
(or check route file in Step 5 — confirm the exact header name: likely "x-cron-secret" or "Authorization" or custom)
```

**First read the route file (Step 5) to confirm the exact auth header name and format for CRON_SECRET.**

Expected: status code as confirmed in Step 5. Response contains `processed` and `errors`.  
Verify `processed >= 0` and `errors === 0`.

### Test 19 — POST /api/flash-cards/compute (wrong secret — error path)

```
POST http://localhost:3000/api/flash-cards/compute
Header: (wrong secret value)
```

Expected: 401 or 403.

---

### Integration test report

After all tests, produce a table:

| Test # | Route | Path | Expected | Actual | Pass/Fail |
|--------|-------|------|----------|--------|-----------|
| 1 | POST /api/signup | happy path | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |

If any test fails, document the exact response (status code + body) and proceed to Step 8 (bug investigation).

---

## Step 7 — Web UI smoke test

With the dev server still running and local Supabase still running:

1. **Fetch /login** — `Invoke-WebRequest http://localhost:3000/login` — confirm 200 response, HTML contains `<form` or `login` text.

2. **Fetch /dashboard without auth** — `Invoke-WebRequest http://localhost:3000/dashboard` — confirm middleware redirects to /login (expect 200 after redirect with login page HTML, or 307/302 status before redirect).

3. **Fetch /clients without auth** — `Invoke-WebRequest http://localhost:3000/clients` — confirm redirect to /login.

4. **Fetch /clients/[id] without auth** — `Invoke-WebRequest "http://localhost:3000/clients/$clientId"` — confirm redirect to /login.

Automated browser-based test (server-side page render with auth cookie) is **not required** for Gate 1 — the auth flow was manually verified above via API tests. The critical check is that authenticated routes redirect unauthenticated requests to /login.

---

## Step 8 — Bug investigation and fix (if any test failed)

For each failing test:

1. Read the route file to confirm the actual implementation.
2. Determine if the failure is:
   - **App bug** (wrong status code, missing field, auth regression, wrong query): fix it in the route file. Allowed.
   - **Schema/RLS/migration issue** (wrong table structure, missing RLS policy, RPC error): STOP. Report the exact error, the route, the query, and the failure message. Do not modify any migration or RLS file. Wait for founder response.

For app bug fixes:
- Make the minimal change required to fix the failing test
- Re-run the affected test to confirm it now passes
- Do not refactor surrounding code

---

## Step 9 — Post-fix validation (if any files were modified)

If any route or component files were modified during Step 8:

1. `pnpm --filter web exec tsc --noEmit` — must pass, zero errors
2. `pnpm --filter web build` — must pass
3. `pnpm --filter web lint` — must pass or known non-blocking only

---

## Step 10 — Gate 1 declaration

Update `PROJECT_STATE.md`:

1. Change `Current Task` to `T1-16 — COMPLETE (Gate 1 [PASS or BLOCKED])` 
2. Add `T1-16` row to the Completed Tasks table with today's date and a brief result summary
3. Update the `In Progress` section to `None`
4. Update the `Next Up` section to one of:
   - If Gate 1 PASS: `Tier 3 planning — Founder approval required before implementation begins`
   - If Gate 1 BLOCKED: `Gate 1 BLOCKED — resolve blocker before any new tier`
5. If Gate 1 BLOCKED, add a row to the `Blocked` table describing the exact blocking issue

Add a new Gate 1 verification section at the bottom of the Verification Log:

```
### T1-16 — Core Loop Validation + Environment Setup

**Date:** 2026-05-25 (or actual date)
**Task:** Create apps/web/.env.local; run integration tests for T1-01 through T1-10 routes; web UI smoke test; bug fixes; Gate 1 declaration
**Status:** [PASS / BLOCKED]

**Environment:**
- Local Supabase: [running / not running]
- apps/web/.env.local: [created / gitignored]
- .gitignore updated: [yes / no]

**Integration test results:** [table from Step 6]

**Bug fixes applied (if any):** [list or None]

**UI smoke test results:** [table from Step 7]

**TypeScript:** [PASS / FAIL — N errors]
**Build:** [PASS / FAIL]
**Lint:** [PASS / non-blocking / FAIL]

**Gate 1 status:** [PASS / BLOCKED — <reason>]
```

---

## Step 11 — Update TASK_LOG.md

Add T1-16 entry following the same format as prior tasks. Include task ID, description, date, and verification result summary.

---

## Step 12 — Update docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Update this file to reflect T1-16 completion, Gate 1 status, and what comes next (Tier 3 planning if Gate 1 passed).

---

## Step 13 — Commit

Commit **only** the following:

```
git add .gitignore PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

If any route/component files were modified during bug fixes, add them too.

**Do NOT stage:**
- `apps/web/.env.local` (must never be committed)
- `claude agents/` (local tooling — now gitignored)
- `.codex/` (local tooling — now gitignored)

Verify with `git diff --cached --name-only` before committing that `.env.local` is absent.

Commit message:

```
feat: T1-16 — core loop validation; Gate 1 [PASS/BLOCKED]

- create apps/web/.env.local (local only, not committed)
- run API integration tests for T1-01 through T1-10 routes
- web UI smoke test: /login /dashboard /clients /clients/[id]
- [if applicable] fix: <summary of any bug fixes>
- update .gitignore: add claude agents/ and .codex/
- Gate 1 [PASS / BLOCKED: <reason>]
```

---

## Step 14 — Final report

After committing, produce a final report table:

| Check | Expected | Actual | Pass/Fail |
|-------|----------|--------|-----------|
| Local Supabase running | yes | ... | ... |
| apps/web/.env.local created | yes | ... | ... |
| apps/web/.env.local gitignored | yes | ... | ... |
| .gitignore updated (tooling dirs) | yes | ... | ... |
| API integration tests | all pass | N/N pass | ... |
| Web UI smoke test | /login /dashboard /clients /clients/[id] load | ... | ... |
| TypeScript | zero errors | ... | ... |
| Build | PASS | ... | ... |
| Lint | PASS/non-blocking | ... | ... |
| .env.local absent from git status | yes | ... | ... |
| claude agents/ gitignored | yes | ... | ... |
| Gate 1 status | PASS or BLOCKED | ... | ... |
| Commit hash | — | ... | — |

Include: any deviations from this prompt, reasons, and whether founder approval is needed.

---

## Constraints summary

- Do not modify: `supabase/migrations/001–013`, `supabase/tests/G0-01 through G0-16`, `packages/supabase/database.types.ts`, any RLS policies or schema objects
- Do not commit: `apps/web/.env.local`
- Do not build any new features, routes, RPCs, migrations, or UI screens
- Do not stage or commit `claude agents/` or `.codex/` directories
- If any schema/RLS/migration issue is found during tests: STOP and report to founder before changing anything
- Mobile Metro/Expo Go runtime validation remains deferred (no device) — do not attempt it; preserve its deferred status in PROJECT_STATE.md
