# T1-14 — Client Mobile Home / Today (Daily Logging Screen)
## Claude IDE Implementation Prompt

---

## Pre-flight

```bash
git status
git log --oneline -5
```

Expected: clean working tree. Latest commit is `1392612` (T1-13 — Expo mobile scaffold).

Also confirm the placeholder exists:

```bash
cat apps/mobile/app/\(client\)/home.tsx
```

Expected: two Text elements — "Home" title and "Daily logging — coming in T1-14." subtitle. If file is missing or contains real implementation, stop and report before proceeding.

---

## Context

You are continuing the Coaching Platform MVP monorepo (pnpm + Turborepo).

- Web app: `apps/web` (Next.js 14 App Router) — **do not modify any web files**
- Mobile app: `apps/mobile` (Expo SDK ~52, Expo Router ~4) — **modify home screen only**
- Shared Supabase package: `packages/supabase` — **do not modify any file here**

**What this task builds:**

Replace `apps/mobile/app/(client)/home.tsx` with a complete daily logging screen:

1. On mount: fetch today's daily_log (prefill if exists) + fetch client status + subscription status
2. Show status banners and disable submit if account is paused/inactive or subscription expired
3. Form fields: steps, weight (kg), meal description, meal photo, questions
4. Photo upload: pick from library → request signed upload URL → PUT to Storage → store path
5. Submit via `update_today_log` RPC
6. Show inline "Logged ✓" on success; stay on screen

**Does NOT include:** tab bar, navigation change after success, offline queue, new migrations, new RLS, new RPCs.

---

## Step 1 — Verify API contracts (read-only, do not modify)

### 1a. Signed upload URL route

Read `apps/web/app/api/storage/signed-upload-url/route.ts`.

Confirm **exactly**:
- Method: `POST`
- Auth: `Authorization: Bearer <client_jwt>` header required
- Body: `{ path: string, content_type: string, size: number }`
  - `path` format: `{coach_id_uuid}/{client_id_uuid}/{filename}` (UUID/UUID/filename pattern)
  - `content_type`: must be `"image/jpeg"` or `"image/png"`
  - `size`: bytes, > 0, max 5,242,880 (5 MB)
- Success **200**: `{ signed_url: string, path: string, expires_in: null }`
- Errors `{ error: string }`: 400 (bad body/type/size), 401 (no/bad token or non-client role or inactive), 403 (path ownership mismatch), 500

### 1b. update_today_log RPC (database.types.ts)

Read `packages/supabase/database.types.ts`.

Confirm `update_today_log` Args:
```ts
{
  p_meal_description?: string
  p_meal_photo_key?: string
  p_questions?: string
  p_steps?: number
  p_weight?: number
}
```

Returns: `daily_logs` row (setof).

If anything does not match the above, **stop and report. Do not modify any API route or migration.**

---

## Step 2 — Check and install expo-image-picker

Check `apps/mobile/package.json` for `expo-image-picker` in dependencies.

**If absent**, install it:

```bash
pnpm --filter @coaching/mobile exec expo install expo-image-picker
```

Accept the Expo-recommended version. Do not pick a version number manually.

After install, run `pnpm install` from repo root to sync the lockfile.

> `expo install` selects the version compatible with the installed Expo SDK version. Overriding it risks Metro bundler crashes.

---

## Step 3 — Replace apps/mobile/app/(client)/home.tsx

Replace the entire file with the daily logging screen. The implementation must follow all sections below.

### 3a — Imports

```tsx
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StyleSheet, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
```

No additional package installs beyond expo-image-picker (Step 2).

---

### 3b — On-mount data fetching

On mount, fetch three things in parallel using `Promise.all`:

1. **Today's log** — direct RLS-scoped query:
   ```ts
   const todayISO = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
   supabase.from('daily_logs').select('*').eq('log_date', todayISO).maybeSingle()
   ```
   If log exists, prefill `steps`, `weight`, `mealDescription`, `questions`, and set `existingPhotoKey`. If no row, fields start empty.

2. **Client status + subscription**:
   ```ts
   supabase.from('platform_users').select('status').eq('id', userId).single()
   supabase.from('client_subscriptions').select('status').eq('id', userId).maybeSingle()
   ```

3. **Client's coach_id** — needed for photo path construction:
   ```ts
   supabase.from('clients').select('coach_id').eq('id', userId).single()
   ```

Show `ActivityIndicator` while loading. On any fetch error, show a banner above the form ("Could not load your data. Pull to retry.") and continue — form renders empty but submit still allowed.

Obtain the current user:
```ts
const supabase = createMobileSupabaseClient();
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;
```

If no session, redirect to `/activate` via `router.replace('/activate')`.

---

### 3c — Status banner logic

After on-mount fetch, compute the banner from:

```ts
type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type SubStatus = 'active' | 'expired' | 'overdue';
```

| Condition | Banner text | Submit disabled |
|-----------|------------|-----------------|
| `userStatus === 'paused'` | "Your account is paused. Contact your coach to resume." | yes |
| `userStatus` in `['deactivated', 'suspended', 'banned']` | "Your account is not active. Contact your coach." | yes |
| `subStatus` in `['expired', 'overdue']` | "Your subscription has expired. Contact your coach." | yes |
| `userStatus === 'active'` and `subStatus === 'active'` (or no subscription row) | no banner | no |

Render the banner in a styled container. Style paused banner with amber background (`#FFF3CD`), inactive/expired with red background (`#F8D7DA`). When submit is disabled, render button with `opacity: 0.4` and `disabled={true}`.

---

### 3d — Form fields state

```ts
const [steps, setSteps] = useState('');
const [weight, setWeight] = useState('');
const [mealDescription, setMealDescription] = useState('');
const [questions, setQuestions] = useState('');
const [photoUri, setPhotoUri] = useState<string | null>(null);       // local URI for preview
const [photoKey, setPhotoKey] = useState<string | null>(null);       // Storage path after upload
const [existingPhotoKey, setExistingPhotoKey] = useState<string | null>(null);
```

Prefill on mount from today's log:
- `steps`: `String(log.steps ?? '')`
- `weight`: log.weight != null ? log.weight.toFixed(1) : `''`
- `mealDescription`: `log.meal_description ?? ''`
- `questions`: `log.questions ?? ''`
- `existingPhotoKey`: `log.meal_photo_key ?? null`

Field layout (top to bottom):
1. Steps — `TextInput`, `keyboardType="numeric"`, label "Steps", placeholder "e.g. 8000"
2. Weight — `TextInput`, `keyboardType="decimal-pad"`, label "Weight (kg)", placeholder "e.g. 72.5"
3. Meal description — `TextInput` multiline, `numberOfLines={4}`, label "Meal description", `maxLength={1000}`
4. Meal photo — photo picker UI (Step 3e)
5. Questions — `TextInput` multiline, `numberOfLines={4}`, label "Questions for your coach", `maxLength={2000}`

---

### 3e — Photo picker UI

Photo picker button behavior:
- No photo picked and no existing key: show "Add meal photo" button
- Photo picked (photoUri set): show thumbnail (`Image`, 80×80) + "Remove" button (clears `photoUri` and `photoKey`)
- Existing key only (photoUri null): show "Photo already uploaded — tap to replace" button

Picking:
```ts
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  quality: 0.8,
});
if (!result.canceled && result.assets[0]) {
  setPhotoUri(result.assets[0].uri);
  setPhotoKey(null); // will re-upload on submit
}
```

> If `ImagePicker.MediaTypeOptions` is not available in the installed version, check the expo-image-picker changelog and use the equivalent API for that version (e.g. `{ mediaTypes: ['images'] }`).

**Do not upload on pick.** Upload happens in the submit handler.

---

### 3f — Submit handler

Validate before any network call. Show the first failing error and return early:

1. `steps` non-empty → `parseInt(steps, 10)`. If `isNaN` or `steps.includes('.')` → "Steps must be a whole number." If `< 0` or `> 99999` → "Steps must be between 0 and 99999."
2. `weight` non-empty → `parseFloat(weight)`. If `isNaN` → "Enter a valid weight." If `< 0` or `> 999.9` → "Weight must be between 0 and 999.9 kg."
3. `mealDescription.length > 1000` → "Meal description is too long (max 1000 characters)."
4. `questions.length > 2000` → "Questions field is too long (max 2000 characters)."

Photo upload (only if `photoUri` is set and `photoKey` is null):

```ts
// Determine content type
const ext = photoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

// Get file size from ImagePicker result if available, otherwise blob fallback
const imageBlob = await fetch(photoUri).then(r => r.blob());
const size = imageBlob.size;

// Build Storage path: {coach_id}/{client_id}/{timestamp}.{ext}
const filename = `${Date.now()}.${ext}`;
const path = `${coachId}/${userId}/${filename}`;

// Request signed upload URL
const urlRes = await fetch(`${API_BASE}/api/storage/signed-upload-url`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ path, content_type: contentType, size }),
});
if (!urlRes.ok) {
  setSubmitError('Photo upload failed. Try again or remove the photo.');
  return;
}
const { signed_url, path: confirmedPath } = await urlRes.json() as {
  signed_url: string;
  path: string;
  expires_in: null;
};

// PUT image to signed URL
const putRes = await fetch(signed_url, {
  method: 'PUT',
  headers: { 'Content-Type': contentType },
  body: imageBlob,
});
if (!putRes.ok) {
  setSubmitError('Photo upload failed. Try again or remove the photo.');
  return;
}
setPhotoKey(confirmedPath);
finalPhotoKey = confirmedPath;
```

`API_BASE` = `process.env.EXPO_PUBLIC_API_BASE_URL ?? ''`

RPC call — pass only non-null args:

```ts
type TodayLogArgs = {
  p_steps?: number;
  p_weight?: number;
  p_meal_description?: string;
  p_meal_photo_key?: string;
  p_questions?: string;
};

const args: TodayLogArgs = {};
if (parsedSteps !== null)             args.p_steps = parsedSteps;
if (parsedWeight !== null)            args.p_weight = parsedWeight;
if (mealDescription.trim())           args.p_meal_description = mealDescription.trim();
if (finalPhotoKey)                    args.p_meal_photo_key = finalPhotoKey;
else if (existingPhotoKey)            args.p_meal_photo_key = existingPhotoKey;
if (questions.trim())                 args.p_questions = questions.trim();

const { error: rpcError } = await supabase.rpc('update_today_log', args);
if (rpcError) {
  setSubmitError('Could not save your log. Check your connection and try again.');
  return;
}
setSubmitSuccess(true);
```

---

### 3g — Submit state

```ts
const [submitError, setSubmitError] = useState<string | null>(null);
const [submitSuccess, setSubmitSuccess] = useState(false);
const [submitting, setSubmitting] = useState(false);
```

- Clear `submitError` and `submitSuccess` at start of each submit attempt.
- `submitting = true` → disable button + render ActivityIndicator inside button (replace button text).
- `submitSuccess = true` → render "Logged ✓" in green below the button. Clear on next field change (optional).
- `submitError` → render error text in red below button; form stays editable.

---

### 3h — Keyboard and scroll wrapper

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  style={{ flex: 1, backgroundColor: '#fff' }}
>
  <ScrollView
    contentContainerStyle={styles.container}
    keyboardShouldPersistTaps="handled"
  >
    {/* status banner */}
    {/* loading indicator or form */}
    {/* submit button */}
    {/* success / error messages */}
  </ScrollView>
</KeyboardAvoidingView>
```

---

## Step 4 — TypeScript check

```bash
pnpm --filter @coaching/mobile exec tsc --noEmit
```

**Zero errors required.** Common issues and fixes:

| Error | Fix |
|-------|-----|
| `expo-image-picker` types missing | Confirm `expo install expo-image-picker` ran; types bundled |
| `MediaTypeOptions` not found | Check installed version API; may be `{ mediaTypes: ['images'] }` |
| `process.env.EXPO_PUBLIC_*` type error | Add `/// <reference types="expo-constants" />` at top of file |
| RPC args type mismatch | Use explicit `TodayLogArgs` type as shown in 3f; avoid `Record<string, unknown>` |
| `daily_logs` Row fields | Import `Database` from `@coaching/supabase/mobile` and use `Database['public']['Tables']['daily_logs']['Row']` |
| `clients` Row `coach_id` field | `string` — confirmed from `database.types.ts` |
| **Do not modify** `packages/supabase/database.types.ts` | — |

---

## Step 5 — Metro / Expo Go runtime (if device available)

```bash
pnpm dev:mobile
```

Metro must start without crashing. If device connected:

1. App opens — no red error screen
2. Navigate to home screen (re-activate or use existing session from T1-13 testing)
3. Home screen renders: form fields, photo picker, submit button
4. Empty submit → no crash; validation errors appear
5. Fill all fields, submit → "Logged ✓" inline
6. Kill app, reopen → today's fields prefill from database

**If no device available:**
Report: `Metro / Expo Go runtime: SKIPPED — no device connected in this environment`

---

## Step 6 — Update control documents

### `PROJECT_STATE.md`
- Add T1-14 row to Completed Tasks table: `typecheck + build PASS; Metro/Expo Go runtime skipped (no device connected); photo upload via signed URL; update_today_log RPC`
- Update "Current Task" to `T1-15`
- Update "In Progress" to: `_None. T1-14 complete 2026-05-24. Awaiting founder approval for T1-15._`
- Update "Last updated" header

### `TASK_LOG.md`
Append T1-14 session entry with:
- Task ID, description
- Files created and modified
- expo-image-picker version installed (or "already present")
- Any deviations (e.g. ImagePicker API differences between Expo versions)
- TypeScript result
- Metro/Expo Go result (or "skipped — no device")
- Commit hash

### `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md`
- Update "Last completed" to T1-14
- Update "Next task" to T1-15
- Note expo-image-picker version and any API deviations

---

## Step 7 — Commit

Stage only these files:

```bash
git add "apps/mobile/app/(client)/home.tsx"
# if PhotoPicker extracted:
git add "apps/mobile/app/(client)/_components/PhotoPicker.tsx"
# if expo-image-picker was installed:
git add apps/mobile/package.json
git add pnpm-lock.yaml
# control docs:
git add PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

Commit:

```bash
git commit -m "feat(mobile): implement daily logging screen with photo upload (T1-14)"
```

Report the commit hash.

---

## Acceptance Criteria

- [ ] `pnpm --filter @coaching/mobile exec tsc --noEmit` → zero errors
- [ ] `apps/mobile/app/(client)/home.tsx` placeholder replaced with full daily logging screen
- [ ] On mount: today's daily_log fetched; fields prefilled if row exists
- [ ] On mount: platform_users.status and client_subscriptions.status fetched; correct banners shown; submit disabled when blocked
- [ ] Steps: accepts integer, rejects decimal, rejects negative, rejects > 99999
- [ ] Weight: accepts float 0–999.9, rejects invalid
- [ ] Meal description: enforces max 1000 chars
- [ ] Questions: enforces max 2000 chars
- [ ] Photo picker: opens library, shows thumbnail after selection, allows removal
- [ ] Photo upload: signed URL POST with correct path/type/size; PUT binary to signed_url; path stored
- [ ] RPC `update_today_log` called with correct typed args; null/empty values omitted
- [ ] "Logged ✓" shown inline after successful submit; screen stays
- [ ] Submit error shown inline; form remains editable
- [ ] Loading indicator shown during mount fetch and submit
- [ ] No web files modified
- [ ] No migrations, RLS, or `database.types.ts` modified
- [ ] No other mobile screens modified (`_layout.tsx`, `index.tsx`, `activate.tsx`, `(client)/_layout.tsx`)
- [ ] Metro starts without crashing (or skipped with reason logged)
- [ ] Control docs updated
- [ ] Commit created

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `apps/mobile/app/(client)/home.tsx` | **Modify** — replace placeholder |
| `apps/mobile/app/(client)/_components/PhotoPicker.tsx` | **Create** (if photo logic extracted) |
| `apps/mobile/package.json` | Modify — only if `expo-image-picker` absent |
| `pnpm-lock.yaml` | Modified automatically by pnpm install |
| `PROJECT_STATE.md` | Update |
| `TASK_LOG.md` | Append |
| `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` | Update |

## Files Explicitly NOT to Modify

- `apps/web/**` (entire web app)
- `apps/web/app/api/**` (all API routes)
- `supabase/migrations/*`
- `packages/supabase/database.types.ts`
- `packages/supabase/mobile.ts`
- `packages/supabase/package.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/activate.tsx`
- `apps/mobile/app/(client)/_layout.tsx`
- Root `package.json`
- Root `turbo.json`

---

## Deferred Verification Backlog (carry forward — do not address in T1-14)

- T1-07 through T1-10 API integration tests — deferred, `.env.local` missing
- T1-11, T1-12 web runtime validation — deferred, `.env.local` missing
- T1-13 Metro + Expo Go runtime — deferred, no device in environment
- T1-14 Expo Go runtime — deferred if no device available in this session
