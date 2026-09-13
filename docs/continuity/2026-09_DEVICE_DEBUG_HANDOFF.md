# Device Debug Handoff — Steps/Weight KPI on a physical Android phone

**Written:** 2026-09-13
**For:** a fresh Claude Code session running on the PC that has the pilot
tester's phone plugged in over USB (accessed via AnyDesk from another
machine). That session has no memory of this conversation — read this
whole file before doing anything.

## Why this file exists

Hamdi (the founder/only dev) tested the CoachOS mobile app hands-on on
his Android phone. Result: Steps KPI works. Weight OCR did not (now
fixed in code, see below — not yet re-tested on a real device). The
Home-screen KPI numbers (steps/weight stats) have also been reported as
sometimes not updating ("stuck"), but this was never actually debugged
because nobody had adb access to a phone until now. That's this
session's job.

Do not re-litigate the Health Connect *architecture* — it was already
checked line-by-line against Google's current guidance and is correct
(see "Already verified, don't redo" below). The job here is to capture
real logcat output from the real device and find the actual failure
point, not to redesign the sync logic from first principles.

## Repo

- GitHub: `https://github.com/dannyfrost/coachos-mvp` (private, `main` branch)
- Package manager: pnpm monorepo (`packageManager: pnpm@9.0.0` in root `package.json`)
- Mobile app: `apps/mobile` (Expo/EAS, React Native)
- Latest relevant commits on `main`:
  - `1630a1b` — weight OCR no longer retries; manual entry available immediately on first failure. Home screen: coach-message card and Meal+Questions collapsed by default.
  - `9d6e2b9` — **the one that matters for this session**: `[stepsForegroundSync]` and `[weightForegroundSync]` console logs in `apps/mobile/app/(client)/home.tsx` were gated behind `__DEV__`, which is `false` in the preview build — so logcat showed nothing, ever, on a real test. Now unconditional, and each Health Connect/pedometer tier reports its actual status (`unavailable` / `permission_denied` / `no_data` / `ok` / `error`) instead of collapsing to `null`.
- Latest EAS preview build (has the above fixes, install this on the test phone if it isn't already): `https://expo.dev/accounts/silver-shadow/projects/coaching-mobile/builds/d951c01f-c9cf-4350-8f1c-171c24d6827f`
- EAS account: logged in as `hammdiadnane@gmail.com` (`silver-shadow`). To run `eas` commands, `npx eas-cli ...` works without global install; if npm hits `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (TLS-interception on this network), prefix with `NODE_OPTIONS="--use-system-ca"`.

## Step 0 — environment check on the PC with the phone

```
adb devices
```
Confirm the phone shows up as `device` (not `unauthorized` — if so, check the phone screen for a "trust this computer" prompt) and not `offline`.

If `adb` isn't installed: install Android Platform Tools (`https://developer.android.com/tools/releases/platform-tools`), add to PATH, re-run `adb devices`. USB debugging must be enabled in the phone's Developer Options.

Confirm which app build is installed: open the app, check whatever version/build indicator exists (or just reinstall from the EAS link above to be sure it's current).

## Step 1 — reproduce with logging

```
adb logcat -c
```
(clears the buffer so you're only looking at fresh output)

Then reproduce on the phone: open the app, land on the Home tab (this triggers `syncSteps()` and `syncWeight()` via `useFocusEffect` in `home.tsx`), and/or tap the manual refresh button next to Steps if there is one.

Capture:
```
adb logcat | findstr "stepsForegroundSync weightForegroundSync weight-ocr steps-ocr"
```
(Windows `cmd` has no `grep` — `findstr` is the equivalent; if running from Git Bash instead, `adb logcat | grep -E "stepsForegroundSync|weightForegroundSync|weight-ocr|steps-ocr"` works.)

## What the log lines mean

`[stepsForegroundSync]` logs an object: `{ today, healthConnect: <status>, pedometer: <status>, steps, source, manual }`.

- `healthConnect`/`pedometer` status will be one of: `unavailable`, `permission_denied`, `no_data`, `ok`, `error`. `pedometer` shows `"skipped"` if Health Connect already succeeded (pedometer is only tried as a fallback).
- `steps`/`source` are the final resolved value and which tier provided it (`null`/`null` if both tiers failed).

`[weightForegroundSync]` logs `{ healthConnect: <status>, weightKg }`. Weight only has Health Connect as a source (no pedometer-equivalent fallback), and it only ever fills an *empty* weight field — check `apps/mobile/app/(client)/home.tsx` around `syncWeight` if the log never fires at all (it early-returns if the field already has a value or is mid-edit).

## Diagnosis table — match what you see to the next step

| healthConnect status seen | What it means | Next step |
|---|---|---|
| `unavailable` | `getSdkStatus()` didn't return `SDK_AVAILABLE` — either Health Connect isn't installed/enabled on this phone, or the phone's Android version doesn't ship it and the standalone Health Connect app isn't installed | Check Android version (`adb shell getprop ro.build.version.release`); on Android <14 the phone needs the separate "Health Connect" app from Play Store. If it's genuinely unavailable, that's expected — the pedometer tier should pick it up instead; check the `pedometer` status field too. |
| `permission_denied` | App asked, user (or a prior denial) said no | Open Health Connect app (or Android Settings → Apps → Health Connect → App permissions) and check whether CoachOS has Steps/Weight read permission granted. Toggle it, re-test. |
| `no_data` | Health Connect is available, permission is granted, but no Steps/Weight records exist for today's range | Check whether *anything* is writing steps into Health Connect on this phone (the phone's own Health Connect app has a "data sources & priority" or a "browse data" view — confirm today's step count actually appears there, independent of this app). If Health Connect itself has no data, that's a device/OS issue, not this app's bug. |
| `error` | An exception was thrown and swallowed | This is the interesting one — get the full stack/message from logcat around the `[stepsForegroundSync] unexpected error` or `[weightForegroundSync] unexpected error` line (these are now also unconditional, same commit) and report it back verbatim. |
| `ok` but the Home screen still shows a stale/zero number | Sync succeeded but UI didn't reflect it | Report the exact `steps`/`weightKg` value from the log line vs. what's shown on screen. This points at a React state/render bug in `home.tsx`, not the Health Connect layer — come back to the main session with this finding rather than guessing at a fix here. |

## Already verified, don't redo

Checked against Google's current Health Connect docs and confirmed correct in this codebase already — do not spend time re-checking these:

- Uses `aggregateRecord({ recordType: 'Steps', ... })` → `COUNT_TOTAL`, not manual summing of `readRecords` (`apps/mobile/lib/stepsHealthConnect.ts:119-129`).
- No `DataOrigin` filter applied anywhere, so on-device steps are included by default per Google's own guidance.
- Date range is local-day midnight-to-now (`new Date(now.getFullYear(), now.getMonth(), now.getDate())`), not UTC and not "last 24h" (`apps/mobile/lib/stepsHealthConnect.ts:80-84`).
- Every native Health Connect/pedometer call is wrapped in a 6s timeout (`withTimeout`, `apps/mobile/lib/stepsPedometer.ts`), and `syncSteps`/`syncWeight` reset their busy/in-flight flags in a `finally` block — no unbounded-hang path found by code inspection.

## Relevant files

- `apps/mobile/app/(client)/home.tsx` — `syncSteps` (~line 591), `syncWeight` (~line 697), `tryHealthConnectSteps`/`tryPedometerSteps`/`tryHealthConnectWeight` just above each.
- `apps/mobile/lib/stepsHealthConnect.ts`, `apps/mobile/lib/weightHealthConnect.ts` — the actual Health Connect read wrappers.
- `apps/mobile/lib/stepsPedometer.ts` — fallback tier + the shared `withTimeout` helper.
- `apps/mobile/lib/stepsSync.ts` — pure sync-decision logic (when to overwrite vs. skip), has its own unit tests.
- `apps/mobile/lib/stepsManualOverride.ts` — tracks whether the user/OCR already set today's value, so auto-sync never overwrites it.
- `apps/mobile/lib/weightOcr.ts` / `stepsOcr.ts` — OCR fallback, unrelated to this specific bug but same screen.

## Build/test commands (run from `apps/mobile`)

```
pnpm install --filter ./apps/mobile        # if node_modules missing; prefix NODE_OPTIONS="--use-system-ca" if TLS errors
npx tsc --noEmit -p tsconfig.json           # typecheck
npx jest                                    # 108 tests currently, all passing
NODE_OPTIONS="--use-system-ca" npx eas-cli build --profile preview --platform android --non-interactive   # rebuild after a fix
```

## What to report back to the main session

Don't just say "fixed it" — report:
1. The exact logcat line(s) captured (status values, not paraphrased).
2. Phone's Android version.
3. Whether Health Connect app is installed and what it shows for today's steps independently of this app.
4. If a code fix was made: what changed and why, plus the fresh `tsc`/`jest` run confirming it's still green.
5. New commit hash if one was pushed, and whether a new EAS build was kicked off.
