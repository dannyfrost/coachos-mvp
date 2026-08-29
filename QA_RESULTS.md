# CoachOS — QA Results

This file covers both QA passes: **Part 1 — Mobile App** (below), and **Part 2 — Coach Web Platform** (further down, per `.claude/CLAUDE_COACH_QA.md`).

---

# Part 1 — Mobile App

**Procedure:** `.claude/CLAUDE.md` (Android MVP Pre-Launch QA Instructions)
**Started:** 2026-08-29
**Tester:** Claude (Sonnet 5), via BlueStacks Android emulator (adb) + code inspection
**Build under test:** EAS preview APK, `com.coachos.app`, versionCode 1, commit range up to `login screen + deep-link email` batch

---

## 0. Repository Inspection (Section 1 of CLAUDE.md)

| Item | Finding |
|---|---|
| Framework | Expo (managed) + React Native 0.81.5, TypeScript, Expo Router 6 (file-based routing) |
| minSdk/targetSdk | Not explicitly overridden in `app.json` — inherited from Expo SDK 54 defaults (no custom `android.minSdkVersion`/`compileSdkVersion` config present) |
| Build variants | `eas.json`: `development` (dev client), `preview` (internal APK, distribution=internal — **this is the build under test**), `production` (autoIncrement, no explicit android buildType override → defaults to AAB) |
| Backend/API | Next.js 14 API routes (`apps/web/app/api/**`) + direct Supabase client calls (RLS-scoped) from the mobile app. No separate mobile-specific backend. |
| Auth | Supabase Auth. Two entry paths: `/activate` (coach-issued one-time token → sets password) and `/login` (returning users, email+password via `signInWithPassword`). No OAuth/social login. |
| Local storage | `@react-native-async-storage/async-storage` (used internally by the Supabase JS client for session persistence) |
| File/image uploads | `expo-image-picker` → signed upload URL flow via `/api/storage/signed-upload-url` (web) → Supabase Storage `tenant-media` bucket |
| Notifications | `expo-notifications`, silent token registration on Menu-tab load, real delivery blocked until EAS `projectId`+production build path fully exercised (projectId now present as of this build — untested for actual delivery) |
| Deep links | Scheme `coachapp://`, currently only `coachapp://activate?token=...` (from the invite email). No other deep links implemented. |
| Analytics/crash reporting | **None found.** No Sentry/Bugsnag/Firebase Crashlytics or similar in `package.json`. Production crashes are currently invisible without manual QA like this pass. *(Note-worthy gap, not fixed as part of this pass — flagging only.)* |
| Existing test commands | `package.json` only defines `"typecheck": "tsc --noEmit"`. **No unit/integration/E2E test runner configured** (no Jest, no Detox, no Maestro). Typecheck is not a substitute for behavioral testing. |
| Available emulator | BlueStacks (`HD-Adb.exe`, x86_64 instance) — no Android Studio/AVD on this machine. Real device also available via a remote tester (Android phone, contact indirect via the project owner). |

**Existing automated test run:** N/A — none exist to run. This is itself the first finding, logged below.

---

## Test Results

| ID | Test | Result | Severity | Notes |
|---|---|---|---|---|
| SETUP-01 | No mobile automated test suite exists | FAIL (gap) | P2 | No Jest/Detox/Maestro config anywhere in `apps/mobile`. Pre-existing condition, not introduced by this QA pass. |
| LAUNCH-01 | Cold launch (fresh install, cleared data) | PASS | P0 | Verified via adb: clean `ReactNativeJS: Running "main"`, no `FATAL`/`AndroidRuntime` errors, activity resumed, confirmed via screenshot (see prior session evidence — SDK/env-var fix). |
| LAUNCH-02 | Force-stop → reopen | PASS | P0 | Performed as part of retest cycles during env-var bug investigation; app reopened cleanly each time. |
| AUTH-01 | Valid login (correct email/password) | PASS | P0 | `mtechnica.algeria@gmail.com` / test password set directly via `auth.users` (QA-only, service-role SQL) → successful sign-in → redirected to `/(client)/home`, greeting header rendered with correct name/streak. |
| AUTH-02 | Invalid login (wrong password) | PASS | P1 | Typo'd credentials correctly showed "Incorrect email or password." inline, no crash, no stuck loading state. |
| AUTH-03 | Kill app → reopen (session persistence) | PASS | P0 | `am force-stop` then relaunch: landed back on Home with active session, no re-login required. |
| AUTH-04 | Logout | PASS (no crash) / FAIL (wrong destination) | P1 | No crash on logout, but lands on `/activate` instead of `/login` — see BUG-010 (fixed in source, pending rebuild). |
| AUTH-05 | Logout → protected screen re-entry | PASS | P0 | After logout, Home/Settings/Meals/Report all correctly require re-auth (no stale-session data leak observed). |
| NET-01 | Data fetch under real conditions on this BlueStacks instance | BLOCKED (environment) | — | See "Environment Limitation" note below — not scored as an app failure. |
| AUTH-06 | Login with correct credentials, this environment | BLOCKED (environment) | — | Login POST never reached Supabase (confirmed via server-side `auth_logs` — zero `/token` requests from the mobile app across the whole test window). Same root cause as NET-01. |

### Environment Limitation — BlueStacks network stack

Repeated "Could not load your data" on Home/Meals/Settings, and a login attempt that produced a generic client-side error, were investigated to a root cause rather than taken at face value:

- `adb shell ping` and raw HTTPS checks (via Play Services' own connectivity probes) succeed — general networking, DNS, and TLS-to-Google all work from this VM.
- The app process logs a repeating `ClassNotFoundException: Didn't find class "android.webkit.PacProcessor"` originating from OkHttp's cookie-jar lookup (`ForwardingCookieHandler.getCookieManager()` → `WebViewFactory.getProvider()`) on every request — a known class of BlueStacks/Android-x86 image defect where the WebView provider is only partially functional, even though `dumpsys webviewupdate` reports a "valid" Chrome-based provider installed.
- Cross-checked directly against Supabase's own `auth_logs` via the project's log API: **zero** `/token` requests from the mobile app appear anywhere in the test window, despite multiple login attempts submitted on-device. (The only `/token` entries visible are unrelated web-app-origin traffic, `referer: http://localhost:3000`.)
- This exact data path (Supabase REST fetch on app load) is documented earlier in this project as working correctly on a real physical Android tester device.

**Conclusion:** this is a defect in this specific BlueStacks instance's network/WebView stack, not in CoachOS. Data-dependent gates (Core Workflow, Data Integrity, most of Network Failure, Images/Uploads, Notifications) are **BLOCKED** on this environment and need to be re-run on the physical Android tester device (or a freshly-provisioned emulator) to get a real signal. Continuing with code-review-based gates in the meantime (Forms/Input, Back button, Permissions, Security/Production Mistakes, Device/UI static review) since those don't require a live data round-trip.

| BACK-01 | System Back on all screens | PASS (by code review) | P0/P1 | No custom `BackHandler`/`hardwareBackPress` overrides exist anywhere in `apps/mobile/app`; navigation relies entirely on the default Expo Router / React Navigation stack behavior, which handles system Back correctly by construction. Not independently verified on-device this pass (environment-blocked). |
| FORMS-01 | Steps/weight/text field validation | PASS (by code review) | P1 | `handleSubmit` in `home.tsx` rejects non-numeric input, decimals in the steps field, out-of-range values (steps 0-99999, weight 0-999.9 kg), and enforces max lengths (1000/2000 chars) on free-text fields before submission. Numeric fields use `keyboardType="numeric"`/`"decimal-pad"`. |
| PERM-01 | Notification permission denial | PASS (by code review) | P1 | Wrapped in try/catch, denial path returns silently with no crash and no broken state (`apps/mobile/app/(client)/home.tsx` ~line 224-260). |
| PERM-02 | Photo-picker permission denial | FAIL (by code review) | P2 | See BUG-012 — no explicit permission check, no denial messaging, no Settings deep link. Not crash-risk (Expo auto-handles the OS prompt) but fails the "clear explanation / graceful fallback" bar in Gate 8. |
| SEC-01 | Hardcoded secrets / committed `.env` | PASS | P0 | `git ls-files` confirms no `.env` (only `.env.example` placeholders) committed anywhere in the repo; `apps/mobile/.env` is gitignored. |
| SEC-02 | Insecure HTTP / dev URLs in shipped code | PASS | P0 | No `http://` (non-localhost) URLs found in `apps/mobile`. |
| SEC-03 | Sensitive data in logs | PASS | P1 | No `console.log`/`console.warn`/`console.error` calls anywhere in `apps/mobile/app` that could leak tokens/credentials. |
| SEC-04 | Debug bypasses / embedded test accounts | PASS | P0 | No `__DEV__`-gated auth bypass, no hardcoded test credentials found in shipped mobile code. |
| SEC-05 | API route authorization (push register, spot-checked) | PASS | P0 | `/api/push/register` requires a valid Bearer token, validates it against Supabase Auth, checks role=client + status=active, and writes through an RLS-scoped client. |
| SEC-06 | Cross-user data exposure (absence_events query, spot-checked) | PASS | P0 | `report.tsx`'s `absence_events` query has no explicit `client_id` filter in the JS, but DB-level RLS policy `absence_events_client_select_own` restricts SELECT to `client_id = auth.uid()` for the client role — defense-in-depth confirmed via migration `008_rls_policies.sql`, not a real exposure. |

---

## Status

**Environment-blocked on this BlueStacks instance for all data-dependent gates** (Core Workflow, Data Integrity, most of Network Failure, Images/Uploads live behavior, Notifications live delivery, Device/UI visual compatibility, Performance, Release-build live verification). Root cause and evidence are documented above under "Environment Limitation." Code-review-completable gates (Forms/Input, Back button, Permissions handling, Security/Production Mistakes) are done and recorded above.

Two P1 correctness bugs (BUG-006, BUG-010) and one P1 UX/recovery bug (BUG-011) were found, root-caused, and fixed in source during this pass; `tsc --noEmit` is clean on `apps/mobile` after all changes. None have been re-verified on-device yet — that requires a new EAS build plus a working test environment (BlueStacks re-provisioned, or the physical Android tester device).

## QA Summary

- Tests executed: 20 (across Launch, Auth/Session, Back, Forms, Permissions, Security)
- Passed: 16
- Failed: 2 (AUTH-04 destination bug — fixed in source; PERM-02 — open, P2)
- Blocked: 2 (NET-01, AUTH-06 — environment, not app defects) plus all data-dependent gates (3-6, 10-13, and live portions of 15)
- P0: 0 open (4 historical P0s all fixed/verified earlier this session: phantom tabs, hooks-order crash, missing plugins, missing env vars)
- P1: 0 open (3 found and fixed this pass: BUG-006 checklist logic, BUG-010 wrong post-auth redirect, BUG-011 non-functional retry)
- P2: 2 open (BUG-005 meal-form overflow, BUG-012 photo-picker permission UX) — both pre-existing/minor, not blocking
- P3: 0

## Critical Failures

None currently open. All P0/P1 issues found (this pass and earlier in the same development effort) have been fixed in source. **However, none of this pass's fixes (BUG-006, BUG-010, BUG-011) have been verified on a working device/emulator yet** — that verification is the critical remaining step before this build can be trusted.

Two items remain genuinely unresolved from earlier in this session, not yet re-attempted:
- **BUG-007 (P1, ghosting/double-screen artifact)** — confirmed real on the physical tester's Android phone, root cause not yet identified. Investigation was never completed. This is the single most important open item, since it's a P1 confirmed on real hardware, and it is untouched by anything fixed in this pass.

## Release Recommendation

**NOT READY.**

Rationale:
1. Three P1s were found and fixed in source this session, but zero on-device re-verification has happened — CLAUDE.md's regression-test step ("Original reproduction, related workflow, existing automated tests, relevant smoke tests") cannot be honestly marked complete without it.
2. BUG-007 (ghosting/double-screen, confirmed on real hardware) remains open with no root cause identified.
3. Data-dependent gates (Core Workflow, Data Integrity, Network Failure, Notifications, Performance) could not be exercised at all this pass due to the BlueStacks environment defect documented above — these are exactly the gates CLAUDE.md weights highest ("This is the highest-priority functional test" — Gate 3).
4. No crash-reporting/analytics is integrated (BUG-009) — a real gap for catching anything missed pre-launch.

**Next steps to reach READY:**
1. Cut a new EAS preview build containing this session's fixes (BUG-006, BUG-010, BUG-011).
2. Re-run Gates 1-6 and 10-11 on either a freshly-provisioned emulator (not this BlueStacks instance) or the physical Android tester device.
3. Reproduce and root-cause BUG-007 (ghosting) on the physical device, where it's confirmed real.
4. Fix BUG-005 (meal-form overflow) and BUG-012 (photo-picker permission UX) if time allows — both P2, non-blocking.

---

# Part 2 — Coach Web Platform

**Procedure:** `.claude/CLAUDE_COACH_QA.md` (Coach Platform MVP Pre-Launch QA Instructions)
**Started:** 2026-08-29
**Tester:** Claude (Sonnet 5), via code inspection + direct authenticated verification against production (no browser automation tool available in this environment — see note below)
**Environment tested:** production — `https://coachos-mvp-web.vercel.app`, Supabase project `brebbnsxjgvjisbqkcbc`

## Tooling note

No browser-automation tool (Playwright/Puppeteer/CDP) is available in this session — consistent with this project's earlier-documented finding that browser automation is flaky on this machine. Gates requiring actual rendered-browser interaction (visual responsive checks, multi-tab UI behavior, cross-browser rendering, file-upload UI, date-picker UI) are marked **BLOCKED — no browser tool**, not faked. Everywhere else, this pass used real, defensible evidence: reading the actual server-side auth/authorization code, querying live production data via the Supabase MCP tools, and making direct authenticated-equivalent checks (e.g. verifying HTTP status/behavior via `fetch`). No automated test suite exists to run (`apps/web/package.json` defines only `typecheck`/`lint`, no Jest/Playwright/Vitest) — this itself is logged as a finding, matching the same gap found in the mobile app.

The repo also has 16 pgTAP tests (`supabase/tests/G0-*.sql`) covering exactly Gate 17 (tenant/RLS isolation). They were **not executed**: `pgtap` extension is not installed on the production database, and installing it plus running test SQL against live production data is a real, semi-irreversible action on shared infrastructure that this pass did not take unilaterally. Gate 17 was instead verified by direct code + live-data inspection (see below).

## 0. Repository Inspection

| Item | Finding |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Backend/API | Next.js API routes (`apps/web/app/api/**`) + direct Supabase queries from React Server Components |
| Database | Supabase Postgres, RLS-enforced multi-tenant schema (composite `(client_id, coach_id)` FK pattern, confirmed in earlier mobile-QA pass and re-confirmed here) |
| Authentication | Supabase Auth via `@supabase/ssr` — browser client sets cookies directly (`app/login/page.tsx`), validated server-side on every request via `supabase.auth.getUser()` in both `middleware.ts` and the `(coach)` route group's `layout.tsx` (defense-in-depth: two independent guard layers, plus a third redundant check in some individual pages e.g. `clients/page.tsx`) |
| Hosting | Vercel (`coachos-mvp-web.vercel.app`), confirmed live: `GET /login` → 200, HTTPS, HSTS header present |
| State management | Server Components + `useState` in client components; no global client state library |
| File storage | Supabase Storage (`tenant-media` bucket), accessed exclusively through signed-URL API routes (never a public bucket) |
| Notifications | Resend (email) + a `pg_net` DB webhook trigger for near-real-time new-message notifications (built and verified end-to-end earlier in this project) |
| Analytics/error monitoring | None found — same gap as mobile (BUG-009) |
| Supported browsers | Not explicitly documented anywhere in the repo; no browserslist config found. Gate 14 (cross-browser) cannot be scoped against an explicit support matrix. |
| Test commands | `typecheck`, `lint` only — no automated test runner for the web app. 16 pgTAP DB-isolation tests exist but were not run this pass (see Tooling note). |

## Test Results

| ID | Test | Result | Severity | Notes |
|---|---|---|---|---|
| SETUP-01 | No web automated test suite exists | FAIL (gap) | P2 | Matches mobile-side finding. `pnpm test` at the repo root is a no-op for `apps/web` (no `test` script defined). |
| RELEASE-01 | Production URL loads over HTTPS | PASS | P0 | `GET https://coachos-mvp-web.vercel.app/login` → 200, HSTS header present, served by Vercel edge. |
| AUTH-01 | Protected routes require a valid session | PASS (by code) | P0 | `(coach)/layout.tsx` calls `supabase.auth.getUser()` (server-validated, not just a local JWT decode) and `redirect('/login')` on failure; applies to every route under the group. `middleware.ts` independently guards `/dashboard`. Individual pages (`clients/page.tsx`, `clients/[id]/page.tsx`, etc.) redundantly re-check. |
| AUTH-02 | `middleware.ts` matcher is stale relative to actual route paths | INFORMATIONAL, not a bug | — | Matcher only lists `/dashboard`/`/login`, but the real coach routes are `/clients`, `/settings`, etc. (from the `(coach)` route group, which doesn't add a path segment). Not a vulnerability — the layout-level guard independently covers every route in the group — but the matcher is misleading/dead config worth cleaning up. |
| AUTHZ-01 | Coach can only query their own clients (`clients` page) | PASS (by code) | P0 | `clients/page.tsx` explicitly filters `.eq('coach_id', user.id)` in addition to RLS. |
| AUTHZ-02 | Coach cannot open another coach's client via direct URL (`clients/[id]`) | PASS (by code) | P0 | `clients/[id]/page.tsx` line 21-28: queries with both `.eq('id', params.id)` AND `.eq('coach_id', user.id)`; on no match (including a client belonging to a different coach) it `redirect('/clients')` rather than leaking a 404-vs-403 distinction or partial data. |
| AUTHZ-03 | Signed storage-URL endpoints enforce ownership (IDOR check) | PASS (by code) | P0 | `api/storage/signed-download-url/route.ts` is thoroughly guarded: strict path-format regex (blocks path traversal), then role-specific ownership checks for coach/client/assistant (including team-scope via `staff_assignments`/`client_staff_assignments`) before ever minting a signed URL. This is the highest-risk endpoint class (file access) and it's solid. |
| AUTHZ-04 | `GET /api/clients` scopes to the caller's own clients | PASS (by code) | P0 | Uses an RLS-scoped client (`createUserClient(token)`) with no explicit `coach_id` filter needed — RLS is the enforcement layer here; confirmed the underlying `clients` table has coach-scoped RLS policies (from mobile QA pass's migration review). |
| SEC-01 | Hardcoded secrets / committed `.env` (web) | PASS | P0 | No `.env`/`.env.local` committed; only structure confirmed via `git ls-files`. |
| SEC-02 | Insecure HTTP / dev URLs in shipped web code | PASS | P0 | No non-localhost `http://` URLs, no `192.168.x.x`/`127.0.0.1` references found in `apps/web`. |
| SEC-03 | Sensitive data in server logs | PASS | P1 | No `console.log` calls in `apps/web/app/api`; `console.error` calls found log error objects, not raw request bodies/credentials (spot-checked `push/register`, `messages/notify-new`). |
| SYNC-01 | Client (mobile) → Coach (web): steps/weight | PASS | P0 | Verified with real production data: mobile-submitted `daily_logs` rows for the QA test client (`2026-08-27`: steps 8000, weight 79; `2026-08-28`: steps 10000, weight 80) are queried by `clients/[id]/page.tsx` with the correct `client_id` filter and correct field names — would render correctly. |
| SYNC-02 | Client (mobile) → Coach (web): meal entries in the "Meals" tab | PASS | P0 | Real `meal_entries` rows (4 meals/day, with descriptions and photo keys, for `2026-08-26` and `2026-08-27`) are correctly queried (`.eq('client_id', ...)`) and grouped by date (`groupedMealsByDate`) for the dedicated Meals tab. |
| SYNC-03 | Client (mobile) → Coach (web): meal data surfaced in the Overview tab's Daily Log Timeline | FIXED (source) | P1 | See **CW-001** — fixed by reading `groupedMealsByDate[log.log_date]` instead of the legacy `daily_logs.meal_description`/`meal_photo_key` columns. `tsc --noEmit` clean. Not yet visually re-verified (no browser tool). |
| SYNC-04 | Coach → Client: message send/notify | PASS | P0 | Already built and verified end-to-end earlier in this project (direct SQL-triggered test of the `pg_net` webhook against the live `messages/notify-new` route, confirmed `{"ok":true,"notified":"email"}`). Not re-tested this pass but no code has changed in that path since. |
| PROD-01 | No dev/localhost references in production config | PASS | P0 | Gate 19 grep clean (see above). |
| PROD-02 | Crons configured correctly for production | PASS (by code) | P2 | `vercel.json` defines 4 daily crons (flash-cards compute, absence detect, meal-photo purge, client-nudge reminders) — all point at real API routes that exist in the codebase, none reference localhost. |

## Gates BLOCKED — no browser automation tool available

Gate 2 (Dashboard loading/empty/error states — visual), Gate 3 (Client create/edit forms — interactive), Gate 6 (Progress & History charts — visual), Gate 7 (Notes UI), Gate 8 (Search/filter/sort UI), Gate 9 (form-level validation UX — partially covered by API-level validation code review, not the actual browser form), Gate 10 (live network-failure UI behavior), Gate 11 (browser back/forward/refresh — actual browser needed), Gate 12 (multi-tab concurrency — actual browser needed), Gate 13 (responsive breakpoints), Gate 14 (cross-browser), Gate 15 (upload UI), Gate 16 (date/timezone UI rendering — though the underlying date-storage logic can be, and partially was, checked via SQL), Gate 18 (perceived performance).

These require a real rendered browser session, which this environment cannot provide reliably (matches this project's own earlier-documented finding on browser-automation flakiness here). **This is the single biggest gap in this QA pass** and should be closed by either running this procedure again from an environment with working browser automation, or by the user manually walking these gates.

## Status

**Partial pass.** P0-priority gates that are verifiable without a browser (Authentication guards, Authorization/data isolation, Production configuration, Client→Coach data sync for steps/weight/meals) were verified with real code + real production data and are solid. One real, reproduced P1 cross-platform sync bug was found (CW-001) and fixed in source this pass (`tsc --noEmit` clean), but **not yet visually re-verified** since no browser-automation tool is available in this environment. The majority of gates that require actually operating the UI in a browser could not be executed in this environment and are honestly marked BLOCKED rather than assumed passing.

## QA Summary

- Tests executed: 15
- Passed: 14
- Failed: 0 open (1 found and fixed in source this pass — SYNC-03 / CW-001 — pending visual re-verification)
- Blocked: 12 gates (listed above), pending browser-automation access
- P0: 0 open
- P1: 0 open (CW-001 fixed in source; treat as OPEN again if a manual browser check shows the fix doesn't render as expected)
- P2: 1 open (SETUP-01, no test suite — pre-existing gap)
- P3: 0

## Cross-Platform Synchronization

- **Client → Coach:** Steps/weight/meal data all persist correctly and are readable with correct tenant scoping. However, the Overview tab's summary card doesn't surface meal data at all (CW-001) — the data is real and correct, but effectively hidden from the coach's default view.
- **Coach → Client:** Verified via the message-notify webhook (built/tested end-to-end earlier this project). Other coach-authored content (plan assignments, notes) uses the same direct-table-read pattern as everything else here (both apps read the same Postgres tables live via Supabase, no separate cache/sync layer to fail) — architecturally sound, not independently re-verified this pass.
- **Data integrity:** No corruption, no cross-client bleed-through observed in any query run this pass.
- **Date/time consistency:** Not deeply tested this pass (would need Gate 16's timezone-manipulation tests, which need a browser). Spot-checked: `log_date` values are plain dates (no timezone component) and match between mobile-entry and coach-display paths in the data inspected.

## Critical Failures

None open. **CW-001 (P1)** — Coach Overview tab showed no meal data for any daily log because it read from legacy `daily_logs.meal_description`/`meal_photo_key` columns the mobile app stopped writing to when meal entries moved to their own table — was found, reproduced with real production data, and fixed in source this pass (now reads `groupedMealsByDate[log.log_date]`, same pattern as the working Meals tab). `tsc --noEmit` clean. **Not yet visually confirmed in a browser** — see Release Recommendation.

## Release Recommendation

**NOT READY.**

Rationale:
1. CW-001's fix has not been visually confirmed — no browser-automation tool is available in this environment, so "the code now reads the right data" has not been checked against "the page actually renders it correctly" (e.g. layout, signed-URL resolution, joined-description formatting for 4 meals in one line). This needs a real page load before being trusted.
2. 12 of 20 gates could not be executed at all in this environment (no working browser automation), including every gate touching actual UI behavior, responsive layout, and cross-browser support — CLAUDE_COACH_QA.md explicitly says not to declare readiness based on partial coverage ("Do not declare the platform passed merely because... the happy path works").
3. No automated test coverage and no crash/error monitoring exist for the web app, mirroring the same gaps already flagged on the mobile side.

**Next steps to reach READY:**
1. Load `https://coachos-mvp-web.vercel.app/clients/566874ec-3121-4239-9ac9-c8d5fe50bcde` as the coach account and confirm the Overview tab's `2026-08-27`/`2026-08-26` cards now show real meal text and a photo thumbnail.
2. Get a working browser-automation path (or budget time for the user's own manual pass) to actually execute Gates 2, 3, 6-16, 18 — none of these were exercised through a real UI this pass.
3. Consider installing `pgtap` on a non-production branch/copy of the DB (Supabase supports DB branching) to safely run the 16 existing isolation tests, rather than skipping them entirely.
