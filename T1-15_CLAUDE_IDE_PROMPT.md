Implement T1-15 — Coach Client Profile Screen (/clients/[id]).

Read this entire file before doing anything. Follow every instruction exactly. Stop and report if any step fails.

---

## CONTEXT

You are Claude IDE implementing T1-15 for the Coaching Platform MVP monorepo (pnpm + Turborepo).

Repo: E:\Claude-project-Coaching-app-MVP
pnpm binary: C:\Users\reda-\AppData\Roaming\npm\pnpm

Completed before this task:
- T1-00: Next.js 14 App Router scaffold, Turborepo, Supabase client utilities
- T1-01: POST /api/signup
- T1-02: POST /api/login
- T1-03: GET /api/me
- T1-04: PATCH /api/workspace
- T1-05: POST /api/clients/invite
- T1-06: GET /api/clients
- T1-07: POST /api/client-activation/complete
- T1-08: POST /api/storage/signed-upload-url
- T1-09: POST /api/flash-cards/compute
- T1-10: POST /api/storage/signed-download-url
- T1-11: /login + /dashboard web screens
- T1-12: /clients coach client list + invite modal
- T1-13: Expo mobile scaffold + activation screen
- T1-14: Mobile daily logging screen with photo upload (commit 0de5b2f)

What T1-15 builds:
- Three new files under apps/web/app/(coach)/clients/[id]/
- Fixes the current /clients/[id] 404 (ClientsClient.tsx already links to this route)
- Coach reads client header, status, subscription, flash card, daily log timeline
- Coach can pause/unpause client and edit flash-card notes

---

## WORKING TREE NOTE

git status will show one untracked directory:

    ?? claude agents/

This is a pre-existing local Claude tooling artifact. It is NOT a T1-15 artifact. Do not stage it, do not commit it, do not modify it. Report it as "pre-existing untracked local tooling" in your final report. The T1-15 commit must not contain this directory.

---

## STEP 0 — PRE-FLIGHT

Run each command and report full output before proceeding.

```
git --no-pager status --short
```
Expected: no staged files; one untracked entry `?? "claude agents/"` is acceptable and expected. No other untracked or modified files.

```
git --no-pager log --oneline -3
```
Expected: latest commit is `0de5b2f feat(mobile): implement daily logging screen with photo upload (T1-14)`.

If git status shows any other untracked or modified files, stop and report before proceeding.

---

## STEP 1 — READ EXISTING FILES (read-only, do not modify)

Read the following files in full before writing any code. Do not modify them.

### 1a. Supabase server client helper

Read: `packages/supabase/ssr-server.ts`

Confirm `createSupabaseServerClient` is exported and accepts a `{ getAll, setAll }` cookie adapter.

### 1b. Supabase browser client helper

Read: `packages/supabase/browser.ts` (or the equivalent browser client export)

Confirm the browser client export name.

### 1c. Service role client helper

Read: `packages/supabase/server.ts`

Confirm `createServiceRoleClient` is exported with no arguments.

### 1d. RPC signatures

Read: `packages/supabase/database.types.ts`

Locate and confirm exact parameter names for:

```
pause_client            → Args: { p_client_id: string }
unpause_client          → Args: { p_client_id: string }
update_flash_card_notes → Args: { p_card_id: string; p_notes: string }
```

If any parameter name differs from the above, stop and report the actual names before implementing.

### 1e. Coach layout for auth pattern

Read: `apps/web/app/(coach)/layout.tsx`

Confirm it exists and provides the auth context for the (coach) group.

### 1f. Existing /clients page for import shape

Read: `apps/web/app/(coach)/clients/page.tsx`

Note the cookie adapter pattern used with `createSupabaseServerClient` — reuse exactly the same pattern in page.tsx.

### 1g. Existing client row type

Read: `apps/web/app/(coach)/clients/_components/ClientsClient.tsx` (do not modify)

Note the `ClientRow` type exported from this file. You may import it for reference but must define your own local types in the new [id] files — do not modify ClientsClient.tsx.

### 1h. Confirm /clients/[id] does not exist yet

Confirm that `apps/web/app/(coach)/clients/[id]/` does not exist. If it does, stop and report before proceeding.

---

## STEP 2 — CREATE loading.tsx

Create: `apps/web/app/(coach)/clients/[id]/loading.tsx`

Skeleton that matches the page structure. Use Tailwind `animate-pulse` classes.

```tsx
export default function ClientProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header skeleton */}
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />

      {/* Flash card skeleton */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Log timeline skeleton */}
      <div className="border rounded-lg p-4 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
```

---

## STEP 3 — CREATE page.tsx (server component)

Create: `apps/web/app/(coach)/clients/[id]/page.tsx`

### 3a — Imports

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server';
import { createServiceRoleClient } from '@coaching/supabase/server';
import ClientProfileClient from './_components/ClientProfileClient';
```

Use the exact cookie adapter pattern from `apps/web/app/(coach)/clients/page.tsx` (verified in Step 1f).

### 3b — Auth check

```ts
const cookieStore = cookies();
const supabase = createSupabaseServerClient({
  getAll() { return cookieStore.getAll(); },
  setAll() {},
});

const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login');
```

### 3c — Ownership check

```ts
const { data: clientRow, error: clientError } = await supabase
  .from('clients')
  .select('id, coach_id, onboarding_completed, created_at')
  .eq('id', params.id)
  .eq('coach_id', user.id)
  .single();

if (clientError || !clientRow) redirect('/clients');
```

### 3d — Parallel data fetch

After ownership verified, fetch remaining data in parallel using Promise.all. All queries use the same session-scoped `supabase` client (not service role).

```ts
const [
  { data: platformUser },
  { data: subscription },
  { data: flashCard },
  { data: logs },
] = await Promise.all([
  supabase
    .from('platform_users')
    .select('full_name, email, status, created_at')
    .eq('id', params.id)
    .single(),

  supabase
    .from('client_subscriptions')
    .select('status, start_date, end_date')
    .eq('client_id', params.id)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle(),

  supabase
    .from('flash_cards')
    .select('id, status, last_log_at, computed_at, notes')
    .eq('client_id', params.id)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle(),

  supabase
    .from('daily_logs')
    .select('id, log_date, steps, weight, meal_description, meal_photo_key, questions')
    .eq('client_id', params.id)
    .order('log_date', { ascending: false })
    .limit(30),
]);
```

If `platformUser` is null after the parallel fetch, redirect to `/clients`.

### 3e — Signed URLs for meal photos

After logs are fetched, batch-generate signed URLs using the service role client. Service role is used only here — not for any app table reads.

```ts
const photoKeys = (logs ?? [])
  .map(l => l.meal_photo_key)
  .filter((k): k is string => k !== null && k !== undefined);

const photoUrlMap: Record<string, string> = {};

if (photoKeys.length > 0) {
  const serviceClient = createServiceRoleClient();
  const { data: signedUrls } = await serviceClient
    .storage
    .from('tenant-media')
    .createSignedUrls(photoKeys, 300);

  signedUrls?.forEach(({ path, signedUrl }) => {
    if (path && signedUrl) photoUrlMap[path] = signedUrl;
  });
}
```

If `createSignedUrls` is not available in the installed version of `@supabase/supabase-js`, fall back to:

```ts
await Promise.all(
  photoKeys.map(async (key) => {
    const { data } = await serviceClient
      .storage
      .from('tenant-media')
      .createSignedUrl(key, 300);
    if (data?.signedUrl) photoUrlMap[key] = data.signedUrl;
  })
);
```

Check the installed version first before deciding which path to use.

### 3f — Render

Pass all data as serializable props to `<ClientProfileClient />`:

```tsx
return (
  <ClientProfileClient
    clientId={clientRow.id}
    clientCreatedAt={clientRow.created_at}
    onboardingCompleted={clientRow.onboarding_completed}
    platformUser={platformUser}
    subscription={subscription ?? null}
    flashCard={flashCard ?? null}
    logs={logs ?? []}
    photoUrlMap={photoUrlMap}
  />
);
```

Define prop types inline in page.tsx or in the same file as ClientProfileClient — do not export types to shared packages.

---

## STEP 4 — CREATE ClientProfileClient.tsx (client component)

Create: `apps/web/app/(coach)/clients/[id]/_components/ClientProfileClient.tsx`

This is a `'use client'` component.

### 4a — Type definitions

Define all necessary types locally. Example:

```ts
type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type FlashStatus = 'green' | 'yellow' | 'red';
type SubStatus = 'active' | 'expired' | 'overdue';
```

### 4b — Imports

```tsx
'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@coaching/supabase/browser';
```

Use the browser client export name confirmed in Step 1b. Do not import from server packages.

### 4c — Section 1: Client header

Show:
- `platformUser.full_name` as the page heading
- `platformUser.email` as subtext
- Status badge (see badge helper below)
- Subscription badge if `subscription !== null` (see badge helper below)
- "Member since [formatted date]" from `clientCreatedAt`

Status badge colors:
```
active      → green-100 / green-800
pending     → blue-100 / blue-800
paused      → yellow-100 / yellow-800
suspended   → red-100 / red-800
banned      → red-100 / red-800
deactivated → gray-100 / gray-800
```

Subscription badge colors:
```
active  → green-100 / green-800
expired → red-100 / red-800
overdue → yellow-100 / yellow-800
```

### 4d — Section 2: Quick actions (pause/unpause)

Use exact verified RPC signatures:
- `supabase.rpc('pause_client', { p_client_id: clientId })`
- `supabase.rpc('unpause_client', { p_client_id: clientId })`

Button visibility rules:
- `status === 'active'` → show "Pause client" button only
- `status === 'paused'` → show "Unpause client" button only
- any other status → show neither button

State management:
- Keep a local `displayStatus` state initialized from `platformUser.status`
- On RPC success: update `displayStatus` to the new status
- On RPC error: show inline error message below the action area
- Show a loading spinner while the RPC is in flight; disable the button

### 4e — Section 3: Flash card

If `flashCard === null`:
```tsx
<p className="text-sm text-gray-500">Flash card data not yet computed.</p>
```
Notes field is hidden when flashCard is null.

If `flashCard` exists, show:
- Flash status badge using same badge pattern as user status
- `last_log_at` formatted as date (or "—" if null)
- `computed_at` formatted as date (or "—" if null)
- Notes textarea pre-filled with `flashCard.notes ?? ''`
- "Save notes" button

Notes save:
```ts
await supabase.rpc('update_flash_card_notes', {
  p_card_id: flashCard.id,
  p_notes: notesValue,
})
```
- No auto-save. Explicit button only.
- Success: show "Saved ✓" inline for 2 seconds, then clear.
- Error: show inline error message below textarea.
- Disable button while save is in flight.

### 4f — Section 4: Daily log timeline

If `logs.length === 0`:
```tsx
<p className="text-sm text-gray-500">No logs recorded yet.</p>
```

If logs exist, render a table or list with one row per entry:

| Column | Value |
|--------|-------|
| Date | `log.log_date` formatted as "DD Mon YYYY" |
| Steps | `log.steps ?? '—'` |
| Weight | `log.weight != null ? log.weight.toFixed(1) + ' kg' : '—'` |
| Meal | `log.meal_description` truncated to 80 chars (append "…" if truncated) |
| Photo | thumbnail or placeholder (see 4g) |
| Questions | `log.questions` truncated to 60 chars (append "…" if truncated) |

### 4g — Photo thumbnails

For each log row:
- If `photoUrlMap[log.meal_photo_key]` exists: render `<img>` at 60×60, object-cover, cursor-pointer; onClick opens lightbox
- If `log.meal_photo_key` exists but no URL in map: render gray placeholder div (60×60, `bg-gray-100`)
- If `log.meal_photo_key` is null: render nothing (empty cell)

Use plain `<img>` tag — do NOT use `next/image`. Signed URLs have 300s TTL; next/image caching is incorrect here.

### 4h — Photo lightbox

Client state: `const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);`

When `lightboxUrl !== null`, render a fixed full-screen overlay:
```tsx
<div
  className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
  onClick={() => setLightboxUrl(null)}
>
  <img
    src={lightboxUrl}
    alt="Meal photo"
    className="max-h-screen max-w-screen-md object-contain"
    onClick={(e) => e.stopPropagation()}
  />
  <button
    className="absolute top-4 right-4 text-white text-2xl"
    onClick={() => setLightboxUrl(null)}
  >
    ✕
  </button>
</div>
```

---

## STEP 5 — TYPECHECK AND BUILD

Run each command and report full output:

```
Set-Location "E:\Claude-project-Coaching-app-MVP"; C:\Users\reda-\AppData\Roaming\npm\pnpm --filter web exec tsc --noEmit
```
Expected: zero errors.

```
Set-Location "E:\Claude-project-Coaching-app-MVP"; C:\Users\reda-\AppData\Roaming\npm\pnpm --filter web build
```
Expected: build passes. Verify `/clients/[id]` appears in the route table output.

```
Set-Location "E:\Claude-project-Coaching-app-MVP"; C:\Users\reda-\AppData\Roaming\npm\pnpm --filter web lint
```
Expected: passes, or only the known non-blocking .eslintrc.json issue from T1-00.

Fix any TypeScript or build errors before proceeding to Step 6. Do not proceed with a failing typecheck.

---

## STEP 6 — UPDATE CONTROL DOCS

Update the following three files:

### PROJECT_STATE.md
- Add T1-15 row to Completed Tasks table
- Update "Current Task" to T1-16 — NEXT
- Update "In Progress" to: `_None. T1-15 complete 2026-05-24. Awaiting founder approval for T1-16._`
- Add T1-15 verification log entry

### TASK_LOG.md
- Add T1-15 session entry following the existing format:
  - Task ID, description, agent, status
  - What ran (commands, file operations)
  - Artifacts produced (files created)
  - Deviations (if any)
  - TypeScript result
  - Build result
  - Lint result
  - Integration test status
  - Commit hash (after commit)

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Update to reflect T1-15 complete
- Note current HEAD commit
- Note deferred verification backlog (carry forward from T1-14 handoff)

---

## STEP 7 — COMMIT

```
git --no-pager status --short
```
Verify:
- Only T1-15 files staged or untracked (plus control docs)
- `claude agents/` is NOT staged — must remain in `??` untracked state
- No migration files modified

Stage only the new T1-15 files and control docs:
```
git add apps/web/app/(coach)/clients/[id]/
git add PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
git add DECISIONS.md
```

Commit:
```
git commit -m "feat(web): add /clients/[id] coach client profile screen (T1-15)"
```

Do NOT push. Do NOT add `claude agents/` to the commit.

---

## STEP 8 — FINAL REPORT

Report exactly:

| Check | Result |
|-------|--------|
| Git status before work | |
| Commit before work | `0de5b2f` |
| createSignedUrls available | PASS / FALLBACK (state which) |
| page.tsx created | PASS |
| loading.tsx created | PASS |
| ClientProfileClient.tsx created | PASS |
| TypeScript (tsc --noEmit) | PASS / FAIL |
| Build | PASS / FAIL |
| /clients/[id] in route table | PASS / FAIL |
| Lint | PASS / non-blocking |
| PROJECT_STATE.md updated | PASS |
| TASK_LOG.md updated | PASS |
| CLAUDE_IDE_CONTEXT_HANDOFF.md updated | PASS |
| claude agents/ untracked (not committed) | PASS |
| Commit hash | |

State any deviations from this prompt.

Do NOT implement T1-16. Do NOT push. Stop after the final report.

---

## DO NOT MODIFY

The following must not be touched:

- apps/web/app/(coach)/clients/_components/ClientsClient.tsx
- apps/web/app/(coach)/clients/page.tsx
- apps/web/app/(coach)/dashboard/**
- apps/web/app/(coach)/layout.tsx
- apps/web/app/api/**
- apps/mobile/**
- packages/supabase/**
- supabase/migrations/**
- supabase/tests/**
- claude agents/ (untracked local tooling — do not stage, do not commit, do not modify)
