# Handoff — Weight-OCR thread audit + how to close gate (a)

Written: 2026-11-18 (EST). Source: a Hermes Agent chat session on this machine.
For: the Claude Code instance working in this repo, or any next session picking up
the Weight-OCR thread. This is a READ of current state, not an instruction to
change code. Nothing here was committed.

Status label for this thread: **code complete, end-to-end unverified.**

---

## 0. Why this file exists

The founder asked for a point of view on this open thread:

> "Weight OCR on real device (key-scope + timeout dead-end root-caused and fixed
> on the web side; needs a fresh APK + real phone to confirm end-to-end)."

I audited the shipped code, git history, migrations, spec and test docs, ran the
tests myself, then gave a ranked assessment. The follow-up question was how to
achieve gate (a) — confirming the prod Anthropic key and reading the Vercel
`[weight-ocr]` logs. That procedure is in section 4.

Nothing was changed in the repo except this handoff file. Do not treat the
frozen root control docs (PROJECT_STATE.md, HANDOFF.md, TASK_LOG.md etc.) as
current; git log is the source of truth for this project.

## 1. What was actually verified in this session

Commands run from `C:\Users\Adnan\CoachOS` (canonical clone, `main`):

```
git branch --show-current            # main
git log --oneline -5                 # HEAD c995af1, working tree clean
git log --oneline --all -i --grep='ocr' / 'weight' / 'camera' -n 40
cd apps/mobile && ./node_modules/.bin/jest --runInBand
  -> Test Suites: 15 passed, 15 total; Tests: 145 passed, 145 total
```

Note: `corepack pnpm ...` is broken on this machine (cannot find
`corepack.js`); `pnpm` 9.0.0 is on PATH and the local `./node_modules/.bin/jest`
works. Running the suite was necessary — remembered pass counts from project
notes were not trusted.

Files traced end to end:
- Web route: `apps/web/app/api/weight/ocr/route.ts` (authz, Anthropic call, parse, logging)
- Mobile: `apps/mobile/app/(client)/home.tsx` (`uploadWeightPhoto`, `runWeightOcr`,
  run-id guards, save-time key reuse), `components/WeightCaptureCamera.tsx`,
  `lib/frameQuality.ts`, `lib/weightOcrState.ts`, `lib/weightEvidence.ts`
- DB: `supabase/migrations/025_weight_requires_photo.sql`,
  `026_partial_update_preserve.sql`, `027_weight_photo_storage_check.sql`
- Config: `apps/web/vercel.json` (weight photo purge cron at 15:00 UTC, 14-day cutoff)
- Docs: `docs/superpowers/specs/2026-08-29-weight-ocr-design.md`,
  `docs/WEIGHT_OCR_DEVICE_TEST.md`, `docs/WEIGHT_OCR_LAUNCH_ASSESSMENT.md`

Only env variable NAMES were inspected (`ANTHROPIC_API_KEY=` present in
`apps/web/.env.local`). No secret value was printed into the chat or this file.
Local `ANTHROPIC_API_KEY` starts `sk-ant-usr-` (same prefix as the known-bad
org-scoped key), so prefix alone cannot distinguish good from bad — compare the
last 6-8 characters instead.

## 2. What is genuinely defensible in the shipped work

- The root cause was established with evidence, not guessed: on-device ML Kit
  cannot read seven-segment LCD glyphs (drops the leading "7"). A 32-photo
  benchmark chose Sonnet + adaptive thinking (100% upright, 53% rotated) and
  the route config (model, `max_tokens: 4096`, `maxDuration: 60`, rotation-aware
  prompt) matches the benchmarked arm. Commits `f0c5099`, `af491b3`, `4ca6ba7`,
  `64ed7ce`, `c0656e9`.
- Defence in depth on the anti-cheat rule: UI photo gate + 3-attempt retry ladder
  keeping the photo as proof, then RPC enforcement (025), preserve-on-omit
  partial updates (026 — this caught a real latent data-loss bug where a
  steps-only sync wiped a logged weight), and storage-object existence plus
  folder ownership (027). Failures fail safe: no number logged rather than a
  confident wrong one.
- Route authz chain is tight: bearer token -> active client -> UUID path shape ->
  client folder -> coach match -> service-role download. No arbitrary object read.
- `runId` guards in `home.tsx` prevent stale OCR results clobbering a retake;
  camera framing hint from ML Kit is advisory only and never gates Capture.
- 145/145 mobile tests green at audit time. This is evidence about the code,
  not about deployment or hardware.

## 3. Ranked concerns (from the audit)

1. **The parser can silently log a wrong value.** `route.ts:155` takes the first
   numeric token anywhere in the model reply and range-checks 30-300. A reply
   containing e.g. "rotated 90 degrees: 81.70" yields `90`, which IS a valid
   weight, so the range check passes. The prompt says "never output degrees",
   which is a soft mitigation only. Extract a pure parse function and add web
   unit tests; there are currently zero tests on this route.

2. **Prod key state is unverified.** Notes from the 2026-11-13 session say the
   org-scoped `sk-ant-usr-` key was root-caused and a working key was placed only
   in LOCAL `apps/web/.env.local`; Vercel prod was never confirmed updated. I
   could not check Vercel here (no CLI on PATH, no `.vercel/project.json` link).
   If the bad key is still live, every read 500s and the app shows "couldn't
   read" three times into manual entry — silent degradation that the retry
   ladder hides. Separate 5xx/config errors from "photo unreadable" in the UI.

3. **Device-test doc is stale.** `docs/WEIGHT_OCR_DEVICE_TEST.md` documents the
   old on-device ML Kit pipeline and results from 2026-10-10 ("ML Kit cannot
   read these scales"). That is historical. There is no in-repo procedure for
   the current capture -> upload -> server OCR -> submit path (the client test
   script was in a session scratchpad that has since vanished). Also
   `docs/superpowers/specs/2026-08-29-weight-ocr-design.md` still says "no cloud
   vision API of any kind", directly contradicting shipped code. Mark both
   superseded / rewrite before anyone acts on them.

4. **Camera gate thresholds are uncalibrated on hardware.** `frameQuality.ts`
   uses `blurMin: 90`, `contentMin: 0.02` etc. from the prototype. On a real
   phone a low-contrast bathroom scale may never satisfy them and Capture is
   hard-disabled; the only escape is the gallery fallback. Calibrate on device
   or add a "capture anyway" path.

5. **Orphaned uploads.** Each failed attempt uploads its photo; only the latest
   is reused at save. Older objects remain in `tenant-media` until the daily
   14-day purge. Minor, but real.

## 4. Procedure for gate (a) — confirm prod key + read logs

Done from a browser; no Vercel CLI is installed or linked on this machine.

1. https://vercel.com -> team `adnans-projects-304695e1` -> project
   `coachos-mvp-web` -> Settings -> Environment Variables.
   Find `ANTHROPIC_API_KEY`. Confirm Production scope is ticked. Reveal the
   value and compare its LAST 6-8 CHARACTERS with the working key in
   `apps/web/.env.local` (do not paste either key into chat or a doc).
   If they differ, prod still has the org-scoped key that 400s.

2. If they differ: edit the variable in the dashboard, paste the working key,
   save, then Redeploy (Deployments -> latest -> Redeploy). Env var changes do
   not apply to existing deployments. Dashboard paste is safe — the trailing
   newline problem in earlier notes came from PowerShell pipe-to-process, not
   the UI.

3. Trigger a request. An unauthenticated curl is useless: the route returns 401
   at line 34 before touching the key or logging. Use a real client login in the
   app and take a scale photo, so upload -> `/api/weight/ocr` -> response all
   run. Check logs immediately afterwards (Hobby log retention is short).

   Dashboard: project -> Runtime Logs -> filter path `/api/weight/ocr`, search
   `weight-ocr`.
   CLI alternative: `npm i -g vercel`, prefix commands with
   `NODE_OPTIONS=--use-system-ca` (TLS cert error on this Windows box),
   `vercel login`, `cd apps/web && vercel link`, then `vercel logs --prod --follow`.
   `vercel env ls` shows names/scopes with values masked.

4. Interpret:
   - `[weight-ocr] path=... raw="81.70" parsed=81.7 inRange=true ...` -> gate
     (a) CLOSED; key works end to end on prod.
   - `[weight-ocr] ANTHROPIC_API_KEY is not set` -> var missing from that deployment.
   - `400 ... not scoped to a workspace` -> org-scoped key still live.
   - `401 ... invalid x-api-key` -> revoked / mistyped key.
   - `400 ... credit balance is too low` -> billing.
   - No `[weight-ocr]` line at all -> request never reached the route: wrong
     `EXPO_PUBLIC_API_BASE_URL` in the APK, auth rejected before logging, or a
     build predating the logging commit `c0656e9`.

Definition of done for (a): one log line with `inRange=true` plus a
`{weightKg: ...}` response on the prod deployment from a real client photo.

## 5. Suggested order of remaining work

(a) close the prod-key/log gate above. Then (b) extract + unit-test the parse
function so no "degrees" prose can become a weight. Then (c) cut a fresh EAS
preview APK from current `main` (last known build `5572e303` predates the guided
camera and the server-OCR config) and do ONE real-phone pass covering guided
capture -> server read -> submit -> RPC evidence. Until (c) is done the honest
status stays "code complete, end-to-end unverified" — do not shorten it to
"working".

Note: EAS project owner is `silver-shadow`, which the founder said someone else
holds; plan is for that person to cut the APK. iOS is Android-only v1; HealthKit
steps KPI is unbuilt on iOS.

## 6. Housekeeping

This file is intentionally uncommitted so the founder can review it. If the
repo is committed, scope the commit to this doc only — no code was changed in
this session.
