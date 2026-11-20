# Weight OCR — end-to-end test (APK + prod server OCR)

Closes gates (a) prod key/logs and (c) real-phone pass from
`docs/continuity/2026-11-18_WEIGHT_OCR_AUDIT_HANDOFF.md`.
Supersedes the ML Kit procedure in `WEIGHT_OCR_DEVICE_TEST.md` (stale: server OCR now reads the number).

## 0. Build the APK (needs EAS access to owner `silver-shadow`; not available on Adnan's machine)

Whoever holds the account runs, from a clean checkout of `main` (HEAD must include the strict parser, `lib/weight-ocr-parse.ts`; deploy web first):

```
cd apps/mobile
NODE_OPTIONS=--use-system-ca npx eas-cli login
NODE_OPTIONS=--use-system-ca npx eas-cli build --platform android --profile preview
```
Profile `preview` = internal APK. `.env` must have `EXPO_PUBLIC_API_BASE_URL=https://coachos-mvp-web.vercel.app` (prod) plus the Supabase URL/anon key.
Record the build ID + commit below. Last known build `5572e303` is OLD — do not test it.

## 1. Test setup
- Real Android phone (not BlueStacks), install APK, sign in as an ACTIVE client with a coach assigned.
- Photos: real scale display, plus the 4 reference photos in `Downloads/weight log/` (true: 81.70, 79.75, 76.40, 74.60).
- Vercel: project in team `adnans-projects-304695e1`, Logs filter `[weight-ocr]`.

## 2. Checklist

### A. Server gate (no phone)
- [ ] A1 Vercel prod has `ANTHROPIC_API_KEY`, Production scope ticked
- [ ] A2 Key is the valid one (not the old org-scoped `sk-ant-usr-` key)
- [ ] A3 Latest prod deploy contains the strict parser commit
- [ ] A4 `curl` POST `/api/weight/ocr` without a token returns 401

### B. Phone happy path (each photo)
- [ ] B1 81.70 photo reads 81.7
- [ ] B2 79.75 photo reads 79.75
- [ ] B3 76.40 WhatsApp screenshot reads 76.4 (no 55 / no clock)
- [ ] B4 74.60 photo reads 74.6
- [ ] B5 Live camera shot of a real scale reads correctly
- [ ] B6 Leading "7" is not dropped on any read
- [ ] B7 Value is written to the field and Submit saves a row (check Supabase `weight` row + photo path)

### C. Hard cases
- [ ] C1 Sideways / upside-down scale photo reads correctly or fails cleanly (never a wrong number)
- [ ] C2 Photo with no scale (random object) returns "couldn't read", logs `raw="none"`
- [ ] C3 No weight equal to a rotation angle (90/180/270) is ever logged
- [ ] C4 Retry ladder: 3 failures unlocks manual entry, photo kept
- [ ] C5 Manual entry submits OK

### D. Logs (per read, Vercel)
- [ ] D1 `[weight-ocr] path=… raw="…" parsed=… inRange=… stop=… out=…` line appears for every read
- [ ] D2 `stop=end_turn` (not `max_tokens`); `raw` is a bare number or `none`
- [ ] D3 No `unhandled error`, no `ANTHROPIC_API_KEY is not set`
- [ ] D4 Latency per read ≤ 60s (note actual seconds)

### E. Housekeeping
- [ ] E1 Camera quality gate (blur 90 / content 0.02) not rejecting good frames or accepting bad ones
- [ ] E2 Orphaned uploads from failed reads noted (purge cron `/api/weight/purge-photos` 15:00 UTC)

## 3. Report (fill in)

Date: ____  Tester: ____  Phone/Android: ____  Build ID: 3d208fe9-d31b-4f39-9216-99475c110320  Commit: e9b4bca
<!-- Build 3d208fe9 (commit e9b4bca) bundles: Gemini weight OCR, server-side steps OCR (mode=steps), and the Health-Connect->step-sensor fallback. Prod coachos-mvp-web deployed from e9b4bca. Supersedes build 8122e1e0/c2f8198. -->
<!-- Steps now have their own checks to run alongside the weight table: S1 auto-track reads via Health Connect OR the hardware step counter when HC is empty; S2 "Read steps from a photo" of a tracker screen writes the step count (server OCR, mode=steps); S3 a non-steps photo returns "couldn't read". -->


| # | Photo | True kg | Raw model text | Parsed | Latency s | Field showed | Pass |
|---|-------|---------|----------------|--------|-----------|--------------|------|
| B1 | 81.70 | 81.70 | | | | | |
| B2 | 79.75 | 79.75 | | | | | |
| B3 | 76.40 shot | 76.40 | | | | | |
| B4 | 74.60 | 74.60 | | | | | |
| B5 | live scale | | | | | | |
| C1 | rotated | | | | | | |
| C2 | no scale | none | | | | | |

Checklist result: A __/4  B __/7  C __/5  D __/4  E __/2
Failures / surprises:
Verdict (circle): SHIP / FIX FIRST / BLOCKED
