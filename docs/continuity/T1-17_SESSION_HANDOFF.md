# T1-17 Session Handoff — Real-Coach Core Loop + Mobile Runtime Validation

> **Superseded by `PROJECT_STATE.md`.** T1-18 (Invite-Code Security Fix, commit `5303292`) closed after this handoff was written. This file's "Next Up" section is stale — see `PROJECT_STATE.md` for current status and next recommended task.

## Status

**T1-17 COMPLETE — 2026-06-17 — PASS**

All validation steps passed. Photo upload blocker resolved by env-only fix. No code changes.

---

## Repo State

- **Repo:** E:\Claude-project-Coaching-app-MVP
- **Branch:** main
- **HEAD at task start:** 3b0f746 feat(validation): T1-16 Gate 1 PASS — core loop validated

## git status at close (pre-commit)

```
 M apps/mobile/package.json
 M pnpm-lock.yaml
?? docs/continuity/T1-17_SESSION_HANDOFF.md
?? docs/prompts/T1-17_CLAUDE_IDE_PROMPT.md
```

## Approved Dependency Fix (committed in T1-17 commit)

`@babel/runtime 7.29.2` added to `apps/mobile/package.json` + `pnpm-lock.yaml` updated.

**Reason:** Metro bundling failure — `Unable to resolve @babel/runtime/helpers/interopRequireDefault from apps/mobile/app/(client)/home.tsx`

## T1-17 Validation Results

| Step | Result |
|---|---|
| Docker + Supabase healthy | PASS |
| Coach login | PASS |
| Fresh client invite | PASS |
| Expo Go SDK 52 — app opens on physical Android | PASS |
| Client activation | PASS |
| Today's Log screen navigates | PASS |
| Daily log — no photo | PASS (`"Logged ✓"`) |
| Daily log — with gallery photo | PASS (`"Logged ✓"`) |

## DB Verification (post-fix)

```
daily_logs row (2026-06-17):
  steps:            8000
  weight:           75
  meal_description: populated
  questions:        populated
  meal_photo_key:   bb8719f2-.../db6f0e56-.../1781654795634.png  ← NOT NULL

tenant-media storage object:
  name:       bb8719f2-.../db6f0e56-.../1781654795634.png
  created_at: 2026-06-17T01:06:40

meal_photo_key == storage object name  ✓
```

## Photo Upload Blocker — Root Cause and Resolution

**Root cause:** `apps/web/.env.local` had `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
`createServiceRoleClient()` used this URL to generate a signed upload URL.
The signed URL returned to the mobile device contained `127.0.0.1` as the host.
From a physical Android device, `127.0.0.1` resolves to the device itself — not the dev machine.
The mobile PUT to `http://127.0.0.1:54321/...` failed with a network error.

**Resolution (env-only, no code changes):**
Changed `NEXT_PUBLIC_SUPABASE_URL` in `apps/web/.env.local` to `http://192.168.1.37:54321` (LAN IP).
Killed and restarted the Next.js web server with `--hostname 0.0.0.0`.
Signed upload URLs now contain `192.168.1.37` — reachable from the physical device.

**No-photo save always worked** because those RPC calls go directly from the mobile Supabase client
(already using `EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.37:54321`) to Supabase, bypassing the web server.

## Constraints Honoured

- No database reset
- No schema / migrations / RLS / `database.types.ts` changes
- No additional dependencies (beyond the approved @babel/runtime fix)
- No Expo upgrade / React Native upgrade
- `.env.local` and `.env` not committed (gitignored)

## Next Up

Tier 3 planning — requires explicit founder approval.
