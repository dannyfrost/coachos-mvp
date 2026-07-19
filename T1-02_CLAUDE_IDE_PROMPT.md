Implement T1-02 - Coach Login API Route.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing T1-02 for the Coaching Platform MVP. This task creates POST /api/login - the coach login endpoint.

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Completed before this task:
- T1-00: Next.js 14 App Router scaffold, Turborepo, Supabase client utilities
- T1-01: POST /api/signup coach signup route (commit b5a12fa)
- Migrations 001-013: immutable, applied, Gate 0 pgTAP 84 tests passing

Do NOT touch any of the following:
- supabase/migrations/001-013 (immutable)
- supabase/tests/G0-01 through G0-16 (immutable)
- packages/supabase/database.types.ts
- apps/web/app/api/signup/route.ts
- packages/supabase/package.json (read and conditionally update only if auth-server.ts is created)
- Any file not explicitly listed in the steps below

Do NOT implement any of the following in this task:
- Logout, token refresh, or password reset routes
- Dashboard, onboarding flow, or session management
- Cookie-based session or browser auth state
- Client invite, mobile work, or any Tier 2+ feature

Do NOT commit. Do NOT push.

Read all files below before writing any code:
- DECISIONS.md - sections D-T1-02-01 through D-T1-02-07
- packages/supabase/server.ts - confirm no anon server helper exists
- packages/supabase/auth-server.ts - confirm whether this file exists (PRESENT or MISSING)

---

STEP 0: PRE-FLIGHT

Run each command and report its full output before proceeding.

0a. Git status - must be clean:
git --no-pager status --short
Expected: empty output. If any output appears, stop and report.

0b. Latest commit - confirm current HEAD at implementation time:
git --no-pager log --oneline -5
Confirm the log shows a commit from docs(auth): repair t1-02 env checks or later and the working tree is clean. There is no pinned hash — verify the tree is clean and matches the expected state before proceeding.

0c. Confirm these files exist (report PRESENT or MISSING for each - do not print content):
  apps/web/app/api/signup/route.ts
  packages/supabase/server.ts
  turbo.json

0d. Check for .env.local and required env vars:
Check if apps/web/.env.local exists and contains all three of: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
If apps/web/.env.local is missing, report: "apps/web/.env.local missing - Step 5 integration test will be skipped."
If apps/web/.env.local is missing but repo-root .env.local exists, report: "repo-root .env.local found, but apps/web/.env.local is required for reliable Next.js app env loading - Step 5 integration test will be skipped."
If apps/web/.env.local exists but any of the three required vars are absent, report which vars are missing and skip Step 5.
Do not stop on this.

0e. Check for anon server helper:
Read packages/supabase/auth-server.ts.
If the file exists and exports createAnonServerClient(), report: "ANON HELPER PRESENT - skip Step 1a."
If the file does not exist, report: "ANON HELPER MISSING - Step 1a must create packages/supabase/auth-server.ts."
This determines whether Step 1a is required.

If Steps 0a or 0b fail, stop and report. Do not proceed.

---

STEP 1: IMPLEMENT

1a. IF Step 0e reported ANON HELPER MISSING:
Create packages/supabase/auth-server.ts with the following content exactly:

// Server-only. Never import this file from client components or client.ts.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createAnonServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(supabaseUrl, anonKey)
}

If Step 0e reported ANON HELPER PRESENT, skip Step 1a entirely.

1a-post. IF Step 1a created auth-server.ts:
Read packages/supabase/package.json.
If an "exports" field exists, add "./auth-server" to the exports map pointing to "./auth-server.ts" (or "./dist/auth-server.js" if other entries use dist paths - match the existing pattern).
If no "exports" field exists, report: "No exports map in packages/supabase/package.json - no export update required."
If Step 1a was skipped (ANON HELPER PRESENT), skip Step 1a-post entirely.

1b. Create the directory apps/web/app/api/login/ as needed.

Create apps/web/app/api/login/route.ts implementing the following requirements. Write a single file only. No additional helper files.

Requirements (derived from D-T1-02-01 through D-T1-02-07):

1. Import NextRequest and NextResponse from 'next/server'.
2. Import createAnonServerClient from '@coaching/supabase/auth-server'.
3. Define an inline validation function.
  - Accepts unknown input.
  - Returns { ok: true; data: LoginBody } or { ok: false; error: string }.
  - email: trim then validate email format.
  - password: check non-empty only. Do NOT trim. Do not enforce minimum length.
4. Export an async POST(req: NextRequest) function - the only export.
5. Parse req.json(). If JSON is invalid, return 400 { error: 'Invalid JSON' }.
6. Run validation. If invalid, return 400 { error: <message> }.
7. Call createAnonServerClient() - assign to supabase.
8. Call supabase.auth.signInWithPassword({ email, password }).
  - On auth error (invalid credentials, unknown email, any Supabase auth rejection):
    return 401 { error: 'Invalid credentials' }.
    Do not expose the Supabase error message. Do not distinguish wrong password from unknown email.
  - On unexpected non-auth error (network, server fault):
    return 500 { error: 'Login failed' }.
9. On success: return 200 { id: data.user.id, email: data.user.email, access_token: data.session.access_token, refresh_token: data.session.refresh_token }.
  - Do not set any cookies. Do not manage session state. Tokens in body only (D-T1-02-07).

---

STEP 2: TYPECHECK

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web exec tsc --noEmit

Expected: exit 0, no type errors.
If errors appear in apps/web/app/api/login/route.ts or packages/supabase/auth-server.ts, fix them in those files only and re-run.
Do not modify any other file. If errors appear elsewhere and you did not create them, report them as pre-existing.

---

STEP 3: BUILD

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web build

Expected: "Compiled successfully". Both /api/signup and /api/login must appear in the output.
If build fails, report the full output. Do not attempt to fix without reporting first.

---

STEP 4: LINT

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web lint

Expected: no errors. Warnings are fine - they do not block.
If lint errors appear, fix only apps/web/app/api/login/route.ts or packages/supabase/auth-server.ts and re-run.

---

STEP 5: INTEGRATION TEST

Skip this entire step if Step 0d reported apps/web/.env.local missing, repo-root fallback only, or any required var absent. Write "INTEGRATION TEST SKIPPED - apps/web/.env.local not present or incomplete."

If apps/web/.env.local is present with all three required vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):

5a. Start the dev server in the background and wait 8 seconds:
$devServer = Start-Process -NoNewWindow -PassThru -FilePath "C:\Users\reda-\AppData\Roaming\npm\pnpm" -ArgumentList "--filter", "web", "dev"
Start-Sleep -Seconds 8

5b-pre. Pre-cleanup test user (LOCAL DEV ONLY - NEVER run against production):
Delete any leftover test user before signup to guarantee a clean state.
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email = 't102-test@example.com';"
Report: "Pre-cleanup complete." If this command errors, report the error but do not stop - proceed to 5b.

5b. Create a test user via the signup route (needed for login tests):
try {
  $signup = Invoke-WebRequest -Uri "http://localhost:3000/api/signup" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t102-test@example.com","password":"password123","full_name":"Test Coach","workspace_name":"T102 Workspace"}'
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

5c. Define a helper that captures both status code and body for all responses including 4xx/5xx:
function Invoke-LoginRequest([string]$JsonBody) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST `
         -ContentType "application/json" -Body $JsonBody
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

5d. Test 1 - valid login, expect 200:
Invoke-LoginRequest '{"email":"t102-test@example.com","password":"password123"}'
Expected: Status 200 - body contains id (UUID), email, access_token, refresh_token.

5e. Test 2 - wrong password, expect 401:
Invoke-LoginRequest '{"email":"t102-test@example.com","password":"wrongpassword"}'
Expected: Status 401 - body contains "Invalid credentials". Must NOT expose Supabase error details.

5f. Test 3 - unknown email, expect 401:
Invoke-LoginRequest '{"email":"nobody@example.com","password":"password123"}'
Expected: Status 401 - body contains "Invalid credentials". Same response as wrong password (no enumeration).

5g. Test 4 - empty password, expect 400:
Invoke-LoginRequest '{"email":"t102-test@example.com","password":""}'
Expected: Status 400 - body contains validation error.

5h. Clean up test data - remove the auth user created in step 5b (local dev only, targets specific test email):
Never run this cleanup against production. It is local-dev only and targets only t102-test@example.com.
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email = 't102-test@example.com';"
Confirm deletion:
npx supabase@2.98.2 db query --local "SELECT id FROM auth.users WHERE email = 't102-test@example.com';"
Expected: (0 rows). If any row is returned, report it as a cleanup failure in the final report.

5i. Stop the dev server - kill only the captured process from 5a, not all Node processes:
if ($null -ne $devServer -and -not $devServer.HasExited) {
  $devServer.Kill()
  $devServer.WaitForExit(5000)
}

Report all four test results.

---

STEP 6: UPDATE CONTROL DOCS

Update only the three files listed below. Do not create new documentation files.

6a. PROJECT_STATE.md

In "## Current Task", replace:
  **T1-02 coach login API route** - NEXT (T1-01 complete 2026-05-20; pending founder approval)
With:
  **T1-03** - NEXT (T1-02 complete 2026-05-20; pending founder approval)

In "## In Progress", replace:
  _None. T1-01 complete 2026-05-20. Awaiting founder approval for T1-02._
With:
  _None. T1-02 complete 2026-05-20. Awaiting founder approval for T1-03._

In "## Completed Tasks", add this row after the T1-01 row:
  | T1-02 | Coach login API route (POST /api/login) | 2026-05-20 | typecheck + build + lint PASS; anon client; 401 on all auth failures; tokens in body |

6b. TASK_LOG.md

Append a new log entry at the bottom:

---

### 2026-05-20 - T1-02 Complete

| Field | Value |
| ----- | ----- |
| **Task ID** | T1-02 |
| **Description** | Coach login API route - POST /api/login - anon client signInWithPassword; 401 on all auth failures (no enumeration); tokens in body |
| **Agent** | Claude Code (IDE) |
| **Status** | COMPLETE |

**What ran:**

1. Pre-flight: confirmed git status clean; latest commit at implementation start: <actual HEAD commit from git --no-pager log --oneline -1>; signup route present.
2. Created packages/supabase/auth-server.ts - createAnonServerClient() using NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
3. Created apps/web/app/api/login/route.ts - POST handler; inline validation (trim email, no-trim password); anon client; signInWithPassword; 401 on all auth failures; tokens in body.
4. Typecheck: PASS (exit 0, no errors).
5. Build: PASS (Compiled successfully).
6. Lint: PASS (no errors).
7. Integration test: [PASS - 200 / 401 / 401 / 400 as expected] OR [SKIPPED - .env.local missing].
8. Updated PROJECT_STATE.md: T1-02 row added; current task set to T1-03.
9. Updated TASK_LOG.md (this entry).
10. Updated docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.

**Artifacts produced:**

- packages/supabase/auth-server.ts - new; createAnonServerClient() helper
- apps/web/app/api/login/route.ts - new; POST /api/login handler

**Blockers:** None.

**Resume from:** T1-03 - pending founder definition and approval.

6c. docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Find the line beginning with "> **State as of" and replace the entire line with:

> **State as of 2026-05-20:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 COMPLETE - Next.js 14 App Router scaffold, Turborepo, Supabase client utilities. T1-01 COMPLETE - POST /api/signup route; service role; compensating rollback via deleteUser. T1-02 COMPLETE - POST /api/login route; anon client; signInWithPassword; 401 on all auth failures; tokens in body. Next: T1-03 - pending founder definition.

Find the resume instruction block beginning with "Gate 0 is COMPLETE. T1-00 is COMPLETE. T1-01 is COMPLETE" and replace it with:

Gate 0 is COMPLETE. T1-00 is COMPLETE. T1-01 is COMPLETE. T1-02 is COMPLETE (POST /api/login). Confirm before T1-03:

1. Latest commit is the T1-02 commit or later (git --no-pager log --oneline -5).
2. apps/web/app/api/login/route.ts exists.
3. packages/supabase/auth-server.ts exists.
4. Local Supabase is running (npx supabase@2.98.2 status).

---

STEP 7: FINAL REPORT

Output this table with actual results filled in:

| Check | Result |
| ----- | ------ |
| Git status before work | CLEAN |
| Commit before work | <actual HEAD commit from git --no-pager log --oneline -1> |
| Anon helper (Step 0e) | PRESENT / MISSING (created) |
| auth-server.ts created or pre-existing | PASS / FAIL |
| route.ts created | PASS / FAIL |
| Typecheck | PASS / FAIL |
| Build | PASS / FAIL |
| Lint | PASS / FAIL |
| Integration test - 200 valid login | PASS / FAIL / SKIPPED |
| Integration test - 401 wrong password | PASS / FAIL / SKIPPED |
| Integration test - 401 unknown email | PASS / FAIL / SKIPPED |
| Integration test - 400 validation | PASS / FAIL / SKIPPED |
| Integration test - test user cleanup | PASS / FAIL / SKIPPED |
| PROJECT_STATE.md updated | PASS / FAIL |
| TASK_LOG.md updated | PASS / FAIL |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS / FAIL |

If any non-SKIPPED row is FAIL, report the full error above the table before marking this done.

Do not commit. Do not push.
Recommended next action: show the founder this report and await approval before committing.
