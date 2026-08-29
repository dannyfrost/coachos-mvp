# Steps Auto-Sync (Pedometer / Health Connect) — Design Spec

**Date:** 2026-08-29
**Status:** Approved by user, pending implementation plan

## Purpose

Automatically populate the Daily Log's Steps field from the client's
phone, with no manual entry and no confirmation step — unlike weight-
OCR, this is fully automatic by the user's explicit choice. This is
the second of two sub-projects from the original "make logging
smarter" request; weight-OCR (first sub-project) is already shipped.

## Non-goals (this pass — Android only)

- No OCR involvement of any kind — steps come from the phone's own
  step sensor, never a photo.
- No iOS implementation yet (see "Future: iOS" below for why it's
  deferred, not skipped).
- No true real-time push updates — background refresh is periodic
  (OS-throttled), not instant. See "Realistic background behavior."
- No new backend route — reuses the existing `update_today_log` RPC.
- No change to the weight-OCR feature or any other existing flow.

## Why this needs Health Connect, not just `expo-sensors`

`expo-sensors`' Pedometer API was the original, simpler idea. Verified
directly against Expo's own docs: `getStepCountAsync` (the historical
date-range query — what "today's total steps" actually requires) is
**iOS-only**. Android only exposes `watchStepCount`, a live
foreground-only counter with no documented "since midnight" reference
point, and it stops entirely when the app backgrounds. Plain
`expo-sensors` cannot answer "how many steps has this person taken
today" on Android at all — only "how many since I opened this screen
just now." Getting a real full-day Android total requires **Health
Connect**, Android's system-level aggregated health-data store.

## Dependency verification (done, not guessed)

Two new native packages, both confirmed against **this project's exact
SDK 54 BOM** (`node_modules/.pnpm/expo@54.*/node_modules/expo/
bundledNativeModules.json` — the same manifest `expo install` itself
reads, more authoritative than npm's `dist-tags`, which simply weren't
published for the SDK 54 milestone on these particular packages and
initially looked like a gap until cross-checked against the BOM):

- **`react-native-health-connect@3.6.0`** — its own devDependencies
  target `react-native: 0.81.1`, matching our exact RN line (4.x jumped
  to RN 0.86, too far ahead — same red flag pattern correctly avoided
  during the weight-OCR dependency gate).
- **`expo-background-task@~1.0.10`** — the SDK-54-pinned version per
  the BOM. Confirmed via Expo's versioned docs (v54 docs page, not
  "latest"): WorkManager-backed on Android, 15-minute minimum interval,
  default 12 hours between repeats, requires battery charge/network
  per WorkManager's own constraints, and is explicitly documented to
  **stop if the user force-kills the app** (resumes automatically next
  time the app opens; also resumes after a device reboot). Some Android
  OEMs are more aggressive about killing background work regardless of
  WorkManager (documented Android-ecosystem-wide caveat, not specific
  to this package — see dontkillmyapp.com).
- `expo-task-manager@~14.0.9` may be needed alongside
  `expo-background-task` depending on the exact registration API in
  this version — confirm during implementation, not assumed here.

## Realistic background behavior (set expectations correctly)

"Continuous" in this spec means: a periodic background task fires
roughly every 15-30 minutes while the OS permits it, reads today's
Health Connect step total, and pushes it via `update_today_log`. It is
**not** instant push-on-change — true instant updates would need
custom native code beyond a wrapped community/Expo module, which is
out of scope. If the user force-kills the app from recent apps, syncing
pauses until they reopen it (standard Android behavior, not a defect
in this design). This is the same tradeoff essentially every
consumer fitness app on Android lives with.

## User-facing flow

1. First time the Daily Log screen loads, request Health Connect
   permission via its native permission-grant UI (not a custom dialog
   — Health Connect owns that UI).
2. **Granted:** do an immediate foreground read of today's step total
   (so the number isn't stale while waiting for the first periodic
   tick), fill the Steps field, and register the periodic background
   task.
3. **Denied, or Health Connect not installed/available on this
   device:** fall back to normal manual Steps entry — same
   graceful-degradation principle as the weight-OCR camera-permission
   case. Never a dead end.
4. The Steps field remains a normal editable `TextInput` at all times
   — if Health Connect's number looks wrong (phone left at home part
   of the day), the client can still type over it, consistent with
   every other "auto-fill but never lock" pattern built this session
   (OCR weight, meal-description saved-state).
5. Background task ticks: read Health Connect, call
   `update_today_log` with the new step count. No UI is required to be
   open for this to happen, subject to the OS-throttling caveats above.

## Architecture

- No schema changes needed — `daily_logs.steps` already exists and
  `update_today_log` already accepts `p_steps`.
- New mobile-only pieces:
  - A permission + Health Connect read wrapper (thin, isolated module,
    mirroring how `weightOcr.ts` isolated the OCR candidate logic from
    the UI).
  - A background-task registration module using
    `expo-background-task`, calling the same read wrapper and posting
    through the existing Supabase client + RPC — no new backend code.
- `app.json` gets two new native module entries (config plugins for
  `react-native-health-connect` and `expo-background-task`), landing
  in the **same rebuild** as this feature — no separate rebuild cycles.
- Google Play requirement to flag now, address before real store
  distribution (not before internal-APK testing): apps requesting
  Health Connect scopes need a published privacy-policy URL. Not a
  blocker for sideloaded testing via the current APK-link distribution
  model, but tracked here so it isn't a surprise at Play Store
  submission time.

## Error handling

| Case | Behavior |
|---|---|
| Health Connect not installed | Fall back to manual entry immediately |
| Permission denied | Fall back to manual entry immediately |
| Permission revoked later (Android Settings) | Next sync attempt fails gracefully, falls back to manual entry, does not crash |
| Background task killed by OS/user | Silently stops; resumes automatically next app open or device reboot per `expo-background-task`'s documented behavior |
| Health Connect returns 0 or no data for today | Treated as a legitimate reading (0 steps so far today), not an error — does not overwrite a nonzero value the client already typed manually today unless Health Connect's own value is also nonzero (avoid clobbering real data with an empty read) |

## Testing

- Permission-branch logic (granted / denied / not-installed → correct
  fallback) — pure logic, testable independent of the native call,
  same pattern as `weightOcrState.ts`.
- The "don't clobber a manual entry with a zero read" rule above —
  pure logic, directly testable.
- Background-task registration/read wiring — smoke-tested by
  reproduction once built, matching how the weight-OCR upload/RPC path
  was verified.
- Real Android device testing is mandatory before calling this
  complete (matches the weight-OCR precedent) — background timing and
  OEM battery-management behavior cannot be verified any other way.

## Future: iOS

Deferred until Apple Developer enrollment completes — not skipped.
Notably, iOS is expected to be **simpler** than Android here: verified
earlier that `expo-sensors`' `getStepCountAsync` already supports real
historical date-range queries natively on iOS (via CMPedometer,
Apple's OS-level pedometer, capped at 7 days of history per Apple's own
constraint) — the exact capability Android lacks, which is *why*
Android needs Health Connect in the first place. When iOS work starts,
re-verify whether plain `expo-sensors` alone is sufficient on iOS
(likely yes, no Health Connect/HealthKit-equivalent package needed) or
whether HealthKit integration is still wanted for parity/richer data —
that's a decision for when Apple enrollment is actually in hand, not
now.
