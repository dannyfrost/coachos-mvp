# T1-10 Claude IDE Implementation Prompt
# POST /api/storage/signed-download-url

**Task:** T1-10 — Storage Signed Download URL API Route
**Route:** POST /api/storage/signed-download-url
**Date:** 2026-05-24
**Status:** Ready for implementation — all decisions locked in DECISIONS.md (D-T1-10-01 through D-T1-10-13)

---

## Files to create

- `apps/web/app/api/storage/signed-download-url/route.ts`

## Files explicitly NOT to modify

- Any migration file (`supabase/migrations/`)
- Any RLS policy file
- `packages/supabase/database.types.ts`
- `apps/web/app/api/storage/signed-upload-url/` (already complete — do not touch)
- `apps/web/app/api/storage/delete-object/` (does not exist yet — do not create)
- Any existing route file
- `DECISIONS.md` — already updated by Claude CMD
- `PROJECT_STATE.md`, `TASK_LOG.md`, `CLAUDE_IDE_CONTEXT_HANDOFF.md` — update in Step 6 only

---

## Acceptance criteria

1. `POST /api/storage/signed-download-url` appears in the Next.js build route table
2. TypeScript: zero errors
3. Build: passes with no errors
4. Lint: passes (or fails only due to missing `.eslintrc.json` — known non-blocking)
5. Missing or wrong `Authorization: Bearer` → 401
6. Invalid JWT → 401
7. Non-active status → 403
8. Role not in (coach, client, assistant) → 403
9. Missing `path` body field → 400
10. Malformed path (not UUID/UUID/filename) → 403
11. Coach: pathCoachId ≠ auth.uid() → 403
12. Client: pathClientId ≠ auth.uid() → 403; pathCoachId ≠ clients.coach_id → 403
13. Assistant: no active staff_assignment for coach → 403; no client_staff_assignments row → 403
14. Happy path: returns `{ signed_url: string, path: string, expires_in: 300 }`

---

## Pre-flight

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

Expected: clean working tree. Latest commit is T1-09 (`feat(api): add POST /api/flash-cards/compute flash card hourly compute cron route`).

---

## Step 1 — Implement the route

Create this file exactly:

**File:** `apps/web/app/api/storage/signed-download-url/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

export async function POST(req: NextRequest) {
  try {
    // 1. Bearer token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    // 2. Validate token
    const anonClient = createAnonServerClient()
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Read caller identity
    const db = createUserClient(token)
    const { data: platformUser, error: puError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (
      platformUser.role_type !== 'coach' &&
      platformUser.role_type !== 'client' &&
      platformUser.role_type !== 'assistant'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }
    const rawPath = (body as Record<string, unknown>)?.path
    if (typeof rawPath !== 'string') {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    // 5. Path format validation
    const match = PATH_REGEX.exec(rawPath)
    if (!match) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [, pathCoachId, pathClientId] = match

    // 6. Role-based authorization
    if (platformUser.role_type === 'coach') {
      if (pathCoachId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (platformUser.role_type === 'client') {
      if (pathClientId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data: clientRow, error: clientError } = await db
        .from('clients')
        .select('coach_id')
        .eq('id', user.id)
        .single()
      if (clientError || !clientRow || pathCoachId !== clientRow.coach_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // assistant
      // staff_assignments uses user_id (not staff_id) per 002_create_tables.sql
      const { data: staffAssignment, error: saError } = await db
        .from('staff_assignments')
        .select('coach_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (saError || !staffAssignment || pathCoachId !== staffAssignment.coach_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // client_staff_assignments uses staff_id per 002_create_tables.sql
      const { data: csaRow, error: csaError } = await db
        .from('client_staff_assignments')
        .select('client_id')
        .eq('staff_id', user.id)
        .eq('client_id', pathClientId)
        .maybeSingle()
      if (csaError || !csaRow) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 7. Generate signed download URL (service role, TTL 300s)
    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage
      .from('tenant-media')
      .createSignedUrl(rawPath, 300)
    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      path: rawPath,
      expires_in: 300,
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

Expected: build completes, no errors. Confirm `/api/storage/signed-download-url` appears in the route table output. Stop and report any build errors before proceeding.

---

## Step 4 — Lint

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web lint 2>&1
```

Note: `next lint` may fail if `apps/web/.eslintrc.json` is missing (known non-blocking). If it fails for that reason only, note and continue. Stop on any other lint error.

---

## Step 5 — Integration tests (conditional)

**Only run if `apps/web/.env.local` exists.** If not, skip and note in the final report.

```bash
ls /e/Claude-project-Coaching-app-MVP/apps/web/.env.local 2>&1
```

If the file exists, start the dev server:

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web dev &
sleep 5
```

**Test 1 — No Authorization header (401)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Content-Type: application/json" \
  -d '{"path":"a/b/c.jpg"}' | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 2 — Invalid JWT (401)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Authorization: Bearer invalidtoken" \
  -H "Content-Type: application/json" \
  -d '{"path":"a/b/c.jpg"}' | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 3 — Missing path (400)**
Obtain a valid coach JWT first (log in with POST /api/login). Then:
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Authorization: Bearer <COACH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | python -m json.tool
```
Expected: `400 { "error": "path is required" }`

**Test 4 — Malformed path (403)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Authorization: Bearer <COACH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"not-a-valid-path/file.jpg"}' | python -m json.tool
```
Expected: `403 { "error": "Forbidden" }`

**Test 5 — Coach wrong pathCoachId (403)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Authorization: Bearer <COACH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"00000000-0000-0000-0000-000000000000/<CLIENT_ID>/test.jpg"}' | python -m json.tool
```
Expected: `403 { "error": "Forbidden" }`

**Test 6 — Coach happy path (200)**
Use real coach_id and a client_id from local DB:
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-download-url \
  -H "Authorization: Bearer <COACH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"<COACH_ID>/<CLIENT_ID>/meal-2026-05-24.jpg"}' | python -m json.tool
```
Expected: `200 { "signed_url": "https://...", "path": "<COACH_ID>/<CLIENT_ID>/meal-2026-05-24.jpg", "expires_in": 300 }`

Note: Storage returns a signed URL even if the object does not exist in the bucket — that is correct behavior.

After tests, stop the dev server:
```bash
kill %1 2>/dev/null || true
```

---

## Step 6 — Update control docs

### PROJECT_STATE.md
- Change `Current Task` from `T1-10` to `T1-11`
- Add to the completed table:
  ```
  | T1-10 | POST /api/storage/signed-download-url | COMPLETE (2026-05-24) |
  ```
- Update `State as of` date to `2026-05-24`

### TASK_LOG.md
Append:
```
## Session: 2026-05-24 — T1-10

Task: POST /api/storage/signed-download-url
File created: apps/web/app/api/storage/signed-download-url/route.ts
TypeScript: passed
Build: passed — /api/storage/signed-download-url in route table
Lint: [passed / skipped reason]
Integration tests: [passed / skipped — .env.local missing]
Decisions locked: D-T1-10-01 through D-T1-10-13
Commit: [insert hash]
```

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Add `T1-10 COMPLETE` to the state summary line
- Update resume block: T1-00 through T1-10 COMPLETE, confirm before T1-11

---

## Step 7 — Commit

```bash
git add \
  apps/web/app/api/storage/signed-download-url/route.ts \
  PROJECT_STATE.md \
  TASK_LOG.md \
  docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

```bash
git commit -m "feat(api): add POST /api/storage/signed-download-url signed download URL route"
```

```bash
git push origin main
```

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

---

## Final report

Return:
1. TypeScript result (pass/fail)
2. Build result (pass/fail) — confirm route in build output
3. Lint result (pass/fail/skipped reason)
4. Integration test result (each test: pass/fail/skipped + reason)
5. Commit hash
6. Any deviations from this prompt

Do not modify migrations, RLS policies, database.types.ts, or any file outside the list above.
Do not implement delete-object or any other route.
Do not expose the service role key.
Integration tests target LOCAL DEV ONLY — NEVER run against production.
