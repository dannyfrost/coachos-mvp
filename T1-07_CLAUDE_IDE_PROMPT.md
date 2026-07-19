# T1-07 Claude IDE Implementation Prompt
# POST /api/client-activation/complete

**Task:** T1-07 — Client Activation API Route
**Route:** POST /api/client-activation/complete
**Date:** 2026-05-24
**Status:** Ready for implementation — all decisions locked in DECISIONS.md (D-T1-07-01 through D-T1-07-11)

---

## Pre-flight (run before writing any code)

```powershell
git --no-pager status --short
git --no-pager log --oneline -5
```

Expected: clean working tree, latest commit is T1-06 (`feat(api): add GET /api/clients coach client list route`).

---

## Step 1 — Implement the route

Create this file exactly:

**File:** `apps/web/app/api/client-activation/complete/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { createAnonServerClient } from '@coaching/supabase/auth-server'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const rawToken = (body as Record<string, unknown>)?.token
    const rawPassword = (body as Record<string, unknown>)?.password

    if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string' ||
        rawPassword === undefined || rawPassword === null || typeof rawPassword !== 'string') {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const token = rawToken.trim()
    const password = rawPassword

    if (token.length === 0) {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')

    const serviceClient = createServiceRoleClient()

    // Token lookup
    const { data: clientRow, error: clientLookupError } = await serviceClient
      .from('clients')
      .select('id, activation_expires_at')
      .eq('activation_token_hash', tokenHash)
      .single()

    if (clientLookupError || !clientRow) {
      return NextResponse.json({ error: 'Invalid or expired activation token' }, { status: 401 })
    }

    // Expiry check
    const expiresAt = clientRow.activation_expires_at
    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      return NextResponse.json({ error: 'Invalid or expired activation token' }, { status: 401 })
    }

    const clientId = clientRow.id

    // Fetch platform_users for status + email
    const { data: platformUser, error: puError } = await serviceClient
      .from('platform_users')
      .select('id, email, status')
      .eq('id', clientId)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Already-activated guard
    if (platformUser.status === 'active') {
      return NextResponse.json({ error: 'Already activated' }, { status: 409 })
    }
    if (platformUser.status === 'suspended' || platformUser.status === 'banned' || platformUser.status === 'deactivated') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'pending') {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 1: Set password
    const { error: passwordError } = await serviceClient.auth.admin.updateUserById(clientId, { password })
    if (passwordError) {
      const msg = passwordError.message ?? ''
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('weak')) {
        return NextResponse.json({ error: 'Password not accepted' }, { status: 422 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 2: Activate platform_users.status
    const { error: statusError } = await serviceClient
      .from('platform_users')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', clientId)
    if (statusError) {
      console.error('PARTIAL ACTIVATION — auth password set but platform_users.status not updated: ' + clientId)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 3: Clear token fields
    const { error: clearError } = await serviceClient
      .from('clients')
      .update({ activation_token_hash: null, activation_expires_at: null })
      .eq('id', clientId)
    if (clearError) {
      console.error('PARTIAL ACTIVATION — status active but token not cleared: ' + clientId)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 4: Sign in
    const anonClient = createAnonServerClient()
    const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: platformUser.email,
      password,
    })
    if (signInError || !sessionData.session) {
      console.error('ACTIVATION COMPLETE BUT SIGN-IN FAILED: ' + clientId)
      return NextResponse.json({ error: 'Activation completed but sign-in failed' }, { status: 500 })
    }

    return NextResponse.json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Step 2 — TypeScript typecheck

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
cd /e/Claude-project-Coaching-app-MVP
pnpm --filter web exec tsc --noEmit 2>&1
```

Expected: zero errors. Stop and report any type errors before proceeding.

---

## Step 3 — Build

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web build 2>&1
```

Expected: build completes, no errors. Stop and report any build errors before proceeding.

---

## Step 4 — Lint

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web lint 2>&1
```

Note: `next lint` may fail if `apps/web/.eslintrc.json` is missing (known non-blocking risk from T1-00). If it fails for that reason only, note it in the report and continue. Stop on any other lint error.

---

## Step 5 — Integration tests (conditional)

**Only run if `apps/web/.env.local` exists.** If it does not exist, skip this step entirely and note it in the final report.

Check:
```bash
ls /e/Claude-project-Coaching-app-MVP/apps/web/.env.local 2>&1
```

If the file exists, start the dev server and run the following curl tests:

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web dev &
sleep 5
```

**Test 1 — Missing body fields (400)**
```bash
curl -s -X POST http://localhost:3000/api/client-activation/complete \
  -H "Content-Type: application/json" \
  -d '{}' | python -m json.tool
```
Expected: `400 { "error": "token and password are required" }`

**Test 2 — Password too short (400)**
```bash
curl -s -X POST http://localhost:3000/api/client-activation/complete \
  -H "Content-Type: application/json" \
  -d '{"token":"sometoken","password":"short"}' | python -m json.tool
```
Expected: `400 { "error": "password must be at least 8 characters" }`

**Test 3 — Invalid token (401)**
```bash
curl -s -X POST http://localhost:3000/api/client-activation/complete \
  -H "Content-Type: application/json" \
  -d '{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","password":"TestPassword1!"}' | python -m json.tool
```
Expected: `401 { "error": "Invalid or expired activation token" }`

**Test 4 — Full happy path (requires a live pending client)**

Get a real activation token by calling POST /api/login (T1-02) with a coach account, then POST /api/clients/invite (T1-05) to create a pending client. Use the returned `activation_token` value.

```bash
# Substitute ACTIVATION_TOKEN from your local test setup
curl -s -X POST http://localhost:3000/api/client-activation/complete \
  -H "Content-Type: application/json" \
  -d '{"token":"<ACTIVATION_TOKEN>","password":"TestPassword1!"}' | python -m json.tool
```
Expected: `200 { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }`

**Test 5 — Re-submit same token after activation (409)**
Repeat Test 4 with the same token.
Expected: `409 { "error": "Already activated" }`

After tests, stop the dev server:
```bash
kill %1 2>/dev/null || true
```

---

## Step 6 — Update control docs

### PROJECT_STATE.md
- Change `Current Task` from `T1-07` to `T1-08`
- Add to the In Progress / Completed table:
  ```
  | T1-07 | POST /api/client-activation/complete | COMPLETE (2026-05-24) |
  ```
- Update `State as of` date to `2026-05-24`

### TASK_LOG.md
Append a new session entry:
```
## Session: 2026-05-24 — T1-07

Task: POST /api/client-activation/complete
File created: apps/web/app/api/client-activation/complete/route.ts
TypeScript: passed
Build: passed
Integration tests: [passed / skipped — .env.local missing]
Decisions locked: D-T1-07-01 through D-T1-07-11
Commit: [insert hash]
```

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Add `T1-07 COMPLETE` to the state summary line
- Update resume block: T1-00 through T1-07 COMPLETE, confirm before T1-08

---

## Step 7 — Commit

Stage only the files changed in this task:

```bash
git add \
  apps/web/app/api/client-activation/complete/route.ts \
  PROJECT_STATE.md \
  TASK_LOG.md \
  docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

Commit:
```bash
git commit -m "feat(api): add POST /api/client-activation/complete client activation route"
```

Push:
```bash
git push origin main
```

Verify:
```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

---

## Final report

Return:
1. TypeScript result (pass/fail)
2. Build result (pass/fail)
3. Lint result (pass/fail/skipped reason)
4. Integration test result (each test: pass/fail/skipped)
5. Commit hash
6. Any deviations from this prompt

Do not modify migrations, RLS policies, existing auth routes, or any file outside the list above.
Do not log or print the activation_token value.
Integration tests target LOCAL DEV ONLY — NEVER run against production.
