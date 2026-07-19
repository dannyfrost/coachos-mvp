Implement T1-06 - Client List API Route.

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

CONTEXT

You are Claude IDE implementing T1-06 for the Coaching Platform MVP. This task creates GET /api/clients — the coach client list endpoint.

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Completed before this task:
- T1-00: Next.js 14 App Router scaffold, Turborepo, Supabase client utilities
- T1-01: POST /api/signup coach signup route (commit b5a12fa)
- T1-02: POST /api/login coach login route (commit 329bcb6)
- T1-03: GET /api/me coach session/profile state route (commit a60d947)
- T1-04: PATCH /api/workspace coach workspace setup route (commit a011ce4)
- T1-05: POST /api/clients/invite client invitation route (commit 2f84b78)
- Migrations 001-013: immutable, applied, Gate 0 pgTAP 84 tests passing
- packages/supabase/auth-server.ts: createAnonServerClient() and createUserClient(token) both present
- apps/web/app/api/clients/invite/route.ts: existing, do NOT touch

Do NOT touch any of the following:
- supabase/migrations/001-013 (immutable)
- supabase/tests/G0-01 through G0-16 (immutable)
- packages/supabase/database.types.ts
- apps/web/app/api/signup/route.ts
- apps/web/app/api/login/route.ts
- apps/web/app/api/me/route.ts
- apps/web/app/api/workspace/route.ts
- apps/web/app/api/clients/invite/route.ts
- packages/supabase/auth-server.ts
- packages/supabase/server.ts
- Any file not explicitly listed in the steps below

Do NOT implement any of the following in this task:
- POST /api/clients/:id (client update)
- DELETE /api/clients/:id
- GET /api/clients/:id (single client detail)
- Client activation or password setup flows
- Staff assignment mutations
- UI, dashboard, or onboarding components
- Cookies, session storage, or browser auth state
- Pagination

Do NOT commit. Do NOT push.

Read all files below before writing any code:
- packages/supabase/auth-server.ts - confirm createAnonServerClient() and createUserClient(token) exist
- supabase/migrations/002_create_tables.sql - confirm table shapes for: clients, platform_users, flash_cards, client_subscriptions, client_staff_assignments
- supabase/migrations/008_rls_policies.sql - confirm coach SELECT policies exist for: clients, flash_cards, client_subscriptions, client_staff_assignments, platform_users (workspace scope)

---

STEP 0: PRE-FLIGHT

Run each command and report its full output before proceeding.

0a. Git status - must be clean:
git --no-pager status --short
Expected: empty output. If any output appears, stop and report.

0b. Latest commit - confirm current HEAD at implementation time:
git --no-pager log --oneline -5
Confirm the log shows the T1-05 completion commit (2f84b78) or later and the working tree is clean.

0c. Confirm these files exist (report PRESENT or MISSING for each - do not print content):
  apps/web/app/api/signup/route.ts
  apps/web/app/api/login/route.ts
  apps/web/app/api/me/route.ts
  apps/web/app/api/workspace/route.ts
  apps/web/app/api/clients/invite/route.ts
  packages/supabase/auth-server.ts

0d. Confirm apps/web/app/api/clients/route.ts does NOT exist.
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

The clients/ directory already exists. Do NOT create it.

Create apps/web/app/api/clients/route.ts implementing the requirements below. Write a single file only. No additional helper files.

Requirements (derived from D-T1-06-01 through D-T1-06-11):

Write the file with exactly this structure:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

const FLASH_SEVERITY: Record<string, number> = { red: 0, yellow: 1, green: 2 }
const VALID_STATUSES = ['active', 'pending', 'paused', 'deactivated'] as const
type ClientStatus = typeof VALID_STATUSES[number]

export async function GET(req: NextRequest) {
  try {
    // 1. Extract and validate Bearer token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    // 2. Validate token with anon client
    const anonClient = createAnonServerClient()
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Create RLS-scoped DB client
    const db = createUserClient(token)

    // 4. Coach guard
    const { data: platformUser, error: puGuardError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puGuardError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.role_type !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 5. Parse optional ?status filter
    const { searchParams } = new URL(req.url)
    const rawStatus = searchParams.get('status')
    let statusFilter: ClientStatus | null = null
    if (rawStatus !== null) {
      if (!VALID_STATUSES.includes(rawStatus as ClientStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
      }
      statusFilter = rawStatus as ClientStatus
    }

    // 6. Fetch clients (RLS enforces coach_id = auth.uid())
    const { data: clientRows, error: clientsError } = await db
      .from('clients')
      .select('id, onboarding_completed, created_at')
      .limit(500)

    if (clientsError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const clientIds = (clientRows ?? []).map(c => c.id)

    if (clientIds.length === 0) {
      return NextResponse.json({ clients: [], total: 0 })
    }

    // 7. Parallel queries for all related data
    const [puResult, fcResult, csResult, csaResult] = await Promise.all([
      db.from('platform_users')
        .select('id, full_name, email, status')
        .in('id', clientIds),
      db.from('flash_cards')
        .select('client_id, status, reason, last_log_at')
        .in('client_id', clientIds),
      db.from('client_subscriptions')
        .select('client_id, status, end_date, created_at')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false }),
      db.from('client_staff_assignments')
        .select('client_id, staff_id')
        .in('client_id', clientIds),
    ])

    if (puResult.error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (csaResult.error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    // fcResult.error and csResult.error are non-fatal - data may not exist yet for new clients

    // 8. Fetch staff platform_users (only if assignments exist)
    const staffUserIds = [...new Set((csaResult.data ?? []).map(r => r.staff_id))]
    let staffPuData: Array<{ id: string; full_name: string; email: string }> = []
    if (staffUserIds.length > 0) {
      const { data: staffRows, error: staffError } = await db
        .from('platform_users')
        .select('id, full_name, email')
        .in('id', staffUserIds)
      if (staffError) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      staffPuData = staffRows ?? []
    }

    // 9. Build lookup structures
    const puMap = new Map((puResult.data ?? []).map(pu => [pu.id, pu]))
    const fcMap = new Map((fcResult.data ?? []).map(fc => [fc.client_id, fc]))
    const staffMap = new Map(staffPuData.map(s => [s.id, s]))

    // Latest subscription per client (rows already ordered by created_at DESC)
    const subMap = new Map<string, { status: string; end_date: string | null }>()
    for (const sub of (csResult.data ?? [])) {
      if (!subMap.has(sub.client_id)) {
        subMap.set(sub.client_id, { status: String(sub.status), end_date: sub.end_date ?? null })
      }
    }

    // Staff IDs per client
    const csaMap = new Map<string, string[]>()
    for (const csa of (csaResult.data ?? [])) {
      const arr = csaMap.get(csa.client_id) ?? []
      arr.push(csa.staff_id)
      csaMap.set(csa.client_id, arr)
    }

    // 10. Assemble client list
    let clients = (clientRows ?? [])
      .map(client => {
        const pu = puMap.get(client.id)
        if (!pu) return null

        const fc = fcMap.get(client.id) ?? null
        const sub = subMap.get(client.id) ?? null
        const clientStaffIds = csaMap.get(client.id) ?? []
        const assignedStaff = clientStaffIds
          .map(sid => staffMap.get(sid))
          .filter((s): s is NonNullable<typeof s> => s !== undefined)
          .map(s => ({ id: s.id, full_name: s.full_name, email: s.email }))

        return {
          id: client.id,
          full_name: pu.full_name,
          email: pu.email,
          status: pu.status,
          onboarding_completed: client.onboarding_completed,
          created_at: client.created_at,
          flash_card: fc
            ? { status: String(fc.status), reason: fc.reason ?? null, last_log_at: fc.last_log_at ?? null }
            : null,
          subscription: sub,
          assigned_staff: assignedStaff,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    // 11. Apply optional status filter
    if (statusFilter) {
      clients = clients.filter(c => c.status === statusFilter)
    }

    // 12. Sort: flash severity ASC then full_name ASC
    clients.sort((a, b) => {
      const fa = a.flash_card ? (FLASH_SEVERITY[a.flash_card.status] ?? 3) : 3
      const fb = b.flash_card ? (FLASH_SEVERITY[b.flash_card.status] ?? 3) : 3
      if (fa !== fb) return fa - fb
      return a.full_name.localeCompare(b.full_name)
    })

    return NextResponse.json({ clients, total: clients.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Write this file exactly as shown above. Do not add comments, console.log statements, or additional logic beyond what is shown.

---

STEP 2: TYPECHECK

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web exec tsc --noEmit

Expected: exit 0, no type errors.
If errors appear in apps/web/app/api/clients/route.ts, fix them in that file only and re-run.
Do not modify any other file. If errors appear elsewhere and you did not create them, report them as pre-existing.

---

STEP 3: BUILD

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web build

Expected: "Compiled successfully". /api/clients must appear in the output alongside /api/signup, /api/login, /api/me, /api/workspace, and /api/clients/invite.
If build fails, report the full output. Do not attempt to fix without reporting first.

---

STEP 4: LINT

Run:
$env:PATH = "C:\Users\reda-\AppData\Roaming\npm;" + $env:PATH
pnpm --filter web lint

Expected: no errors. Warnings are fine - they do not block.
If lint errors appear, fix only apps/web/app/api/clients/route.ts and re-run.

---

STEP 5: INTEGRATION TEST

Skip this entire step if Step 0e reported apps/web/.env.local missing, repo-root fallback only, or any required var absent. Write "INTEGRATION TEST SKIPPED - apps/web/.env.local not present or incomplete."

If apps/web/.env.local is present with all three required vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):

5a. Start the dev server in the background and wait 8 seconds:
$devServer = Start-Process -NoNewWindow -PassThru -FilePath "C:\Users\reda-\AppData\Roaming\npm\pnpm" -ArgumentList "--filter", "web", "dev"
Start-Sleep -Seconds 8

5b-pre. Pre-cleanup test users (LOCAL DEV ONLY - NEVER run against production):
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email IN ('t106-coach@example.com', 't106-client@example.com');"
Report: "Pre-cleanup complete." If this command errors, report the error but do not stop.

5b. Create a test coach via signup:
try {
  $signup = Invoke-WebRequest -Uri "http://localhost:3000/api/signup" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t106-coach@example.com","password":"password123","full_name":"Test Coach T106","workspace_name":"T106Workspace"}'
  "Signup Status: $($signup.StatusCode) | Body: $($signup.Content)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Signup Status: $code | Body: $rbody"
}
Expected: 201. If not 201, stop Step 5 and report.

5c. Login to get access token:
try {
  $login = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"t106-coach@example.com","password":"password123"}'
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
If $token is null after this block, stop Step 5 and report login failure.

5d. Define a helper function for GET /api/clients:
function Invoke-ClientList([string]$BearerToken, [string]$QueryString = "") {
  $uri = "http://localhost:3000/api/clients"
  if ($QueryString -ne "") { $uri = "$uri$QueryString" }
  try {
    $r = Invoke-WebRequest -Uri $uri -Method GET `
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

5e. Test 1 - empty list before any clients invited, expect 200 with clients []:
Invoke-ClientList $token
Expected: Status 200 - body contains { clients: [], total: 0 }.

5f. Invite a test client via T1-05 endpoint (creates a pending client):
try {
  $invite = Invoke-WebRequest -Uri "http://localhost:3000/api/clients/invite" -Method POST `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body '{"email":"t106-client@example.com","full_name":"Test Client T106"}'
  "Invite Status: $($invite.StatusCode) | client_id present: $($invite.Content -match '\"client_id\"')"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  $rbody = $reader.ReadToEnd()
  $reader.Close()
  "Invite Status: $code | Body: $rbody"
}
Expected: Status 201. Do NOT log or print activation_token value.

5g. Test 2 - list with one pending client, expect 200 with 1 result:
Invoke-ClientList $token
Expected: Status 200 - body contains 1 client with status "pending", total: 1.
Confirm: id is a UUID, full_name is "Test Client T106", email is "t106-client@example.com", flash_card is null, subscription is null, assigned_staff is [].

5h. Test 3 - filter by status=pending, expect 1 result:
Invoke-ClientList $token "?status=pending"
Expected: Status 200 - total: 1.

5i. Test 4 - filter by status=active, expect 0 results (client is pending):
Invoke-ClientList $token "?status=active"
Expected: Status 200 - total: 0, clients: [].

5j. Test 5 - invalid status value, expect 400:
Invoke-ClientList $token "?status=invalid"
Expected: Status 400 - body contains { error: "Invalid status value" }.

5k. Test 6 - missing Authorization header, expect 401:
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/clients" -Method GET
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

5l. Clean up test data (LOCAL DEV ONLY - targets only test emails):
npx supabase@2.98.2 db query --local "DELETE FROM auth.users WHERE email IN ('t106-coach@example.com', 't106-client@example.com');"
Confirm deletion:
npx supabase@2.98.2 db query --local "SELECT id, email FROM auth.users WHERE email IN ('t106-coach@example.com', 't106-client@example.com');"
Expected: (0 rows). If any row remains, report as cleanup failure.

5m. Stop the dev server - kill only the captured process from 5a:
if ($null -ne $devServer -and -not $devServer.HasExited) {
  $devServer.Kill()
  $devServer.WaitForExit(5000)
}

Report all six test results.

---

STEP 6: UPDATE CONTROL DOCS

Update only the three files listed below. Do not create new documentation files.

6a. PROJECT_STATE.md

In "## Current Task", replace:
  **T1-06** — NEXT (T1-05 complete 2026-05-22; pending founder approval)
With:
  **T1-07** — NEXT (T1-06 complete <use today's actual date YYYY-MM-DD>; pending founder approval)

In "## In Progress", replace:
  _None. T1-05 complete 2026-05-22. Awaiting founder approval for T1-06._
With:
  _None. T1-06 complete <use today's actual date YYYY-MM-DD>. Awaiting founder approval for T1-07._

In "## Completed Tasks", add this row after the T1-05 row:
  | T1-06 | Client list route (GET /api/clients) | <use today's actual date YYYY-MM-DD> | typecheck + build + lint PASS; RLS-scoped reads; parallel queries; ?status filter; flash severity sort; assigned_staff array |

6b. TASK_LOG.md

Append a new log entry at the bottom:

---

### <use today's actual date YYYY-MM-DD> - T1-06 Complete

| Field | Value |
| ----- | ----- |
| **Task ID** | T1-06 |
| **Description** | Client list route - GET /api/clients - Bearer auth; coach guard; optional ?status filter (active/pending/paused/deactivated); LIMIT 500; parallel DB queries (platform_users, flash_cards, client_subscriptions, client_staff_assignments); TypeScript merge; flash severity sort then full_name ASC; response { clients[], total } |
| **Agent** | Claude Code (IDE) |
| **Status** | COMPLETE |

**What ran:**

1. Pre-flight: confirmed git status clean; latest commit at implementation start: <actual HEAD from git --no-pager log --oneline -1>.
2. Created apps/web/app/api/clients/route.ts - GET handler; Bearer extraction; auth.getUser(); platform_users coach+active guard; ?status query param validation; clients query LIMIT 500; parallel platform_users/flash_cards/client_subscriptions/client_staff_assignments queries; staff platform_users lookup; Map-based merge; status filter; flash severity sort; JSON response.
3. Typecheck: PASS (exit 0, no errors).
4. Build: PASS (Compiled successfully).
5. Lint: PASS (no errors).
6. Integration test: [PASS - all 6 tests as expected] OR [SKIPPED - apps/web/.env.local missing].
7. Updated PROJECT_STATE.md: T1-06 row added; current task set to T1-07.
8. Updated TASK_LOG.md (this entry).
9. Updated docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md.

**Artifacts produced:**

- apps/web/app/api/clients/route.ts - new; GET /api/clients handler

**Blockers:** None.

**Resume from:** T1-07 - pending founder definition and approval.

6c. docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md

Find the line beginning with "> **State as of" and replace the entire line with:

> **State as of <use today's actual date YYYY-MM-DD>:** All 13 Tier 0 migrations complete. TypeScript types generated. Gate 0 COMPLETE (16 files, 84 tests, 0 failures). T1-00 COMPLETE - Next.js 14 App Router scaffold, Turborepo, Supabase client utilities. T1-01 COMPLETE - POST /api/signup route; service role; compensating rollback via deleteUser. T1-02 COMPLETE - POST /api/login route; anon client; signInWithPassword; 401 on all auth failures; tokens in body. T1-03 COMPLETE - GET /api/me route; anon+JWT client; RLS-evaluated reads; next_action logic. T1-04 COMPLETE - PATCH /api/workspace route; Unicode validation; trial activation; RLS writes. T1-05 COMPLETE - POST /api/clients/invite route; service role for auth user creation; user JWT for RPC; compensating rollback; duplicate detection. T1-06 COMPLETE - GET /api/clients route; RLS-scoped parallel queries; ?status filter; flash severity sort; assigned_staff array. Next: T1-07 - pending founder definition.

Find the resume instruction block beginning with "Gate 0 is COMPLETE. T1-00 through T1-05 are COMPLETE." and replace it with:

Gate 0 is COMPLETE. T1-00 through T1-06 are COMPLETE. Confirm before T1-07:

1. Latest commit is the T1-06 commit or later (git --no-pager log --oneline -5).
2. apps/web/app/api/clients/route.ts exists.
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
| Integration test - 200 empty list | PASS / FAIL / SKIPPED |
| Integration test - 200 one pending client | PASS / FAIL / SKIPPED |
| Integration test - 200 filter pending | PASS / FAIL / SKIPPED |
| Integration test - 200 filter active (0 results) | PASS / FAIL / SKIPPED |
| Integration test - 400 invalid status | PASS / FAIL / SKIPPED |
| Integration test - 401 missing token | PASS / FAIL / SKIPPED |
| Integration test - test user cleanup | PASS / FAIL / SKIPPED |
| PROJECT_STATE.md updated | PASS / FAIL |
| TASK_LOG.md updated | PASS / FAIL |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS / FAIL |

If any non-SKIPPED row is FAIL, report the full error above the table before marking this done.

Do not commit. Do not push.
Recommended next action: show the founder this report and await approval before committing.
