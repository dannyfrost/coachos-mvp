# T1-09 Claude IDE Implementation Prompt
# POST /api/flash-cards/compute

**Task:** T1-09 — Flash Card Compute Cron Route
**Route:** POST /api/flash-cards/compute
**Date:** 2026-05-24
**Status:** Ready for implementation — all decisions locked in DECISIONS.md (D-T1-09-01 through D-T1-09-13)

---

## Files to create

- `apps/web/app/api/flash-cards/compute/route.ts`

## Files explicitly NOT to modify

- Any migration file (`supabase/migrations/`)
- Any RLS policy file
- `packages/supabase/database.types.ts`
- `apps/web/app/api/flash-cards/compute-all/` (does not exist — do not create)
- Any existing route file
- `DECISIONS.md` — already updated by Claude CMD
- `PROJECT_STATE.md`, `TASK_LOG.md`, `CLAUDE_IDE_CONTEXT_HANDOFF.md` — update in Step 6 only

---

## Acceptance criteria

1. `POST /api/flash-cards/compute` appears in the Next.js build route table
2. TypeScript: zero errors
3. Build: passes with no errors
4. Lint: passes (or fails only due to missing `.eslintrc.json` — known non-blocking)
5. Missing or wrong `Authorization: Bearer` → 401
6. Missing `CRON_SECRET` env var → 401 (route fails closed)
7. Paused clients produce `yellow / client paused` flash card upsert
8. `flash_cards.notes` is never written
9. Per-client error continues the loop, increments `errors` counter, does not abort
10. Response: `{ "processed": <number>, "errors": <number> }`

---

## Pre-flight

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

Expected: clean working tree. Latest commit is T1-08 (`feat(api): add POST /api/storage/signed-upload-url client meal-photo upload route`).

---

## Step 1 — Implement the route

Create this file exactly:

**File:** `apps/web/app/api/flash-cards/compute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

function getIntSetting(settings: unknown, key: string, fallback: number): number {
  if (settings !== null && typeof settings === 'object' && !Array.isArray(settings)) {
    const val = (settings as Record<string, unknown>)[key]
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) return Math.floor(val)
  }
  return fallback
}

export async function POST(req: NextRequest) {
  // 1. Cron secret auth
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (
    !cronSecret ||
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    authHeader.slice(7) !== cronSecret
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  const utcToday = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

  // 2. Fetch all client rows
  const { data: clientRows, error: clientsError } = await serviceClient
    .from('clients')
    .select('id, coach_id')
  if (clientsError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const allClientIds = (clientRows ?? []).map(c => c.id)
  if (allClientIds.length === 0) {
    return NextResponse.json({ processed: 0, errors: 0 })
  }

  // 3. Filter to active/paused only
  const { data: puRows, error: puError } = await serviceClient
    .from('platform_users')
    .select('id, status')
    .in('id', allClientIds)
    .in('status', ['active', 'paused'])
  if (puError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const clientCoachMap = new Map((clientRows ?? []).map(c => [c.id, c.coach_id]))
  const qualifyingClients = (puRows ?? [])
    .map(pu => ({
      id: pu.id,
      status: pu.status as string,
      coachId: clientCoachMap.get(pu.id) ?? '',
    }))
    .filter(c => c.coachId !== '')

  if (qualifyingClients.length === 0) {
    return NextResponse.json({ processed: 0, errors: 0 })
  }

  // 4. Fetch coach settings for all relevant coaches
  const coachIds = [...new Set(qualifyingClients.map(c => c.coachId))]
  const { data: coachRows, error: coachesError } = await serviceClient
    .from('coaches')
    .select('id, settings')
    .in('id', coachIds)
  if (coachesError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const coachSettingsMap = new Map<string, unknown>(
    (coachRows ?? []).map(c => [c.id, c.settings])
  )

  let processed = 0
  let errors = 0

  for (const client of qualifyingClients) {
    const { id: clientId, status: clientStatus, coachId } = client

    try {
      const settings = coachSettingsMap.get(coachId) ?? {}
      const warningDays = getIntSetting(settings, 'absence_warning_days', 2)
      const criticalDays = getIntSetting(settings, 'absence_critical_days', 4)
      const stagnationDays = getIntSetting(settings, 'weight_stagnation_days', 7)

      let fcStatus: 'green' | 'yellow' | 'red'
      let fcReason: string
      let fcInterpretation: string | null
      let fcLastLogAt: string | null = null

      if (clientStatus === 'paused') {
        fcStatus = 'yellow'
        fcReason = 'client paused'
        fcInterpretation = null
      } else {
        // Latest daily log
        const { data: latestLog } = await serviceClient
          .from('daily_logs')
          .select('log_date, created_at')
          .eq('client_id', clientId)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!latestLog) {
          fcStatus = 'red'
          fcReason = 'no check-ins recorded'
          fcInterpretation = 'no data available'
        } else {
          fcLastLogAt = latestLog.created_at
          const daysAbsent = Math.floor(
            (new Date(utcToday).getTime() - new Date(latestLog.log_date).getTime()) /
            (1000 * 60 * 60 * 24)
          )

          if (daysAbsent > criticalDays) {
            fcStatus = 'red'
            fcReason = `no check-in for ${daysAbsent} days`
            fcInterpretation = 'extended absence detected'
          } else if (daysAbsent > warningDays) {
            fcStatus = 'yellow'
            fcReason = `missed check-in for ${daysAbsent} days`
            fcInterpretation = 'absence warning threshold reached'
          } else {
            // Weight stagnation check
            const windowStart = new Date(
              new Date(utcToday).getTime() - stagnationDays * 24 * 60 * 60 * 1000
            ).toISOString().slice(0, 10)

            const { data: weightLogs } = await serviceClient
              .from('daily_logs')
              .select('weight')
              .eq('client_id', clientId)
              .gte('log_date', windowStart)
              .not('weight', 'is', null)

            const weights = (weightLogs ?? [])
              .map(r => r.weight)
              .filter((w): w is number => typeof w === 'number')
            const uniqueWeights = new Set(weights)

            if (weights.length >= stagnationDays && uniqueWeights.size === 1) {
              fcStatus = 'yellow'
              fcReason = `weight unchanged for ${stagnationDays} days`
              fcInterpretation = 'stagnation despite compliance'
            } else {
              fcStatus = 'green'
              fcReason = 'on track'
              fcInterpretation = null
            }
          }
        }
      }

      // Food summary: last 3 non-null meal descriptions
      const { data: foodLogs } = await serviceClient
        .from('daily_logs')
        .select('meal_description')
        .eq('client_id', clientId)
        .not('meal_description', 'is', null)
        .order('log_date', { ascending: false })
        .limit(3)

      const descriptions = (foodLogs ?? [])
        .map(r => r.meal_description as string)
        .filter(Boolean)
      const fcFoodSummary = descriptions.length > 0 ? descriptions.join(' | ') : null

      // Upsert flash card — never touch notes
      const { error: upsertError } = await serviceClient
        .from('flash_cards')
        .upsert(
          {
            client_id: clientId,
            coach_id: coachId,
            status: fcStatus,
            reason: fcReason,
            food_summary: fcFoodSummary,
            interpretation: fcInterpretation,
            last_log_at: fcLastLogAt,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' }
        )

      if (upsertError) {
        console.error('FLASH CARD COMPUTE FAILED for client: ' + clientId, upsertError)
        errors++
      } else {
        processed++
      }
    } catch (err) {
      console.error('FLASH CARD COMPUTE FAILED for client: ' + clientId, err)
      errors++
    }
  }

  return NextResponse.json({ processed, errors })
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

Expected: build completes, no errors. Confirm `/api/flash-cards/compute` appears in the route table. Stop and report any build errors before proceeding.

---

## Step 4 — Lint

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web lint 2>&1
```

Note: `next lint` may fail if `apps/web/.eslintrc.json` is missing (known non-blocking). If it fails for that reason only, note and continue. Stop on any other lint error.

---

## Step 5 — Integration tests (conditional)

**Only run if `apps/web/.env.local` exists AND defines `CRON_SECRET`.** If not, skip and note in the final report.

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
curl -s -X POST http://localhost:3000/api/flash-cards/compute | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 2 — Wrong cron secret (401)**
```bash
curl -s -X POST http://localhost:3000/api/flash-cards/compute \
  -H "Authorization: Bearer wrongsecret" | python -m json.tool
```
Expected: `401 { "error": "Unauthorized" }`

**Test 3 — Correct secret (200)**
Substitute `<CRON_SECRET>` from `.env.local`:
```bash
curl -s -X POST http://localhost:3000/api/flash-cards/compute \
  -H "Authorization: Bearer <CRON_SECRET>" | python -m json.tool
```
Expected: `200 { "processed": <number>, "errors": 0 }`

If no active/paused clients exist in local DB: `200 { "processed": 0, "errors": 0 }` — valid.

After tests, stop the dev server:
```bash
kill %1 2>/dev/null || true
```

---

## Step 6 — Update control docs

### PROJECT_STATE.md
- Change `Current Task` from `T1-09` to `T1-10`
- Add to the completed table:
  ```
  | T1-09 | POST /api/flash-cards/compute | COMPLETE (2026-05-24) |
  ```
- Update `State as of` date to `2026-05-24`

### TASK_LOG.md
Append:
```
## Session: 2026-05-24 — T1-09

Task: POST /api/flash-cards/compute
File created: apps/web/app/api/flash-cards/compute/route.ts
TypeScript: passed
Build: passed — /api/flash-cards/compute in route table
Lint: [passed / skipped reason]
Integration tests: [passed / skipped — .env.local missing / CRON_SECRET not set]
Decisions locked: D-T1-09-01 through D-T1-09-13
Commit: [insert hash]
```

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Add `T1-09 COMPLETE` to the state summary line
- Update resume block: T1-00 through T1-09 COMPLETE, confirm before T1-10

---

## Step 7 — Commit

```bash
git add \
  apps/web/app/api/flash-cards/compute/route.ts \
  PROJECT_STATE.md \
  TASK_LOG.md \
  docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

```bash
git commit -m "feat(api): add POST /api/flash-cards/compute flash card hourly compute cron route"
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
Do not call refresh_flash_card RPC.
Do not implement compute-all or any other route.
Do not write or overwrite flash_cards.notes under any condition.
Integration tests target LOCAL DEV ONLY — NEVER run against production.
