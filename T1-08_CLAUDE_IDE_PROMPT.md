# T1-08 Claude IDE Implementation Prompt
# POST /api/storage/signed-upload-url

**Task:** T1-08 — Storage Signed Upload URL API Route
**Route:** POST /api/storage/signed-upload-url
**Date:** 2026-05-24
**Status:** Ready for implementation — all decisions locked in DECISIONS.md (D-T1-08-01 through D-T1-08-12)

---

## Files to create

- `apps/web/app/api/storage/signed-upload-url/route.ts`

## Files explicitly NOT to modify

- Any migration file (`supabase/migrations/`)
- Any RLS policy file
- `packages/supabase/database.types.ts`
- `apps/web/app/api/storage/signed-download-url/` (does not exist yet — do not create)
- `apps/web/app/api/storage/delete-object/` (does not exist yet — do not create)
- Any existing route file (`signup`, `login`, `me`, `workspace`, `clients/*`, `client-activation/*`)
- `DECISIONS.md` — already updated by Claude CMD
- `PROJECT_STATE.md`, `TASK_LOG.md`, `CLAUDE_IDE_CONTEXT_HANDOFF.md` — update in Step 6 only

---

## Acceptance criteria

1. `POST /api/storage/signed-upload-url` appears in the Next.js build route table
2. TypeScript: zero errors
3. Build: passes with no errors
4. Lint: passes (or fails only due to missing `.eslintrc.json` — that known non-blocking issue)
5. Route rejects all unauthenticated requests with 401
6. Route rejects non-client roles with 403
7. Route rejects inactive clients with 403
8. Route validates path format and ID ownership — mismatches return 403
9. Route validates content_type — only `image/jpeg` and `image/png` accepted
10. Route validates declared size — max 5,242,880 bytes
11. Route calls `createSignedUploadUrl` on `tenant-media` bucket via service role only
12. Response shape: `{ signed_url: string, path: string, expires_in: null }`

---

## Pre-flight (run before writing any code)

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

Expected: clean working tree. Latest commit is T1-07 (`feat(api): add POST /api/client-activation/complete client activation route`).

---

## Step 1 — Implement the route

Create this file exactly:

**File:** `apps/web/app/api/storage/signed-upload-url/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const
const MAX_SIZE_BYTES = 5_242_880

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

    // 3. Role + status check
    const db = createUserClient(token)
    const { data: platformUser, error: puError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.role_type !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'path, content_type, and size are required' }, { status: 400 })
    }

    const rawPath = (body as Record<string, unknown>)?.path
    const rawContentType = (body as Record<string, unknown>)?.content_type
    const rawSize = (body as Record<string, unknown>)?.size

    if (typeof rawPath !== 'string' || typeof rawContentType !== 'string' || typeof rawSize !== 'number') {
      return NextResponse.json({ error: 'path, content_type, and size are required' }, { status: 400 })
    }

    // 5. Content type validation
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(rawContentType)) {
      return NextResponse.json({ error: 'content_type must be image/jpeg or image/png' }, { status: 400 })
    }

    // 6. Size validation
    if (rawSize <= 0 || rawSize > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'size must not exceed 5MB' }, { status: 400 })
    }

    // 7. Path format + ownership validation
    const match = PATH_REGEX.exec(rawPath)
    if (!match) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [, pathCoachId, pathClientId] = match

    if (pathClientId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 8. Verify coach_id matches caller's actual coach
    const { data: clientRow, error: clientError } = await db
      .from('clients')
      .select('coach_id')
      .eq('id', user.id)
      .single()

    if (clientError || !clientRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (pathCoachId !== clientRow.coach_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 9. Generate signed upload URL (service role)
    // createSignedUploadUrl in storage-js 2.105.4 has no TTL option; expires_in not exposed by SDK
    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage
      .from('tenant-media')
      .createSignedUploadUrl(rawPath, { upsert: false })

    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      path: urlData.path,
      expires_in: null,
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

Expected: build completes, no errors. Confirm `/api/storage/signed-upload-url` appears in the route table output. Stop and report any build errors before proceeding.

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
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Content-Type: application/json" \
  -d '{"path":"a/b/c.jpg","content_type":"image/jpeg","size":1024}' | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 2 — Invalid JWT (401)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer invalidtoken" \
  -H "Content-Type: application/json" \
  -d '{"path":"a/b/c.jpg","content_type":"image/jpeg","size":1024}' | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 3 — Missing body fields (400)**
Obtain a valid client JWT first (log in with an active client account). Then:
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | python -m json.tool
```
Expected: `400 { "error": "path, content_type, and size are required" }`

**Test 4 — Invalid content_type (400)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"<COACH_ID>/<CLIENT_ID>/test.gif","content_type":"image/gif","size":1024}' | python -m json.tool
```
Expected: `400 { "error": "content_type must be image/jpeg or image/png" }`

**Test 5 — Oversized declared size (400)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"<COACH_ID>/<CLIENT_ID>/test.jpg","content_type":"image/jpeg","size":6000000}' | python -m json.tool
```
Expected: `400 { "error": "size must not exceed 5MB" }`

**Test 6 — Wrong client_id in path (403)**
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"<COACH_ID>/00000000-0000-0000-0000-000000000000/test.jpg","content_type":"image/jpeg","size":1024}' | python -m json.tool
```
Expected: `403 { "error": "Forbidden" }`

**Test 7 — Happy path (200)**
Use real coach_id and client_id from local DB for an active client:
```bash
curl -s -X POST http://localhost:3000/api/storage/signed-upload-url \
  -H "Authorization: Bearer <CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"<COACH_ID>/<CLIENT_ID>/meal-2026-05-24.jpg","content_type":"image/jpeg","size":102400}' | python -m json.tool
```
Expected: `200 { "signed_url": "https://...", "path": "<COACH_ID>/<CLIENT_ID>/meal-2026-05-24.jpg", "expires_in": null }`

After tests, stop the dev server:
```bash
kill %1 2>/dev/null || true
```

---

## Step 6 — Update control docs

### PROJECT_STATE.md
- Change `Current Task` from `T1-08` to `T1-09`
- Add to the completed table:
  ```
  | T1-08 | POST /api/storage/signed-upload-url | COMPLETE (2026-05-24) |
  ```
- Update `State as of` date to `2026-05-24`

### TASK_LOG.md
Append a new session entry:
```
## Session: 2026-05-24 — T1-08

Task: POST /api/storage/signed-upload-url
File created: apps/web/app/api/storage/signed-upload-url/route.ts
TypeScript: passed
Build: passed — /api/storage/signed-upload-url in route table
Lint: [passed / skipped reason]
Integration tests: [passed / skipped — .env.local missing]
Decisions locked: D-T1-08-01 through D-T1-08-12
Commit: [insert hash]
```

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Add `T1-08 COMPLETE` to the state summary line
- Update resume block: T1-00 through T1-08 COMPLETE, confirm before T1-09

---

## Step 7 — Commit

Stage only the files changed in this task:

```bash
git add \
  apps/web/app/api/storage/signed-upload-url/route.ts \
  PROJECT_STATE.md \
  TASK_LOG.md \
  docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

Commit:
```bash
git commit -m "feat(api): add POST /api/storage/signed-upload-url client meal-photo upload route"
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
2. Build result (pass/fail) — include whether route appears in build output
3. Lint result (pass/fail/skipped reason)
4. Integration test result (each test: pass/fail/skipped)
5. Commit hash
6. Any deviations from this prompt

Do not modify migrations, RLS policies, database.types.ts, or any file outside the list above.
Do not implement signed-download-url, delete-object, or any other route.
Integration tests target LOCAL DEV ONLY — NEVER run against production.
