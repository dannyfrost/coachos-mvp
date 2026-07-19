Implement T1-03 - Coach Session/Profile State API Route.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing T1-03 for the Coaching Platform MVP. This task creates GET /api/me - the coach session/profile state endpoint.

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Completed before this task:
- T1-00: Next.js 14 App Router scaffold, Turborepo, Supabase client utilities
- T1-01: POST /api/signup coach signup route (commit b5a12fa)
- T1-02: POST /api/login coach login route (commit 329bcb6)
- Migrations 001-013: immutable, applied, Gate 0 pgTAP 84 tests passing
- packages/supabase/auth-server.ts exists — createAnonServerClient() available

Do NOT touch any of the following:
- supabase/migrations/001-013 (immutable)
- supabase/tests/G0-01 through G0-16 (immutable)
- packages/supabase/database.types.ts
- apps/web/app/api/signup/route.ts
- apps/web/app/api/login/route.ts
- Any file not explicitly listed in the steps below

Do NOT implement any of the following in this task:
- Cookies, session storage, or browser auth state
- Workspace setup UI or onboarding flow
- Stripe integration or billing UI
- Logout, token refresh, or password reset routes
- Client invite, mobile work, or any Tier 2+ feature

Do NOT commit. Do NOT push.

Read all files below before writing any code:
- DECISIONS.md - sections D-T1-03-01 through D-T1-03-08
- packages/supabase/auth-server.ts - confirm createAnonServerClient() exists
- packages/supabase/database.types.ts - confirm platform_users and coaches columns

---

STEP 0: PRE-FLIGHT

Run each command and report its full output before proceeding.

0a. Git status - must be clean:
git --no-pager status --short
Expected: empty output. If any output appears, stop and report.

0b. Latest commit - confirm current HEAD at implementation time:
git --no-pager log --oneline -5
Confirm the log shows the T1-02 completion commit or later and the working tree is clean. There is no pinned hash — verify the tree is clean and matches the expected state before proceeding.

0c. Confirm these files exist (report PRESENT or MISSING for each - do not print content):
  apps/web/app/api/signup/route.ts
  apps/web/app/api/login/route.ts
  packages/supabase/auth-server.ts

0d. Check for .env.local and required env vars:
Check if apps/web/.env.local exists and contains all three of: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
If apps/web/.env.local is missing, report: "apps/web/.env.local missing - Step 5 integration test will be skipped."
If apps/web/.env.local is missing but repo-root .env.local exists, report: "repo-root .env.local found, but apps/web/.env.local is required for reliable Next.js app env loading - Step 5 integration test will be skipped."
If apps/web/.env.local exists but any of the three required vars are absent, report which vars are missing and skip Step 5.
Do not stop on this.

If Steps 0a or 0b fail, stop and report. Do not proceed.

---

STEP 1: IMPLEMENT

Create the directory apps/web/app/api/me/ as needed.

Create apps/web/app/api/me/route.ts implementing the following requirements. Write a single file only. No additional helper files.

Requirements (derived from D-T1-03-01 through D-T1-03-08):

1. Import NextRequest and NextResponse from 'next/server'.
2. Import createAnonServerClient from '@coaching/supabase/auth-server'.
3. Import createClient from '@supabase/supabase-js'.
4. Extract Bearer token from Authorization header. If header is missing or does not start with "Bearer ", return 401 { error: "Unauthorized" }.
5. Call createAnonServerClient().auth.getUser(token). If error or no user returned, return 401 { error: "Unauthorized" }.
6. Create a second Supabase client using NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY with the user's access token set as the Authorization header (D-T1-03-04 pattern). Use this client for all DB queries.
   Pattern:
   createClient(url, anonKey, {
     global: { headers: { Authorization: `Bearer ${accessToken}` } }
   })
7. Query platform_users where id = auth user id. Select: id, email, full_name, role_type, status, email_verified. If no row found, return 401 { error: "Unauthorized" }.
8. If role_type !== 'coach', return 403 { error: "Forbidden" }.
9. If status !== 'active', return 403 { error: "Forbidden" }.
10. Query coaches where user_id = auth user id. Select: workspace_name, trial_status, trial_started_at, trial_expires_at. If no row found, return 500 { error: "Internal server error" } (D-T1-03-08 — data integrity failure).
11. Compute next_action (D-T1-03-07) in this exact order:
    - If workspace_name is null or empty string -> "workspace_setup"
    - Else if trial_status === "trial_expired" -> "billing"
    - Else -> "dashboard"
12. Return 200 with:
    {
      user: { id, email, full_name, role_type, status, email_verified },
      coach: { workspace_name, trial_status, trial_started_at, trial_expires_at },
      next_action
    }
13. Export only the GET function. Wrap the entire handler body in try/catch. Unexpected errors return 500 { error: "Internal server error" }.

---

STEP 2: TYPECHECK

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web exec tsc --noEmit

Expected: exit 0, no type errors.
If errors appear in apps/web/app/api/me/route.ts, fix them in that file only and re-run.
Do not modify any other file. If errors appear elsewhere and you did not create them, report them as pre-existing.

---

STEP 3: BUILD

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web build

Expected: "Compiled successfully". /api/signup, /api/login, and /api/me must all appear in the output.
If build fails, report the full output. Do not attempt to fix without reporting first.

---

STEP 4: LINT

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web lint

Expected: no errors. Warnings are fine - they do not block.
If lint errors appear, fix only apps/web/app/api/me/route.ts and re-run.

---

STEP 5: INTEGRATION TEST

Skip this entire step if Step 0d reported apps/web/.env.local missing, repo-root fallback only, or any required var absent. Write "INTEGRATION TEST SKIPPED - apps/web/.env.local not present or incomplete."

If apps/web/.env.local is present with all three required vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):

5a. Start the dev server in the background and wait 8 seconds:
$devServer = Start-Process -NoNewWindow -PassThru -FilePath "C:\Users\reda-\AppData\Roaming\npm\pnpm" -ArgumentList "--filter", "web", "dev"
Start-Sleep -Seconds 8

5b-pre. Pre-cleanup test user (LOCAL DEV ONLY - NEVER run against production):
Delete any leftover test user before signup to guarantee a clean state.
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email = 't103-test@example.com';"
Report: "Pre-cleanup complete." If this command errors, report the error but do not stop - proceed to 5b.

5b. Create a test coach via the signup route:
try {
  $signup = Invoke-WebRequest -Uri "http://localhost:3000/api/signup" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t103-test@example.com","password":"password123","full_name":"Test Coach","workspace_name":"T103 Workspace"}'
  "Signup Status: $($signup.StatusCode) | Body: $($signup.Content)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Signup Status: $code | Body: $rbody"
}
Expected: 201 (new user created) or 422 (user existed despite pre-cleanup). Both are acceptable - proceed to 5c either way.

5c. Login to get access token:
try {
  $login = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t103-test@example.com","password":"password123"}'
  $loginBody = $login.Content | ConvertFrom-Json
  $token = $loginBody.access_token
  "Login Status: $($login.StatusCode) | Token acquired: $(-not [string]::IsNullOrEmpty($token))"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Login Status: $code | Body: $rbody"
  $token = $null
}
If $token is null after this block, stop Step 5 and report login failure. Do not proceed to 5d.

5d. Define a helper that captures both status code and body for all responses including 4xx/5xx:
function Invoke-MeRequest([string]$BearerToken) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/me" -Method GET `
         -Headers @{ Authorization = "Bearer $BearerToken" }
    "Status: $($r.StatusCode) | Body: $($r.Content)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $rbody = $reader.ReadToEnd()
    $reader.Close()
    "Status: $code | Body: $rbody"
  }
}

5e. Test 1 - valid token, expect 200:
Invoke-MeRequest $token
Expected: Status 200 - body contains user.id (UUID), user.email, user.role_type="coach", user.status="active", coach.workspace_name="T103 Workspace", next_action="dashboard".

5f. Test 2 - missing Authorization header, expect 401:
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/me" -Method GET
  "Status: $($r.StatusCode) | Body: $($r.Content)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Status: $code | Body: $rbody"
}
Expected: Status 401 - body contains { error: "Unauthorized" }.

5g. Test 3 - invalid token, expect 401:
Invoke-MeRequest "invalidtoken"
Expected: Status 401 - body contains { error: "Unauthorized" }.

5h. Clean up test data - remove the auth user created in step 5b (local dev only, targets specific test email):
Never run this cleanup against production. It is local-dev only and targets only t103-test@example.com.
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email = 't103-test@example.com';"
Confirm deletion:
npx supabase@2.98.2 db query --local "SELECT id FROM auth.users WHERE email = 't103-test@example.com';"
Expected: (0 rows). If any row is returned, report it as a cleanup failure in the final report.

5i. Stop the dev server - kill only the captured process from 5a, not all Node processes:
if ($null -ne $devServer -and -not $devServer.HasExited) {
  $devServer.Kill()
  $devServer.WaitForExit(5000)
}

Report all three test results.

---

STEP 6: UPDATE CONTROL DOCS

Update only the three files listed below. Do not create new documentation files.

6a. PROJECT_STATE.md

In "## Current Task", replace:
  **T1-03** — NEXT (T1-02 complete 2026-05-20; pending founder approval)
With:
  **T1-04** — NEXT (T1-03 complete 2026-05-20; pending founder approval)

In "## In Progress", replace:
  _None. T1-02 complete 2026-05-20. Awaiting founder approval for T1-03._
With:
  _None. T1-03 complete 2026-05-20. Awaiting founder approval for T1-04._

In "## Completed Tasks", add this row after the T1-02 row:
  | T1-03 | Coach session/profile state route (GET /api/me) | 2026-05-20 | typecheck + build + lint PASS; anon+JWT client; RLS-evaluated reads; next_action logic |

6b. TASK_LOG.md

Append a new log entry at the bottom:

---

### 2026-05-20 - T1-03 Complete

| Field | Value |
| ----- | ----- |
| **Task ID** | T1-03 |
| **Description** | Coach session/profile state route - GET /api/me - anon client auth validation; user-JWT DB client for RLS reads; platform_users + coaches query; next_action routing logic |
| **Agent** | Claude Code (IDE) |
| **Status** | COMPLETE |

**What ran:**

1. Pre-flight: confirmed git status clean; latest commit at implementation start: <actual HEAD from git --no-pager log --oneline -1>.
2. Created apps/web/app/api/me/route.ts - GET handler; Bearer token extraction; auth.getUser() validation; JWT-scoped DB client; platform_users + coaches queries; 401/403/500 guards; next_action logic.
3. Typecheck: PASS (exit 0, no errors).
4. Build: PASS (Compiled successfully).
5. Lint: PASS (no errors).
6. Integration test: [PASS - 200 / 401 / 401 as expected] OR [SKIPPED - apps/web/.env.local missing].
7. Updated PROJECT_STATE.md: T1-03 row added; current task set to T1-04.
8. Updated TASK_LOG.md (this entry).
9. Updated docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.

**Artifacts produced:**

- apps/web/app/api/me/route.ts - new; GET /api/me handler

**Blockers:** None.

**Resume from:** T1-04 - pending founder definition and approval.

6c. docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Find the line beginning with "> **State as of" and replace the entire line with:

> **State as of 2026-05-20:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 COMPLETE - Next.js 14 App Router scaffold, Turborepo, Supabase client utilities. T1-01 COMPLETE - POST /api/signup route; service role; compensating rollback via deleteUser. T1-02 COMPLETE - POST /api/login route; anon client; signInWithPassword; 401 on all auth failures; tokens in body. T1-03 COMPLETE - GET /api/me route; anon+JWT client; RLS-evaluated reads; next_action logic. Next: T1-04 - pending founder definition.

Find the resume instruction block beginning with "Gate 0 is COMPLETE. T1-00 is COMPLETE. T1-01 is COMPLETE. T1-02 is COMPLETE" and replace it with:

Gate 0 is COMPLETE. T1-00 is COMPLETE. T1-01 is COMPLETE. T1-02 is COMPLETE. T1-03 is COMPLETE (GET /api/me). Confirm before T1-04:

1. Latest commit is the T1-03 commit or later (git --no-pager log --oneline -5).
2. apps/web/app/api/me/route.ts exists.
3. Local Supabase is running (npx supabase@2.98.2 status).

---

STEP 7: FINAL REPORT

Output this table with actual results filled in:

| Check | Result |
| ----- | ------ |
| Git status before work | CLEAN |
| Commit before work | <actual HEAD from git --no-pager log --oneline -1> |
| route.ts created | PASS / FAIL |
| Typecheck | PASS / FAIL |
| Build | PASS / FAIL |
| Lint | PASS / FAIL |
| Integration test - 200 valid token | PASS / FAIL / SKIPPED |
| Integration test - 401 no header | PASS / FAIL / SKIPPED |
| Integration test - 401 invalid token | PASS / FAIL / SKIPPED |
| Integration test - test user cleanup | PASS / FAIL / SKIPPED |
| PROJECT_STATE.md updated | PASS / FAIL |
| TASK_LOG.md updated | PASS / FAIL |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS / FAIL |

If any non-SKIPPED row is FAIL, report the full error above the table before marking this done.

Do not commit. Do not push.
Recommended next action: show the founder this report and await approval before committing.
