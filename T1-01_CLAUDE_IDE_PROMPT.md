Implement T1-01 - Coach Signup API Route.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing T1-01 for the Coaching Platform MVP. This task creates POST /api/signup - the coach signup endpoint.

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Do NOT touch any of the following:
- supabase/migrations/001-013 (immutable)
- supabase/tests/G0-01 through G0-16 (immutable)
- packages/supabase/database.types.ts
- Any file not explicitly listed in the steps below

Do NOT implement any of the following in this task:
- Login or logout routes
- Dashboard, onboarding flow, or session management
- Client invite, mobile work, or any Tier 2+ feature

Do NOT commit. Do NOT push.

Read all four files below before writing any code:
- DECISIONS.md - sections D-T1-01 through D-T1-07
- packages/supabase/server.ts - createServiceRoleClient signature
- packages/supabase/database.types.ts - platform_users Insert and coaches Insert types
- supabase/migrations/002_create_tables.sql - confirm ON DELETE CASCADE on platform_users.id and coaches.id

---

STEP 0: PRE-FLIGHT

Run each command and report its full output before proceeding.

0a. Git status - must be clean:
git --no-pager status --short
Expected: empty output. If any output appears, stop and report.

0b. Latest commit - must be 7d8d291 or later:
git --no-pager log --oneline -5

0c. Confirm these files exist (report PRESENT or MISSING for each - do not print content):
  apps/web/app/layout.tsx
  apps/web/app/page.tsx
  packages/supabase/server.ts
  turbo.json

0d. Confirm email confirmation is disabled - read the [auth] section of supabase/config.toml and report the enable_confirmations line.

0e. Check for .env.local:
Check if apps/web/.env.local or .env.local (repo root) exists and contains SUPABASE_SERVICE_ROLE_KEY.
If neither exists, report: ".env.local missing - Step 5 (integration test) will be skipped."
Do not stop on this.

0f. Verify ON DELETE CASCADE for compensating rollback:
Read supabase/migrations/002_create_tables.sql. Find and report the exact DDL lines for:
- platform_users.id — its REFERENCES clause
- coaches.id — its REFERENCES clause
Confirm whether each carries ON DELETE CASCADE.
Report one of three outcomes:
  CASCADE CONFIRMED — platform_users.id → auth.users ON DELETE CASCADE AND coaches.id → platform_users.id ON DELETE CASCADE
  CASCADE PARTIAL — describe exactly what was found
  CASCADE NOT CONFIRMED — describe exactly what was found
This result is required before writing the rollback branches in Step 1.

If Steps 0a or 0b fail, stop and report. Do not proceed.

---

STEP 1: IMPLEMENT apps/web/app/api/signup/route.ts

Create the directory apps/web/app/api/signup/ as needed.

Create apps/web/app/api/signup/route.ts implementing the following requirements. Write a single file only. No helper files, no lib/ utilities, no shared modules.

Requirements (derived from D-T1-01 through D-T1-07):

1. Import NextRequest and NextResponse from 'next/server'.
2. Import createServiceRoleClient from '@coaching/supabase/server'.
3. Define an inline validation function.
  - Accepts unknown input.
  - Returns { ok: true; data: SignupBody } or { ok: false; error: string }.
  - Trims all string inputs before validating (D-T1-05).
  - email: valid email format check.
  - password: minimum 8 characters.
  - full_name: minimum 2, maximum 100 characters after trim.
  - workspace_name: minimum 2, maximum 50 characters after trim; only letters, numbers, spaces, hyphens, and apostrophes (regex: /^[a-zA-Z0-9 \-']+$/).
4. Export an async POST(req: NextRequest) function - the only export.
5. Parse req.json(). If JSON is invalid, return 400 { error: 'Invalid JSON' }.
6. Run validation. If invalid, return 400 { error: <message> }.
7. Call createServiceRoleClient() - assign to supabase.
8. Call supabase.auth.admin.createUser({ email, password, email_confirm: true }).
  - email_confirm: true marks the email verified at creation (D-T1-03).
  - On authError: return 422 { error: authError.message }.
9. Extract userId = authData.user.id.
10. Insert into platform_users: { id: userId, email, full_name, role_type: 'coach', status: 'active', email_verified: true }.
  - On error: compensating rollback — call await supabase.auth.admin.deleteUser(userId). If deleteUser itself fails, log console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId) and return 500 { error: 'Profile creation failed', orphan: userId }.
11. Insert into coaches: { id: userId, workspace_name, timezone: 'UTC' }.
  - On error: compensating rollback — do NOT assume cascade without verification. Use the result of Step 0f:
    - If CASCADE CONFIRMED: call await supabase.auth.admin.deleteUser(userId). The cascade removes platform_users automatically.
    - If CASCADE NOT CONFIRMED or PARTIAL: first delete the platform_users row explicitly (await supabase.from('platform_users').delete().eq('id', userId)), then call await supabase.auth.admin.deleteUser(userId).
    In all cases, if deleteUser fails: log console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId) and return 500 { error: 'Coach profile creation failed', orphan: userId }.
  - timezone: 'UTC' is the default — user updates later.
  - Do not describe this flow as atomic.
12. Return 201 { id: userId, email }.

---

STEP 2: TYPECHECK

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web exec tsc --noEmit

Expected: exit 0, no type errors.
If errors appear in apps/web/app/api/signup/route.ts, fix them in that file only and re-run.
Do not modify any other file. If errors appear elsewhere and you did not create them, report them as pre-existing.

---

STEP 3: BUILD

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web build

Expected: "Compiled successfully". The /api/signup route must appear in the output.
If build fails, report the full output. Do not attempt to fix without reporting first.

---

STEP 4: LINT

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web lint

Expected: no errors. Notes on warnings are fine - they do not block.
If lint errors appear, fix only apps/web/app/api/signup/route.ts and re-run.

---

STEP 5: INTEGRATION TEST

Skip this entire step if Step 0e reported .env.local missing. Write "INTEGRATION TEST SKIPPED - .env.local not present."

If .env.local is present:

5a. Start the dev server in the background and wait 8 seconds:
$devServer = Start-Process -NoNewWindow -PassThru -FilePath "C:\Users\reda-\AppData\Roaming\npm\pnpm" -ArgumentList "--filter", "web", "dev"
Start-Sleep -Seconds 8

5b. Define a helper that captures both status code and body for all responses including 4xx/5xx:
function Invoke-SignupRequest([string]$JsonBody) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/signup" -Method POST `
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

5c. Test 1 — valid signup, expect 201:
Invoke-SignupRequest '{"email":"t101-test@example.com","password":"password123","full_name":"Test Coach","workspace_name":"Test Workspace"}'
Expected: Status 201 — body contains id (UUID) and email.

5d. Test 2 — missing workspace_name, expect 400:
Invoke-SignupRequest '{"email":"x@example.com","password":"password123","full_name":"Test Coach"}'
Expected: Status 400 — body contains workspace_name validation error.

5e. Test 3 — duplicate email from Test 1, expect 422:
Invoke-SignupRequest '{"email":"t101-test@example.com","password":"password123","full_name":"Test Coach","workspace_name":"Test Workspace"}'
Expected: Status 422 — body contains Supabase duplicate user error message.

5f. Clean up test data — remove the auth user created in Test 1 (local dev only, targets specific test email):
Never run this cleanup against production. It is local-dev only and targets only t101-test@example.com.
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email = 't101-test@example.com';"
Confirm deletion:
npx supabase@2.98.2 db query --local "SELECT id FROM auth.users WHERE email = 't101-test@example.com';"
Expected: (0 rows). If any row is returned, report it as a cleanup failure in the final report.

5g. Stop the dev server — kill only the captured process from 5a, not all Node processes:
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
  **T1-01 coach signup API route** - NEXT (T1-00 complete 2026-05-17; pending founder approval)
With:
  **T1-02 coach login API route** - NEXT (T1-01 complete 2026-05-20; pending founder approval)

In "## In Progress", replace:
  _None. Gate 0 complete 2026-05-16. Tier 1 planning is next. Awaiting founder approval._
With:
  _None. T1-01 complete 2026-05-20. Awaiting founder approval for T1-02._

In "## Completed Tasks", add this row after the T1-00 row:
  | T1-01 | Coach signup API route (POST /api/signup) | 2026-05-20 | V1-V6 passed; typecheck + build + lint PASS; service role; rollback via deleteUser |

In "## Blocked", update the Tier 1 row:
  OLD: | Tier 1 (auth) | ... |
  NEW: remove entirely - Tier 1 is now in progress (T1-01 done, T1-02 next)

6b. TASK_LOG.md

Append a new log entry at the bottom:

---

### 2026-05-20 - T1-01 Complete

| Field | Value |
| ----- | ----- |
| **Task ID** | T1-01 |
| **Description** | Coach signup API route - POST /api/signup - creates auth user + platform_users + coaches; compensating rollback via deleteUser |
| **Agent** | Claude Code (IDE) |
| **Status** | COMPLETE |

**What ran:**

1. Pre-flight: confirmed git status clean; latest commit 7d8d291; scaffold files present; enable_confirmations = false confirmed in config.toml.
2. Created apps/web/app/api/signup/route.ts - POST handler; inline validation; service role; auth.admin.createUser with email_confirm: true; platform_users insert; coaches insert; auth.admin.deleteUser rollback on any insert failure.
3. Typecheck: PASS (exit 0, no errors).
4. Build: PASS (Compiled successfully).
5. Lint: PASS (no errors).
6. Integration test: [PASS - 201 / 400 / 422 as expected] OR [SKIPPED - .env.local missing].
7. Updated PROJECT_STATE.md: T1-01 row added; current task set to T1-02.
8. Updated TASK_LOG.md (this entry).
9. Updated docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.

**Artifacts produced:**

- apps/web/app/api/signup/route.ts - new; POST /api/signup handler

**Blockers:** None.

**Resume from:** T1-02 - coach login API route. Awaiting founder approval.

6c. docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Find the line beginning with "> **State as of" and replace the entire line with:

> **State as of 2026-05-20:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 COMPLETE - Next.js 14 App Router scaffold, Turborepo, Supabase client utilities. T1-01 COMPLETE - POST /api/signup route; service role; sequential creation of auth user, platform_users, and coaches with compensating rollback; rollback via deleteUser on failure. Next: T1-02 coach login API route - pending explicit founder approval.

Find the resume instruction block beginning with "Gate 0 is COMPLETE. T1-00 is COMPLETE" and replace it with:

Gate 0 is COMPLETE. T1-00 is COMPLETE. T1-01 is COMPLETE (POST /api/signup). Confirm before T1-02:
1. Latest commit is the T1-01 commit or later (git --no-pager log --oneline -5).
2. apps/web/app/api/signup/route.ts exists.
3. Local Supabase is running (npx supabase@2.98.2 status).

---

STEP 7: FINAL REPORT

Output this table with actual results filled in:

| Check | Result |
| ----- | ------ |
| Git status before work | CLEAN |
| Commit before work | 7d8d291 |
| enable_confirmations = false confirmed | PASS / FAIL |
| route.ts created | PASS / FAIL |
| Typecheck | PASS / FAIL |
| Build | PASS / FAIL |
| Lint | PASS / FAIL |
| Integration test - 201 | PASS / FAIL / SKIPPED |
| Integration test - 400 | PASS / FAIL / SKIPPED |
| Integration test - 422 | PASS / FAIL / SKIPPED |
| Integration test — test user cleanup | PASS / FAIL / SKIPPED |
| Cascade verification (Step 0f) | CONFIRMED / PARTIAL / NOT CONFIRMED |
| PROJECT_STATE.md updated | PASS / FAIL |
| TASK_LOG.md updated | PASS / FAIL |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS / FAIL |

If any non-SKIPPED row is FAIL, report the full error above the table before marking this done.

Do not commit. Do not push.
Recommended next action: show the founder this report and await approval before committing.
