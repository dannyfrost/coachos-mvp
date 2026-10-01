# Handoff — Steps & Weight KPI debugging (phone-on-adb session)

**Written:** 2026-10-01 · **For:** the Claude Code instance on the machine that will be physically connected to the test phone via adb.
**Goal of your session:** run the test checklist below, capture evidence (especially the launch-crash logcat), and send a report back. Do **not** start fixing code until the crash is root-caused from a real stack trace — fix the root cause, not the symptom.

---

## 0. Context — what this project is and where it stands

- **CoachOS** = Next.js 14 + Supabase coaching platform. Mobile client = **Expo / React Native** (`apps/mobile`), SDK 54, RN 0.81.5. Managed workflow + config plugins (no committed `android/`).
- Repo: `github.com/dannyfrost/coachos-mvp` (private). Local canonical copy on the main machine: `C:\Users\hammd\CoachOS`. **Make sure you are at commit `83e7979` (current HEAD)** or newer. App package id: **`com.coachos.app`**.
- The **last open feature** blocking mobile launch is the **Steps KPI** (and secondarily Weight KPI). Everything else (auth, coach web, plans, messages, alerts, team, reports) is built and deployed.

### The two KPIs and how they're sourced today (`apps/mobile/lib/`)
- **Steps:** `stepsHealthConnect.ts` → `stepsPedometer.ts` (BROKEN) → `stepsOcr.ts` → `stepsManualOverride.ts`
- **Weight:** `weightHealthConnect.ts` → `weightOcr.ts` (+ `weightImagePreprocess.ts` using Skia) → manual
- Orchestration: `stepsSync.ts`, `app/(client)/home.tsx`.

### Known root causes already established (do not re-discover — verify)
1. **Pedometer is dead on Android.** `stepsPedometer.ts:119` calls `Pedometer.getStepCountAsync(start,end)` which is **iOS-only**; on Android it always throws `"Getting step count for date range is not supported on Android yet"`. expo-sensors only offers `watchStepCount` (live delta) on Android — no "today total" call.
2. **Health Connect manifest perms** were missing; added via custom config plugin `apps/mobile/plugins/withHealthPermissions.js` (commit `1f82952`) injecting `android.permission.health.READ_STEPS` + `READ_WEIGHT`.
3. **HC init-before-permission** fix (commit `83e7979`): permission ops now call `initialize()` first (react-native-health-connect requires it) — was why the grant dialog never appeared.
4. **Weight OCR** — ML Kit Latin recognizer **drops the seven-segment "7" glyph even after preprocessing**. Model limitation, not a preprocessing bug.

---

## 1. CURRENT BLOCKER — launch crash (TOP PRIORITY)

- Build **`68af5f54`** (commit `83e7979`, latest, has every fix) **white-screens and hard-crashes at launch** on the owner's device.
- Build **`eaadbf12`** (commit `7c96557`, **no Skia**) **opens fine** (but steps don't populate and weight OCR unfixed — expected).
- Bisection delta between them = `@shopify/react-native-skia 2.2.12` + `expo-file-system 19` + the HC-init JS change. **Leading hypothesis: Skia native lib fails to load at startup.** This is correlation only — **we have NOT seen the crash stack.**
- `expo install --check` flags only `@types/jest` (dev-only); it does NOT flag Skia or file-system versions.

**Decision that constrains the fix:** the owner wants to **keep (and later fix) weight OCR**, so we cannot simply remove Skia. We must know *why* Skia crashes to decide: fixable config (new-arch / ABI / version pin) vs Skia-incompatible-with-SDK-54 (then weight OCR needs a non-Skia preprocess path). **The logcat decides this.**

---

## 2. Decisions locked this session (target architecture)

- **Steps:** source of truth = **Health Connect (Android) / HealthKit (iOS)**, read on app-focus **and polled every 20–30 min**. Pedometer `watchStepCount` = foreground-only bonus. **No manual steps. No steps OCR.** (Foreground service for all-day sensor counting = deferred.)
- **Weight:** **HC/HealthKit + OCR (keep, fix) + manual kept.** (No phone sensor measures body weight, so manual stays.)
- **Add iOS HealthKit** (new native module + iOS build config) — later task.
- **Fix the Skia launch crash** (do not remove Skia).
- Polling note: 20–30 min polling is valid for HC/HealthKit (daily total is queryable any time). It is NOT valid for expo `watchStepCount` (only counts while actively watching).

---

## 3. Builds (EAS, profile `preview`, @silver-shadow/coaching-mobile)

| Build ID | Commit | Contains | APK URL | Status |
|---|---|---|---|---|
| `68af5f54` | `83e7979` | HC perms + HC-init + **Skia OCR** | https://expo.dev/artifacts/eas/Vl8vbeDBPewiKxWhvvxE5Wg1YVb88wXd7Y6uoEOglfU.apk | **CRASHES at launch** |
| `eaadbf12` | `7c96557` | HC perms, **no Skia** | https://expo.dev/artifacts/eas/m-_K5U4boD7bMF-qeHwDn3UTnNVvUoZTZw2S7_QpaVU.apk | opens; steps/OCR unfixed |
| `83e1fb3f` | `6af5dea` | pedometer error-logging | https://expo.dev/artifacts/eas/QAMOrPfAtGb1KikKS4m5KzaHKhEQU4TQdXUgmp0ZFBI.apk | opens |

New builds: `cd apps/mobile && NODE_OPTIONS=--use-system-ca npx eas-cli build:list --platform android` (TLS cert quirk on the Windows main machine needs that prefix; may differ on your machine). EAS user `silver-shadow` = `hammdiadnane@gmail.com`.

---

## 4. TEST CHECKLIST — run in order, capture everything

First, record device facts:
```bash
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release   # Android version
adb shell pm list packages | grep -iE "healthconnect|google.android.apps.fitness|sec.android.app.shealth|fitbit"  # step providers
```

### TEST 1 — Launch-crash root cause (HIGHEST PRIORITY)
```bash
adb install -r <path to 68af5f54 apk>
adb logcat -c
# launch the app, let it white-screen/crash
adb logcat -d > crash_full.txt
adb logcat -d *:E | grep -iE "skia|UnsatisfiedLink|FATAL|AndroidRuntime|libhermes|Fabric|dlopen|coachos" | head -60
```
Capture the **full FATAL / AndroidRuntime stack**. That single stack says whether it's Skia (`libskia`/`UnsatisfiedLinkError`/`dlopen`), a new-architecture/Fabric mismatch, or something else.

### TEST 2 — Health Connect permissions actually declared
```bash
adb shell dumpsys package com.coachos.app | grep -i "health" 
```
Expect `android.permission.health.READ_STEPS` and `READ_WEIGHT` in the requested-permissions list. If absent, the `withHealthPermissions.js` plugin didn't take in this build.

### TEST 3 — Steps via Health Connect (use a build that OPENS)
Install `eaadbf12` (or the fixed build once TEST 1 is solved). Then:
- Confirm a **step provider** is writing to HC (Google Fit / Samsung Health installed and has walked steps today). HC aggregates; it does not count by itself.
- In-app: grant Health Connect when prompted. Walk. Pull-to-refresh.
```bash
adb logcat -c
# open app, focus the client home/daily-log, grant HC, walk, refresh
adb logcat -d | grep -iE "\[stepsForegroundSync\]|\[stepsHealthConnect\]|\[stepsSync\]|healthconnect" | head -40
```
Record whether steps populate and the exact log lines (look for `healthConnect: 'permission_denied' | 'unavailable' | <number>`).

### TEST 4 — Pedometer error (confirm the known bug)
```bash
adb logcat -d | grep -iE "\[stepsPedometer\]" | head -20
```
Expect `readTodaySteps error: ... not supported on Android yet`. Confirms the iOS-only call. Also confirm sensors exist:
```bash
adb shell dumpsys sensorservice | grep -iE "step"   # Step Counter / Step Detector present?
```

### TEST 5 — Weight OCR against a real scale
- Photograph a real scale display (seven-segment) through the in-app flow.
```bash
adb logcat -c
# run the weight photo flow
adb logcat -d | grep -iE "\[weightOcr\]|\[weightForegroundSync\]|mlkit|recognizeText" | head -40
```
Record: did it read any digits, which digits dropped (watch for the "7"), final value vs actual.

---

## 5. adb / environment gotchas (from prior sessions on the main machine — may differ on yours)
- **Wireless adb pair** throws `protocol fault (couldn't read status message)` intermittently on the main machine's adb (Scoop shim); **retry in a loop, ~1 in 4 succeeds.** `adb pair <ip>:<pairport> <code>` then `adb connect <ip>:<connectport>` (ports differ; `adb mdns services` to discover).
- **Git Bash mangles `/sdcard/...`** → prefix with `export MSYS_NO_PATHCONV=1`.
- **BlueStacks** has no hardware step sensor and no HC → cannot test steps there (OCR-from-gallery is testable).
- **SAFETY:** do not run blind `adb input tap` on a phone that may have an active call / floating overlay (a past session accidentally started a live screen-share). Confirm screen state first.

---

## 6. Report back to the main session with:
1. **TEST 1 full crash stack** (the single most important thing) + your read of the culprit.
2. Device model + Android version + which step providers are installed.
3. TEST 2 permission list (health perms present yes/no).
4. TEST 3 result: did steps populate via HC, and the `[stepsHealthConnect]`/`[stepsForegroundSync]` lines.
5. TEST 4: confirm pedometer error string + sensors present.
6. TEST 5: weight OCR behavior on a real scale.

With TEST 1's stack, the main session will root-cause the crash and write the implementation plan (fix Skia vs replace OCR preprocess; pedometer `watchStepCount`; HC/HealthKit periodic sync; drop manual steps / keep manual+OCR weight; add HealthKit).
