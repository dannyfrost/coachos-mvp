# CoachOS — QA Bugs

This file covers both QA passes run against this codebase:
- **Part 1 (below): Mobile app**, per `.claude/CLAUDE.md`.
- **Part 2: Coach web platform**, per `.claude/CLAUDE_COACH_QA.md` — see that section further down.

---

# Part 1 — Mobile App

Historical entries (found/fixed earlier in this development effort, before the formal QA procedure was invoked) are logged here for a complete record, then new findings from the formal pass follow.

---

## BUG-001 — Phantom 9-tab bottom navigation / crash on Home

Severity: P0

Status: VERIFIED (fixed)

Environment:
- Device: BlueStacks (Android emulator)
- Android: BlueStacks default (Android 11-class image)
- App build: EAS preview APK, pre-login-screen batch
- Network: N/A

Steps:
1. Log in as client.
2. Land on Home tab.

Expected:
- Standard 4-tab bottom bar (Home / Report / Messages / Settings or similar).

Actual:
- Extra phantom tabs rendered from internal chart components; tapping one crashed the app.

Evidence:
- Reproduced on-device; crash trace pointed at a dead `LineChart.tsx` being picked up as an Expo Router route.

Likely root cause:
- Configuration/Navigation — Expo Router's underscore-folder route exclusion (`_components/`) proved unreliable for nested folders in this Expo Router version, so component files under `app/(client)/_components/` were treated as routes.

Fix:
- Moved all shared chart/UI components (`CompletionRing.tsx`, `WeightTrendChart.tsx`, `StepsBarChart.tsx`, `LoggingHeatmap.tsx`) entirely outside `app/` into `apps/mobile/components/`. Deleted dead `LineChart.tsx`.

Regression test:
- Re-launched, confirmed exactly 4 tabs, no crash on any tab tap.

---

## BUG-002 — "Rendered fewer hooks than expected" crash

Severity: P0

Status: VERIFIED (fixed)

Environment:
- Device: BlueStacks
- App build: pre-login-screen batch

Steps:
1. Log in as client.
2. Navigate to Messages tab, then back.

Expected:
- No crash, tab bar re-renders normally.

Actual:
- Red error screen: "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."

Likely root cause:
- State management/React Rules of Hooks — `CustomTabBar` had a conditional early `return null` positioned before some hook calls (messages-count branching).

Fix:
- Removed the conditional branch entirely by moving `messages.tsx` and `change-password.tsx` out of the `(client)` Tabs group to root-level routes, eliminating the need for that early return.

Regression test:
- Repeated navigation Home → Messages → back → Settings → back, 5x, no crash.

---

## BUG-003 — White screen on launch (real build only, not Expo Go)

Severity: P0

Status: VERIFIED (fixed)

Environment:
- Device: BlueStacks, also reported on real Android tester device
- App build: first EAS preview APK

Steps:
1. Install APK.
2. Launch app.

Expected:
- Login/Activate screen renders.

Actual:
- Permanent white screen, no error shown in-app.

Evidence:
- `adb logcat` showed `supabaseUrl is required.` thrown from the Supabase client constructor.

Likely root cause:
- Configuration — EAS cloud builds do not inherit the local `.env` file; the three `EXPO_PUBLIC_*` env vars were unset in the build.

Fix:
- Ran `eas env:create` for `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` across development/preview/production environments.

Regression test:
- Rebuilt, reinstalled, confirmed Activate screen renders correctly with no white screen.

---

## BUG-004 — Android native crash on real build (missing config plugins)

Severity: P0

Status: VERIFIED (fixed)

Environment:
- Device: real Android tester device, and BlueStacks
- App build: first EAS preview APK

Steps:
1. Install APK.
2. Open app.

Expected:
- App launches normally (worked fine under Expo Go).

Actual:
- Crash on open, no error dialog, app just closes.

Likely root cause:
- Configuration — native modules (`expo-image-picker`, `expo-notifications`, `expo-font`) require entries in `app.json`'s `plugins` array to generate correct Android manifest permissions/config; array was empty. Confirmed `expo-linear-gradient` has no config plugin and must NOT be added (adding it breaks config resolution with `PluginError: Unable to resolve a valid config plugin`).

Fix:
- Set `plugins: ["expo-router", "expo-font", "expo-image-picker", "expo-notifications"]` in `app.json`.

Regression test:
- Rebuilt, installed, confirmed clean launch to Activate screen.

---

## BUG-005 — Meal-entry form: photo-picker row overflows screen edge

Severity: P2

Status: FIXED — confirmed on real device by user (screenshot showed "Remov..." clipped at right edge, matching this exact bug)

Environment:
- Device: real Android tester device (screenshot-reported by user)
- App build: current preview APK

Steps:
1. Log in as client.
2. Open Daily Log → Nutrition card → add a meal entry.
3. View the photo-attach row with a longer button label.

Expected:
- Row content stays within screen bounds.

Actual:
- Right edge of the row is pushed past the visible screen width; content clipped/overflowing.

Likely root cause:
- UI — `photoRow` style in `apps/mobile/app/(client)/home.tsx` lacks `flex`/`flexShrink` constraints on its children, so a long label pushes siblings out of bounds instead of wrapping/shrinking.

Fix:
- Applied: `photoButton` gets `flex: 1` when inside `photoRow` (existingPhotoKey variant), its label gets `numberOfLines={1}`/`ellipsizeMode="tail"`, and `removeButton` gets `flexShrink: 0` so its label never gets squeezed. `tsc --noEmit` clean.

Regression test:
- Pending a new build + on-device confirmation.

---

## BUG-006 — Today's Tasks checklist falsely shows Weight/Steps "done" when nothing was logged

Severity: P1 (upgraded from P2 after root-causing during formal QA — this is a correctness bug, not just a styling/consistency nit)

Status: FIXED (source updated; pending rebuild + on-device re-verification)

Environment:
- Device: BlueStacks (reproduced during formal QA, confirmed via code read); originally reported by user on real Android tester device as a general "checklist doesn't feel automatic" + stat-card mismatch complaint
- App build: current preview APK (pre-fix)

Steps:
1. Log in as a client with **no daily log for today** (fresh day, nothing submitted yet) — or, as reproduced during QA, any state where the today's-log fetch returns `todayLog = null` (e.g. mid-load, or after a failed/partial fetch).
2. View the Home screen "Today's Tasks" checklist.

Expected:
- "Log Weight" / "Log Steps" show as NOT done until a real value has been saved for today.

Actual:
- Both show as done (checked, strikethrough) — "2/4" complete — while the Weight/Steps stat cards directly below correctly show "—" / "No prev log", producing an internally contradictory screen.

Evidence:
- Screenshot captured mid-QA-session (post-reboot, `todayLog` still null): checklist shows Log Weight/Log Steps checked, stat cards show "—".
- Root-caused via code read of `apps/mobile/app/(client)/home.tsx`: `const weightDone = todayLog?.weight !== null || (...)`. Optional chaining on a `null` `todayLog` evaluates to `undefined`, and `undefined !== null` is `true` in JS — so the condition is true whenever `todayLog` itself is `null`, i.e. whenever there is no log yet (the exact opposite of the intended check).

Likely root cause:
- Logic/Validation — an optional-chaining `!== null` comparison against a value that can itself be `undefined`, not just `null`. Classic JS footgun: `todayLog?.weight !== null` does not mean "todayLog has a non-null weight"; it means "todayLog is null/undefined OR its weight is non-null."

Fix:
- Changed both to `(todayLog?.weight ?? null) !== null` / `(todayLog?.steps ?? null) !== null`, which correctly normalizes `undefined` to `null` before the comparison. `tsc --noEmit` clean after the change.

Regression test:
- Pending: requires a new EAS build. On-device: verify a client with zero logs for today sees both checklist items unchecked and "0/4" (or however many are actually done), and that saving a real weight/steps value flips them to checked and keeps the stat cards in agreement.

---

## BUG-007 — Ghosting / double-screen visual artifact during tab transitions

Severity: P1 (visually breaks navigation, not yet root-caused)

Status: FIXED — pending on-device re-verification. User pinpointed the exact trigger: the meal-type picker ("wheel of selection") popup in the Daily Log form.

Environment:
- Device: **confirmed on real physical Android phone**, not emulator-only (explicitly confirmed by user via direct question)
- App build: current preview APK

Steps:
1. Log in as client.
2. Switch between tabs / navigate between screens using the custom sliding tab bar.

Expected:
- Clean single-screen transition.

Actual:
- User-reported: "layout design doesn't respect the screen! ... like another screen under it was moving" — a ghost/duplicate of the previous screen appears to shift underneath the incoming screen during the transition.

Likely root cause:
- Confirmed via user's precise repro (happens specifically when the meal-type picker opens): React Native's native `<Modal>` component (used for that picker in `apps/mobile/app/(client)/home.tsx`) renders as its own separate native window/surface on Android, composited independently from the JS-driven screen underneath. With a custom `Animated`-driven tab bar and root-`Stack` slide transition also active in the same screen, the native Modal's own open transition can visibly desync from the underlying screen's paint, producing the double-image/ghosting artifact. This is a well-known class of issue with RN's native `Modal` on Android in apps with custom animated chrome.

Fix:
- Replaced the native `<Modal>` with an in-tree, JS-driven overlay: an absolutely-positioned `Animated.View` backdrop + sliding `Animated.View` sheet rendered as a sibling of the screen's `ScrollView` (inside the same `KeyboardAvoidingView`), so there's only ever one render surface — no separate native window to desync from. Added a `hardwareBackPress` listener to preserve Android back-button-closes-picker behavior that the native Modal previously gave for free. `tsc --noEmit` clean.

Regression test:
- Pending a new build + on-device confirmation that the ghosting no longer appears when opening the meal-type picker, and that tap-outside/close-button/hardware-back/confirm all still dismiss it correctly.

---

## BUG-008 — No mobile automated test suite

Severity: P2

Status: OPEN (pre-existing condition, not introduced this session)

Environment:
- N/A (repository-wide)

Steps:
1. Inspect `apps/mobile/package.json`.

Expected:
- At minimum, unit test coverage for auth, core logging workflow, and data persistence per CLAUDE.md Section 7.

Actual:
- Only `"typecheck": "tsc --noEmit"` exists. No Jest/Detox/Maestro configured.

Likely root cause:
- Configuration — test tooling was never set up for the mobile app.

Fix:
- Not applied as part of this QA pass (out of scope for a bug fix; flagged as a process gap per CLAUDE.md Section 7 automation priorities).

Regression test:
- N/A.

---

## BUG-009 — No crash reporting / analytics integrated

Severity: P2

Status: OPEN (pre-existing condition)

Environment:
- N/A (repository-wide)

Steps:
1. Inspect `apps/mobile/package.json` dependencies.

Expected:
- Some crash-reporting mechanism (Sentry, Bugsnag, or similar) so production crashes are visible post-launch.

Actual:
- None found.

Likely root cause:
- Configuration — never integrated.

Fix:
- Not applied as part of this QA pass — flagged as a real pre-launch gap (Gate 14/15 relevant): without this, any crash a pilot coach/client hits post-launch is invisible unless they report it manually.

Regression test:
- N/A.

---

## BUG-010 — Expired/missing session redirects to Activate instead of Login

Severity: P1

Status: FIXED (source updated; pending rebuild + on-device re-verification)

Environment:
- Device: BlueStacks
- App build: current preview APK (pre-fix)

Steps:
1. Log in as client (`/login`).
2. Trigger any no-session path: logout, or an expired token on any of Home/Meals/Report/Settings/Messages/Change-Password.

Expected:
- Redirected to `/login` (has real credentials, one-time activation already completed).

Actual:
- All 8 no-session call sites across `home.tsx`, `meals.tsx`, `report.tsx`, `settings.tsx` (x3, incl. `handleLogout`), `messages.tsx`, `change-password.tsx` still `router.replace('/activate')` — a screen that expects a one-time activation token the user no longer has. This predates the login-screen batch, which only updated `index.tsx`'s default landing route.

Evidence:
- Found via code inspection (`grep -rn "router.replace('/activate')" apps/mobile/app`) during Gate 2 session-test prep.

Likely root cause:
- Configuration/Navigation — new `/login` screen was added but the pre-existing no-session guards across the app were never migrated off the old `/activate` fallback.

Fix:
- Replaced all 8 occurrences with `router.replace('/login')`. `tsc --noEmit` clean after the change.

Regression test:
- Pending: requires a new EAS build to verify on-device (logout → lands on Login; kill app after expired token → lands on Login, not Activate).

---

## BUG-011 — "Pull to retry" error banner has no working pull-to-refresh

Severity: P1

Status: FIXED (source updated; pending rebuild + on-device re-verification)

Environment:
- Device: BlueStacks
- App build: current preview APK (pre-fix)
- Network: transient failure (app launched before emulator's virtual network finished validating post-boot)

Steps:
1. Launch app while backend fetch fails (reproduced here via cold boot before network validated).
2. Observe "Could not load your data. Pull to retry." banner on Home.
3. Perform a pull-down gesture on the screen.

Expected:
- Standard RN pull-to-refresh spinner appears, data reloads, banner clears on success.

Actual:
- Nothing happens on pull — no `RefreshControl` exists anywhere in `apps/mobile/app/(client)/`. The banner's only advertised recovery action doesn't exist. A swipe near the bottom tab bar was even observed to switch tabs instead (gesture fell through to the tab bar), leaving the user with no way to recover short of a force-restart.

Evidence:
- `grep -rn "RefreshControl|onRefresh" apps/mobile/app/(client)` returned zero matches before the fix, despite the literal string "Pull to retry" appearing in `home.tsx`, `meals.tsx`, `report.tsx`, `settings.tsx`.

Likely root cause:
- UI/State management — the error-banner copy was written assuming a pull-to-refresh affordance that was never implemented.

Fix:
- Added `refreshing` state + `onRefresh` handler wired to each screen's existing `loadData()` (now accepting `{ silent?: boolean }` so a background refresh doesn't blank the screen via the full-page `loading` spinner) and attached `RefreshControl` to the `ScrollView` in `home.tsx`, `meals.tsx`, `report.tsx`, `settings.tsx`. `tsc --noEmit` clean after the change.

Regression test:
- Pending: requires a new EAS build to verify pull-to-refresh actually clears the error banner and reloads data on-device.

---

## BUG-012 — Photo picker has no explicit permission-denial handling

Severity: P2

Status: OPEN

Environment:
- N/A (code inspection; not reproduced on-device due to the BlueStacks environment limitation — see QA_RESULTS.md)

Steps:
1. Deny media-library permission for CoachOS (or revoke it from Android Settings).
2. Tap "Add [meal] photo" in the Daily Log form.

Expected:
- Clear message explaining the permission is needed, with a path to recover (e.g. deep link to app settings).

Actual (by code inspection):
- `handlePickPhoto` in `apps/mobile/app/(client)/home.tsx` (line ~473) calls `ImagePicker.launchImageLibraryAsync(...)` directly with no prior `requestMediaLibraryPermissionsAsync()` call, no permission-status check, and no `try/catch` around the call. Expo's picker auto-requests the permission on first use and typically resolves `{ canceled: true }` on denial (not a throw), so this is unlikely to crash — but there is no explanation shown to the user on denial, and no recovery path back to Android Settings.

Likely root cause:
- Permission handling — the flow assumes the OS-level auto-prompt is sufficient and never branches on a denied/blocked state.

Fix:
- Not applied (P2, not blocking). Planned: check `ImagePicker.getMediaLibraryPermissionsAsync()` before launching; on denied/blocked, show a message with a button linking to `Linking.openSettings()`.

Regression test:
- Pending fix + device availability.

---

## BUG-013 — Weight/Steps trend charts look broken with exactly one data point

Severity: P3

Status: FIXED

Environment:
- Device: real Android tester device (user-reported screenshot: "progress have no real value or connection")

Steps:
1. As a client with only one day of logged weight/steps, open the Progress screen.

Expected:
- A single-day state that reads as intentional, not broken.

Actual:
- `WeightTrendChart`/`StepsBarChart` showed a single floating dot/bar, plus a date range row showing the same date twice (e.g. "29 Aug ... 29 Aug"), and steps showed "avg 10,000/day" from a single sample — mathematically correct but reads as a bug.

Likely root cause:
- UI — no distinct empty/sparse-state treatment for `validPoints.length === 1`, only for `=== 0`.

Fix:
- Both charts now render a single centered hint ("{date} · Log more days to see your trend") instead of the duplicate date row when there's exactly one point, and `StepsBarChart` hides the "avg X/day" label in that case. `tsc --noEmit` clean.

Regression test:
- Pending a new build + on-device confirmation.

---

## BUG-014 — Age/height/medical-conditions are never collected anywhere, on either app

Severity: P2 (product gap, not a code defect)

Status: FIXED. User decided: client-only editing, captured once during Activation and editable anytime from Settings. `tsc --noEmit` clean on both `apps/mobile` and `apps/web`.

Environment:
- N/A (schema + code inspection, confirmed by user screenshot of mobile Settings "Profile Details": Coach "Not assigned", Age "Not set", Conditions "None reported" — always, for every client)

Evidence:
- `clients` table has `age` (integer, nullable) and `condition_notes` (text, nullable) columns. **No `height` column exists at all.**
- No UI anywhere — not the client mobile app, not the coach web app — ever writes to `age` or `condition_notes`. The mobile Settings screen only reads them (read-only display, always showing the empty placeholder). The coach's `clients/[id]/page.tsx` doesn't even select these columns, so `ClientProfileClient.tsx` can't display them either.
- These fields are permanently stuck at their default empty state for every client that will ever exist, unless someone writes directly to the DB (as QA did for test accounts).

Likely root cause:
- Missing feature — this was apparently scoped in the data model (age/condition_notes columns exist) but the actual capture UI was never built on either platform, and `height` was never modeled at all.

Fix:
- Migration `019_client_profile_fields.sql` applied to production: added `clients.height_cm` (smallint, 50-250 range check) and `clients.age` range check (1-120); added `update_client_profile(p_age, p_height_cm, p_condition_notes)` RPC (`SECURITY DEFINER`, client-role-only, scoped strictly to `auth.uid()` — no direct table UPDATE grant given to the client role, matching the existing `update_today_log` convention). Regenerated `packages/supabase/database.types.ts`.
- `apps/mobile/app/activate.tsx`: added optional Age/Height/Conditions fields to the activation form; calls the RPC (best-effort, non-blocking) right after the post-activation session is established.
- `apps/mobile/app/(client)/settings.tsx`: "PROFILE DETAILS" card is now editable via an "Edit" link — inline Age/Height/Conditions inputs with the same validation ranges, Save/Cancel.
- `apps/web/app/(coach)/clients/[id]/page.tsx` + `ClientProfileClient.tsx`: coach can now see Age/Height/Conditions (read-only) in a compact strip above the Overview/Meals/Report tabs — previously not queried or displayed at all.

Regression test:
- Pending a new mobile build + on-device confirmation (activate a fresh test client with age/height/conditions filled in, confirm they appear in Settings and on the coach's client page). Web-side change confirmed by `tsc --noEmit`; needs a real page load to visually confirm layout once a browser-test path exists.

---

*(New findings from the formal Gate 1-15 sweep will be appended below as they are found.)*

---

## BUG-015 — Steps KPI pedometer fallback (tier 2) fails with `status: 'error'`, never populates steps

Severity: P1 (important synchronization failure — Gate 3/4; the pedometer tier exists specifically as the fallback for devices without Health Connect, and on a real device without Health Connect it does not work)

Status: OPEN

Environment:
- Device: Infinix X6528 (physical, real hardware — not an emulator), Android 13 (`TP1A.220624.014`), Unisoc/Sprd chipset
- App build: EAS preview APK `d951c01f-c9cf-4350-8f1c-171c24d6827f` (built 2026-09-13, profile `preview`, SDK 54)
- Network: WiFi ("Edd's"), stable
- Account: client `idriss`, logged in via persisted session

Steps:
1. Install the preview build fresh (`adb install -r`) on a device with no Health Connect provider.
2. Log in as a client, land on Home.
3. Home screen's `useFocusEffect` fires `syncSteps()`/`syncWeight()` automatically (`apps/mobile/app/(client)/home.tsx:740-745`).

Expected:
- Tier 1 (Health Connect) correctly reports `unavailable` (no provider on this device).
- Tier 2 (device pedometer, `expo-sensors` `Pedometer.getStepCountAsync`) should then read today's step count from the hardware step counter and populate the Steps field, per the fallback design documented in `lib/stepsPedometer.ts`'s own header comment.

Actual:
- Tier 2 also fails, but with `status: 'error'` (not `'unavailable'` or `'denied'`) — logcat:
  ```
  [stepsForegroundSync] { today: '2026-09-18', healthConnect: 'unavailable', pedometer: 'error', steps: null, source: null, manual: false }
  ```
- `steps` stays `null`, nothing is written to `update_today_log`, and the Home screen shows "STEPS — steps / No prev log" with an empty field. Every daily log on this device silently falls through to manual/OCR entry instead of auto-populating, with no user-visible explanation (no retry banner shown either, since that only appears after a *manual* sync attempt — see `home.tsx:1862`).
- Confirmed this is not a permission or hardware problem: `dumpsys package com.coachos.app` shows `android.permission.ACTIVITY_RECOGNITION: granted=true`, and `dumpsys sensorservice` shows both `Step Detector`/`Step Counter` sensors present (`Sprd Group Ltd.`) with an active subscriber connection. So `isPedometerAvailable()` and `hasStepsPermission()` (both already true) are not what's failing — the exception is coming from inside `Pedometer.getStepCountAsync(start, end)` itself, in `lib/stepsPedometer.ts:118-122`.

Evidence:
- Full logcat capture (device-side): `[weightForegroundSync] { healthConnect: 'unavailable', weightKg: null }` immediately followed by the `[stepsForegroundSync]` line above.
- On-device screenshot: Steps card shows "—  steps / No prev log" after the auto-sync ran.
- `expo-sensors` version: `~15.0.8` (`apps/mobile/package.json`).

Likely root cause:
- Unconfirmed — the exact native/JS exception is swallowed. `lib/stepsPedometer.ts:129-131` does `catch { return { status: 'error' } }` with no logging of `err`/`err.message`, so there is currently no way to tell from a device log alone whether this is an `expo-sensors` Android bug in `getStepCountAsync`, an OEM (Unisoc/Sprd sensor HAL) quirk, or something else. This logging gap should be closed regardless of the root cause, since it blocks diagnosing this exact class of failure on any future device too.

Fix:
- Not yet applied. Proposed next step: temporarily log the caught error's message/stack in `stepsPedometer.ts`, cut a new preview build, and re-test on this same device to get the real error before deciding on a fix.

Regression test:
- Pending root cause. Once fixed, re-run the same steps on this Infinix X6528 (no Health Connect provider) and confirm `pedometer: 'ok'` with a real step count populates the field and reaches `update_today_log`.

---

# Part 2 — Coach Web Platform

Per `.claude/CLAUDE_COACH_QA.md`. Bug IDs prefixed `CW-` to avoid collision with the mobile `BUG-` numbering above.

---

## CW-001 — Coach Overview tab shows no meal data for any log, even when the client submitted full meals that day

Severity: P1 (cross-platform synchronization/display failure — Gate 4)

Status: FIXED (source updated, `tsc --noEmit` clean; not yet re-verified in a real browser — no browser-automation tool available this session)

Environment:
- Browser: N/A (found via code + live production data inspection; no browser automation tool available in this environment)
- Build/environment: production Supabase project `brebbnsxjgvjisbqkcbc`, web app at `coachos-mvp-web.vercel.app`
- Account role: coach
- Client involved: QA test client `mtechnica.algeria@gmail.com` (id `566874ec-3121-4239-9ac9-c8d5fe50bcde`)

Steps:
1. As a client (mobile app), submit a daily log with steps/weight AND at least one meal entry (e.g. breakfast, with description + photo) for today.
2. As the coach, open that client's profile page, "Overview" tab (default tab), "Daily Log Timeline" section.
3. Find today's log card.

Expected:
- The card shows the meal description/photo the client actually submitted that day.

Actual:
- The card always shows meal text as "—" and no photo, regardless of what the client submitted. The real meal data only appears if the coach manually switches to the separate "Meals" tab.

Evidence (real production data, not simulated):
- For client `566874ec-3121-4239-9ac9-c8d5fe50bcde`, `daily_logs` for `2026-08-27` has `meal_description: null` (confirmed via direct query).
- The SAME client, SAME date, has 4 real `meal_entries` rows (breakfast/lunch/dinner/snack), each with a real description and a real `photo_key` (confirmed via direct query) — submitted through the actual mobile app during this session's earlier testing.
- Code: `apps/web/app/(coach)/clients/[id]/_components/ClientProfileClient.tsx` line 343, inside the "Overview" tab's Daily Log Timeline card, unconditionally renders `truncate(log.meal_description, 200)` — sourced from `daily_logs.meal_description`, not from `mealEntries`. Same for the photo thumbnail at line 322/330 (`log.meal_photo_key`).
- Mobile app confirmed (`apps/mobile/app/(client)/home.tsx` line 632-640) to no longer pass `p_meal_description`/`p_meal_photo_key` to the `update_today_log` RPC — meal data is written exclusively to the `meal_entries` table (line 660-673) as of the meal-entries feature migration earlier in this project. `daily_logs.meal_description`/`meal_photo_key` are legacy columns no current code path populates.

Likely root cause:
- Synchronization/Configuration — when the meal-entries feature was added (splitting meal data out of `daily_logs` into its own multi-entry `meal_entries` table), the coach-side Overview tab's Daily Log Timeline card was never updated to read from the new table. It still reads the now-permanently-null legacy columns, while a separate, correctly-wired "Meals" tab shows the real data. The two tabs silently disagree about whether the client logged meals.

Fix:
- Applied in `apps/web/app/(coach)/clients/[id]/_components/ClientProfileClient.tsx`. Inside the Overview tab's `logs.map`, replaced the `log.meal_description`/`log.meal_photo_key` reads with a lookup into the already-computed `groupedMealsByDate[log.log_date]`: `mealSummary` joins that day's non-empty meal descriptions with ` · `, and `photoUrl` now resolves from the first meal entry that has a `photo_key` (via the existing `photoUrlMap`). Falls back to `truncate(null, 200)` → `'—'` when a day genuinely has no meal entries, same as before. `tsc --noEmit` clean.

Regression test:
- Not yet run in a real browser (no browser-automation tool available this session). Logic re-verified by hand against real production data: for client `566874ec-3121-4239-9ac9-c8d5fe50bcde`, `2026-08-27` has 4 real `meal_entries` rows with descriptions and photo keys — `groupedMealsByDate['2026-08-27']` will contain all 4, so `mealSummary` now resolves to a real joined string and `photoUrl` to a real signed URL, instead of `'—'`/no photo. **User should manually load this client's Overview tab in production to confirm the visual result before this is marked VERIFIED.**
