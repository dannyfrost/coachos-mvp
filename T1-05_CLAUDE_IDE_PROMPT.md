Implement T1-05 - Client Invitation API Route.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing T1-05 for the Coaching Platform MVP. This task creates POST /api/clients/invite — the client invitation endpoint.

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Completed before this task:
- T1-00: Next.js 14 App Router scaffold, Turborepo, Supabase client utilities
- T1-01: POST /api/signup coach signup route (commit b5a12fa)
- T1-02: POST /api/login coach login route (commit 329bcb6)
- T1-03: GET /api/me coach session/profile state route (commit a60d947)
- T1-04: PATCH /api/workspace coach workspace setup route (commit a011ce4)
- Migrations 001–013: immutable, applied, Gate 0 pgTAP 84 tests passing
- packages/supabase/auth-server.ts: createAnonServerClient() and createUserClient(token) both present
- packages/supabase/server.ts: createServiceRoleClient() present

Do NOT touch any of the following:
- supabase/migrations/001–013 (immutable)
- supabase/tests/G0-01 through G0-16 (immutable)
- packages/supabase/database.types.ts
- apps/web/app/api/signup/route.ts
- apps/web/app/api/login/route.ts
- apps/web/app/api/me/route.ts
- apps/web/app/api/workspace/route.ts
- packages/supabase/auth-server.ts
- packages/supabase/server.ts
- Any file not explicitly listed in the steps below

Do NOT implement any of the following in this task:
- GET /api/clients (T1-06)
- POST /api/sessions (T1-07)
- GET /api/dashboard (T1-08)
- Client activation or password setup flows
- Email delivery of invite token (MVP: return raw token in response body only)
- UI, dashboard, or onboarding components
- Cookies, session storage, or browser auth state

Do NOT commit. Do NOT push.

Read all files below before writing any code:
- packages/supabase/auth-server.ts — confirm createAnonServerClient() and createUserClient(token) exist
- packages/supabase/server.ts — confirm createServiceRoleClient() exists
- supabase/migrations/010_rpc_functions.sql lines 62–102 — confirm create_client_invite signature and behavior

---

STEP 0: PRE-FLIGHT

Run each command and report its full output before proceeding.

0a. Git status — must be clean:
git --no-pager status --short
Expected: empty output. If any output appears, stop and report.

0b. Latest commit — confirm current HEAD at implementation time:
git --no-pager log --oneline -5
Confirm the log shows the T1-04 completion commit (a011ce4) or later and the working tree is clean.

0c. Confirm these files exist (report PRESENT or MISSING for each — do not print content):
  apps/web/app/api/signup/route.ts
  apps/web/app/api/login/route.ts
  apps/web/app/api/me/route.ts
  apps/web/app/api/workspace/route.ts
  packages/supabase/auth-server.ts
  packages/supabase/server.ts

0d. Confirm apps/web/app/api/clients/invite/route.ts does NOT exist.
If it already exists, stop and report. Do not overwrite.

0e. Check for .env.local and required env vars:
Check if apps/web/.env.local exists and contains all three of: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
If apps/web/.env.local is missing, report: "apps/web/.env.local missing - Step 5 integration test will be skipped."
If apps/web/.env.local is missing but repo-root .env.local exists, report: "repo-root .env.local found, but apps/web/.env.local is required - Step 5 integration test will be skipped."
If apps/web/.env.local exists but any required var is absent, report which vars are missing and skip Step 5.
Do not stop on this.

If Steps 0a or 0b fail, stop and report. Do not proceed.

---

STEP 1: IMPLEMENT

Create the directory apps/web/app/api/clients/invite/ as needed.

Create apps/web/app/api/clients/invite/route.ts implementing the following requirements. Write a single file only. No additional helper files.

Requirements (derived from D-T1-05-01 through D-T1-05-05):

1. Import NextRequest and NextResponse from 'next/server'.
2. Import createServiceRoleClient from '@coaching/supabase/server'.
3. Import createAnonServerClient and createUserClient from '@coaching/supabase/auth-server'.
4. Export only the POST function. Wrap the entire handler body in try/catch. Unexpected errors caught by the outer catch must return 500 { error: 'Internal server error' }.

5. Extract Bearer token from Authorization header.
   If header missing or does not start with "Bearer ", return 401 { error: 'Unauthorized' }.

6. Call createAnonServerClient().auth.getUser(token).
   If error or no user returned, return 401 { error: 'Unauthorized' }.

7. Create db = createUserClient(token). Query platform_users where id = user.id. Select: id, role_type, status.
   If no row found or query error, return 401 { error: 'Unauthorized' }.
   If role_type !== 'coach', return 403 { error: 'Forbidden' }.
   If status !== 'active', return 403 { error: 'Forbidden' }.

8. Parse req.json(). If JSON is invalid, return 400 { error: 'Invalid JSON' }.

9. Validate email (D-T1-05-01):
   - If missing, null, or not a string: return 400 { error: 'email is required' }
   - Trim then toLowerCase the value.
   - Test against /^[^\s@]+@[^\s@]+\.[^\s@]+$/. If fails: return 400 { error: 'Invalid email format' }

10. Validate full_name (D-T1-05-01):
    - If missing, null, or not a string: return 400 { error: 'full_name is required' }
    - Trim the value.
    - If trimmed length < 2: return 400 { error: 'full_name must be at least 2 characters' }
    - If trimmed length > 100: return 400 { error: 'full_name must be 100 characters or fewer' }

11. Create serviceClient = createServiceRoleClient().

12. Call serviceClient.auth.admin.createUser({ email, email_confirm: true }).
    (No password field — client sets password via activation flow.)
    If authError:
    - If authError.message includes 'already been registered' or 'already registered': return 409 { error: 'Email already in use' }
    - Otherwise: return 422 { error: 'Failed to create client account' }
    If !authData.user: return 422 { error: 'Failed to create client account' }
    Assign: const userId = authData.user.id

13. Call createUserClient(token).rpc('create_client_invite', { p_user_id: userId, p_email: email, p_full_name: full_name }).
    Use the db constant from step 7 (createUserClient(token)) — do NOT use the service client here.
    If rpcError:
    a. Attempt compensating rollback: serviceClient.auth.admin.deleteUser(userId)
    b. If deleteUser returns an error: console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
    c. Do NOT include the orphan user ID in the API response.
    d. Return 500 { error: 'Internal server error' }

14. Return 201:
    {
      client_id: userId,
      activation_token: activationToken,  // TODO: replace with email delivery; remove raw token from response
    }
    where activationToken is the string value returned by the RPC (the raw 64-char hex token).
    Do NOT console.log or console.error or otherwise log the activation_token value.

---

STEP 2: TYPECHECK

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web exec tsc --noEmit

Expected: exit 0, no type errors.
If errors appear in apps/web/app/api/clients/invite/route.ts, fix them in that file only and re-run.
Do not modify any other file. If errors appear elsewhere and you did not create them, report them as pre-existing.

---

STEP 3: BUILD

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web build

Expected: "Compiled successfully". /api/signup, /api/login, /api/me, /api/workspace, and /api/clients/invite must all appear in the output.
If build fails, report the full output. Do not attempt to fix without reporting first.

---

STEP 4: LINT

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web lint

Expected: no errors. Warnings are fine — they do not block.
If lint errors appear, fix only apps/web/app/api/clients/invite/route.ts and re-run.

---

STEP 5: INTEGRATION TEST

Skip this entire step if Step 0e reported apps/web/.env.local missing, repo-root fallback only, or any required var absent. Write "INTEGRATION TEST SKIPPED - apps/web/.env.local not present or incomplete."

If apps/web/.env.local is present with all three required vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):

5a. Start the dev server in the background and wait 8 seconds:
$devServer = Start-Process -NoNewWindow -PassThru -FilePath "C:\Users\reda-\AppData\Roaming\npm\pnpm" -ArgumentList "--filter", "web", "dev"
Start-Sleep -Seconds 8

5b-pre. Pre-cleanup both test users (LOCAL DEV ONLY — NEVER run against production):
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email IN ('t105-coach@example.com', 't105-client@example.com');"
Report: "Pre-cleanup complete." If this command errors, report the error but do not stop — proceed to 5b.

5b. Create a test coach via the signup route:
try {
  $signup = Invoke-WebRequest -Uri "http://localhost:3000/api/signup" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t105-coach@example.com","password":"password123","full_name":"Test Coach","workspace_name":"TestWorkspace"}'
  "Signup Status: $($signup.StatusCode) | Body: $($signup.Content)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Signup Status: $code | Body: $rbody"
}
Expected: 201. Proceed to 5c.

5c. Login to get access token:
try {
  $login = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t105-coach@example.com","password":"password123"}'
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
function Invoke-InviteRequest([string]$BearerToken, [string]$JsonBody) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/clients/invite" -Method POST `
         -ContentType "application/json" `
         -Headers @{ Authorization = "Bearer $BearerToken" } `
         -Body $JsonBody
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

5e. Test 1 — valid invite, expect 201:
Invoke-InviteRequest $token '{"email":"t105-client@example.com","full_name":"Test Client"}'
Expected: Status 201 — body contains client_id (UUID) and activation_token (64-char hex string).
Do NOT log or print the activation_token value in your report — confirm its presence only (e.g., "activation_token: present, 64 chars").

5f. Test 2 — duplicate email invite, expect 409:
Invoke-InviteRequest $token '{"email":"t105-client@example.com","full_name":"Test Client"}'
Expected: Status 409 — body contains { error: "Email already in use" }.

5g. Test 3 — invalid body (empty email), expect 400:
Invoke-InviteRequest $token '{"email":"","full_name":"Test Client"}'
Expected: Status 400 — body contains validation error about email.

5h. Test 4 — missing Authorization header, expect 401:
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/clients/invite" -Method POST `
       -ContentType "application/json" -Body '{"email":"t105-client2@example.com","full_name":"Test Client"}'
  "Status: $($r.StatusCode) | Body: $($r.Content)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Status: $code | Body: $rbody"
}
Expected: Status 401 — body contains { error: "Unauthorized" }.

5i. Clean up test data — remove both test users (LOCAL DEV ONLY — targets only test emails):
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email IN ('t105-coach@example.com', 't105-client@example.com');"
Confirm deletion:
npx supabase@2.98.2 db query --local "SELECT id, email FROM auth.users WHERE email IN ('t105-coach@example.com', 't105-client@example.com');"
Expected: (0 rows). If any row is returned, report it as a cleanup failure in the final report.

5j. Stop the dev server — kill only the captured process from 5a, not all Node processes:
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
  **T1-05** — NEXT (T1-04 complete 2026-05-20; pending founder approval)
With:
  **T1-06** — NEXT (T1-05 complete <use today's actual date YYYY-MM-DD>; pending founder approval)

In "## In Progress", replace:
  _None. T1-04 complete 2026-05-20. Awaiting founder approval for T1-05._
With:
  _None. T1-05 complete <use today's actual date YYYY-MM-DD>. Awaiting founder approval for T1-06._

In "## Completed Tasks", add this row after the T1-04 row:
  | T1-05 | Client invitation route (POST /api/clients/invite) | <use today's actual date YYYY-MM-DD> | typecheck + build + lint PASS; service role auth user creation; user JWT for RPC; compensating rollback; email validation + duplicate detection |

6b. TASK_LOG.md

Append a new log entry at the bottom:

---

### <use today's actual date YYYY-MM-DD> - T1-05 Complete

| Field | Value |
| ----- | ----- |
| **Task ID** | T1-05 |
| **Description** | Client invitation route - POST /api/clients/invite - email + full_name validation; service role auth.admin.createUser (email_confirm: true, no password); user JWT createUserClient for create_client_invite RPC (auth.uid() = coach); compensating rollback (deleteUser) on RPC failure; 409 on duplicate email; 201 returns client_id + activation_token (MVP: raw token, TODO: replace with email delivery) |
| **Agent** | Claude Code (IDE) |
| **Status** | COMPLETE |

**What ran:**

1. Pre-flight: confirmed git status clean; latest commit at implementation start: <actual HEAD from git --no-pager log --oneline -1>.
2. Created apps/web/app/api/clients/invite/route.ts - POST handler; Bearer extraction; auth.getUser(); platform_users role+status guard; body parse + email/full_name validation; service role createUser (no password, email_confirm: true); createUserClient RPC call; compensating rollback on RPC failure; 201 response with client_id + activation_token.
3. Typecheck: PASS (exit 0, no errors).
4. Build: PASS (Compiled successfully).
5. Lint: PASS (no errors).
6. Integration test: [PASS - 201 / 409 / 400 / 401 as expected] OR [SKIPPED - apps/web/.env.local missing].
7. Updated PROJECT_STATE.md: T1-05 row added; current task set to T1-06.
8. Updated TASK_LOG.md (this entry).
9. Updated docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.

**Artifacts produced:**

- apps/web/app/api/clients/invite/route.ts - new; POST /api/clients/invite handler

**Blockers:** None.

**Resume from:** T1-06 - GET /api/clients - pending founder definition and approval.

6c. docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Find the line beginning with "> **State as of" and replace the entire line with:

> **State as of <use today's actual date YYYY-MM-DD>:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 COMPLETE - Next.js 14 App Router scaffold, Turborepo, Supabase client utilities. T1-01 COMPLETE - POST /api/signup route; service role; compensating rollback via deleteUser. T1-02 COMPLETE - POST /api/login route; anon client; signInWithPassword; 401 on all auth failures; tokens in body. T1-03 COMPLETE - GET /api/me route; anon+JWT client; RLS-evaluated reads; next_action logic. T1-04 COMPLETE - PATCH /api/workspace route; Unicode validation; trial activation; RLS writes. T1-05 COMPLETE - POST /api/clients/invite route; service role for auth user creation; user JWT for RPC; compensating rollback; duplicate detection. Next: T1-06 - pending founder definition.

Find the resume instruction block beginning with "Gate 0 is COMPLETE. T1-00 through T1-04 are COMPLETE." and replace it with:

Gate 0 is COMPLETE. T1-00 through T1-05 are COMPLETE. Confirm before T1-06:

1. Latest commit is the T1-05 commit or later (git --no-pager log --oneline -5).
2. apps/web/app/api/clients/invite/route.ts exists.
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
| Integration test - 201 valid invite | PASS / FAIL / SKIPPED |
| Integration test - 409 duplicate email | PASS / FAIL / SKIPPED |
| Integration test - 400 invalid body | PASS / FAIL / SKIPPED |
| Integration test - 401 missing token | PASS / FAIL / SKIPPED |
| Integration test - test user cleanup | PASS / FAIL / SKIPPED |
| PROJECT_STATE.md updated | PASS / FAIL |
| TASK_LOG.md updated | PASS / FAIL |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS / FAIL |

If any non-SKIPPED row is FAIL, report the full error above the table before marking this done.

Do not commit. Do not push.
Recommended next action: show the founder this report and await approval before committing.
