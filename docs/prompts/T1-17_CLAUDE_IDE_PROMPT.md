# T1-17 — Real-Coach Core Loop + Mobile Runtime Validation
# Claude IDE Validation Prompt

**Task ID:** T1-17
**Date issued:** 2026-06-01
**Nature:** VALIDATION ONLY — no new features, no migrations, no schema changes
**Issued by:** Claude CMD (Planner)
**Requires founder approval to proceed:** NO — already approved 2026-06-01

---

## 0. READ FIRST — Rules for This Task

- This is a **validation-only** task. You are not building anything.
- Do **not** run `supabase db reset` unless the founder explicitly approves after a failure report.
- Do **not** modify: migrations, RLS policies, `database.types.ts`, any schema file, any npm package list (no new installs).
- You **may** apply a small non-migration bug fix only if it is clearly required to complete validation AND falls within the approved scope below.
- **Approved small fixes (no approval needed):** typo in response field name, wrong HTTP status code usage, missing null check causing crash, env var key mismatch, local config issue.
- **Out of scope without explicit founder approval:** migrations, RLS, `database.types.ts`, schema changes, new npm packages, new feature behavior, any Tier 2 work.
- If you hit a blocker that requires an out-of-scope fix, **STOP and report** — do not attempt the fix.
- Keep `apps/web/.env.local` and `apps/mobile/.env` untracked and never commit them.
- Do not stage or commit: `claude agents/`, `.codex/`, `.env`, `.env.local`.
- Update control docs (`PROJECT_STATE.md`, `TASK_LOG.md`, `CLAUDE_IDE_CONTEXT_HANDOFF.md`) after validation completes.
- Commit control doc updates only (plus any approved small bug fix).

---

## 1. Pre-Flight Checklist — Complete All Before Starting Validation

Work through each step in order. Stop and report if any pre-flight fails.

### 1-A. Confirm working directory
```powershell
Set-Location E:\Claude-project-Coaching-app-MVP
Get-Location
```
Expected: `E:\Claude-project-Coaching-app-MVP`

### 1-B. Confirm git state — no unexpected staged files
```powershell
git status --short
git log --oneline -3
```
Expected: HEAD = `3b0f746`, no staged changes, untracked = `claude agents/` and `.codex/` only.

### 1-C. Confirm local Supabase is running
```powershell
npx supabase@2.98.2 --workdir . status
```
Expected: all services listed, DB healthy. If not running:
```powershell
npx supabase@2.98.2 --workdir . start
```
Wait until all services are healthy. Do NOT run `db reset`.

### 1-D. Confirm existing test coach data is usable
```powershell
npx supabase@2.98.2 --workdir . db query "SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;"
```
Expected: at least one coach account from T1-16 testing. Record the coach email for use in step 3.

If no usable data exists, report to founder before proceeding. Do not run db reset without approval.

### 1-E. Get machine LAN IP
```powershell
ipconfig | Select-String "IPv4"
```
Record the LAN IP (e.g., `192.168.x.x`). This is used for all mobile env vars — **never use 127.0.0.1 for physical device**.

### 1-F. Get real Supabase JWT keys from Docker
```powershell
docker exec supabase_storage_s3 env | Select-String "ANON_KEY|SERVICE_KEY"
```
If container name differs, try:
```powershell
docker ps --format "{{.Names}}" | Select-String "storage"
```
Then rerun with correct container name. Record:
- `ANON_KEY` = real HS256 JWT (long token, not `sb_publishable_*`)
- `SERVICE_KEY` = real service role JWT

Confirm `apps/web/.env.local` already has these values (do not overwrite if correct):
```powershell
Get-Content apps\web\.env.local
```

### 1-G. Confirm apps/mobile/.env is gitignored
```powershell
git check-ignore -v apps/mobile/.env
```
Expected: output shows `.gitignore:15:.env  apps/mobile/.env` (or similar — confirming it is ignored).
If NOT ignored, stop and report.

### 1-H. Create apps/mobile/.env
Replace `[LAN_IP]` with the IP from step 1-E. Replace `[ANON_JWT]` with the ANON_KEY from step 1-F.

Create the file `apps/mobile/.env` with exactly these contents:
```
EXPO_PUBLIC_API_BASE_URL=http://[LAN_IP]:3000
EXPO_PUBLIC_SUPABASE_URL=http://[LAN_IP]:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=[ANON_JWT]
```

**Do not commit this file.**

After creating, verify it is ignored:
```powershell
git status --short apps/mobile/.env
```
Expected: no output (gitignored = not shown).

### 1-I. Start web dev server (background)
```powershell
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location E:\Claude-project-Coaching-app-MVP; pnpm --filter web dev'
```
Wait ~15 seconds, then confirm:
```powershell
Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing | Select-Object StatusCode
```
Expected: `StatusCode: 200`

### 1-J. Start Expo / Metro bundler (background)
```powershell
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location E:\Claude-project-Coaching-app-MVP\apps\mobile; npx expo start --lan'
```
Wait for Metro to print a QR code and the LAN URL (e.g., `exp://192.168.x.x:8081`).

**Founder action required:** Scan the QR code with Expo Go on the Android device. Confirm the app loads to the activation/index screen.

Record: Metro LAN URL for the validation log.

### 1-K. Pre-flight complete
If all of 1-A through 1-J passed, record:
- Coach email (from 1-D)
- Machine LAN IP (from 1-E)
- Supabase running: YES
- Web app running on :3000: YES
- Metro running, device connected: YES (founder confirms)

---

## 2. Locked Decisions

| ID | Decision |
|----|----------|
| D-T1-17-01 | Reuse T1-16 test data. No db reset without founder approval. |
| D-T1-17-02 | Physical Android device via Expo Go. |
| D-T1-17-03 | LAN connection first; tunnel fallback if LAN fails. |
| D-T1-17-04 | `apps/mobile/.env` created locally, gitignored, never committed. LAN IP used, not 127.0.0.1. |
| D-T1-17-05 | Device photo library for meal photo. Camera test deferred. |
| D-T1-17-06 | Small non-migration bug fixes only if blocking. Out-of-scope = stop and report. |
| D-T1-17-07 | All YES criteria must pass for T1-17 PASS. |

---

## 3. Validation Flow

Execute in order. Record pass/fail for each step.

---

### STEP 1 — Coach Login

**Web browser:** `http://localhost:3000/login`

Enter the coach email and password from T1-16 test data.

Expected:
- Login succeeds, redirects to `/dashboard`
- Dashboard renders without error
- Flash card grid visible (may be empty if no clients have logged)

Record: login result, dashboard renders Y/N.

---

### STEP 2 — Invite a Client

**Option A — Reuse existing client:** If T1-16 created a client whose activation_token is still valid (< 7 days old), skip to Step 3.

Check existing client invite status:
```powershell
npx supabase@2.98.2 --workdir . db query "SELECT c.id, pu.email, c.activated_at, c.invite_token_hash FROM clients c JOIN platform_users pu ON pu.id = c.id WHERE c.coach_id = (SELECT id FROM coaches LIMIT 1) ORDER BY c.created_at DESC LIMIT 3;"
```

If `activated_at` is NULL and a recent client exists → token is still usable → use it.
If `activated_at` is NOT NULL → client already activated → skip to Step 3 using that client's session.
If no client exists → proceed to Option B.

**Option B — Invite new client via API:**
```powershell
# First get coach JWT by logging in
$loginRes = Invoke-RestMethod -Uri "http://localhost:3000/api/login" -Method POST -ContentType "application/json" -Body '{"email":"[COACH_EMAIL]","password":"[COACH_PASSWORD]"}'
$coachJwt = $loginRes.access_token

# Invite client
$inviteRes = Invoke-RestMethod -Uri "http://localhost:3000/api/clients/invite" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $coachJwt" } -Body '{"email":"testclient@example.com","full_name":"Test Client"}'
$activationToken = $inviteRes.activation_token
$clientId = $inviteRes.client_id
```

Record: `activation_token` (full raw value) and `client_id`.

---

### STEP 3 — Activate Client on Mobile (Expo Go)

**On the Android device in Expo Go:**

1. Navigate to the activation screen (root screen of the app).
2. In the "Activation Token" field, paste the raw `activation_token` from Step 2.
3. Enter a test password (e.g., `TestPass123!`).
4. Confirm password.
5. Tap "Activate Account".

Expected:
- No network error
- Activation succeeds
- App navigates to `/(client)/home`

If network error occurs: confirm the device can reach `http://[LAN_IP]:3000` (try in device browser). If unreachable, switch to Expo tunnel mode:
```powershell
# Stop current Metro, restart with tunnel
npx expo start --tunnel
```
Rescan QR code. API_BASE_URL in `.env` must also be updated to the tunnel URL — update `apps/mobile/.env` EXPO_PUBLIC_API_BASE_URL to the tunnel URL and restart Metro.

Record: activation result, navigation to home Y/N.

---

### STEP 4 — Submit Today's Log from Mobile

**On the Android device, on the Home/Today screen:**

Submit a daily log with all fields populated:
1. Steps: `8000`
2. Weight: `75` (or any number)
3. Meal description: `Test meal — grilled chicken and rice`
4. Meal photo: tap photo button → select any image from device library
5. Questions/notes: `Feeling good today`
6. Tap submit

Expected:
- Photo upload: signed URL returned, PUT succeeds (photo appears as thumbnail or upload confirmed)
- Log submission: success response from `update_today_log` RPC
- No crash in Metro log
- No error shown on screen

**Verify log was saved:**
```powershell
npx supabase@2.98.2 --workdir . db query "SELECT id, log_date, p_steps, p_weight, p_meal_description, meal_photo_key, created_at FROM daily_logs ORDER BY created_at DESC LIMIT 3;"
```
Expected: a row with today's date and the values entered.

Record: log saved Y/N, `meal_photo_key` populated Y/N.

---

### STEP 5 — Run Flash Card Compute

```powershell
$cronSecret = (Get-Content apps\web\.env.local | Select-String "CRON_SECRET").ToString().Split("=",2)[1].Trim()
$computeRes = Invoke-RestMethod -Uri "http://localhost:3000/api/flash-cards/compute" -Method POST -Headers @{ Authorization = "Bearer $cronSecret" }
$computeRes | ConvertTo-Json
```

Expected response:
```json
{ "processed": N, "errors": 0 }
```
Where N ≥ 1 (at least the test client was processed).

Record: processed count, errors count.

---

### STEP 6 — Verify Dashboard Updates

**Web browser:** `http://localhost:3000/dashboard` (refresh if already open)

Expected:
- Test client appears as a flash card on the dashboard
- Flash card shows client name
- Flash status is green, yellow, or red (any — just must render)
- No error page, no blank card

Record: client flash card visible Y/N, flash status value.

---

### STEP 7 — Verify /clients List

**Web browser:** `http://localhost:3000/clients`

Expected:
- Test client visible in list
- Client status shows `active`
- No error

Record: client visible in list Y/N.

---

### STEP 8 — Verify /clients/[id] Client Profile

**Web browser:** `http://localhost:3000/clients/[CLIENT_ID]`
(Replace `[CLIENT_ID]` with the UUID from Step 2.)

Expected:
- Client name and info renders
- Daily log entry visible (today's date)
- Photo thumbnail renders (if photo was uploaded in Step 4) OR photo section present but empty if upload did not complete
- Flash card notes area visible
- Pause button visible

Check each sub-item:

| Sub-check | Expected | Result |
|-----------|----------|--------|
| Client info renders | Y | |
| Daily log visible | Y | |
| Photo thumbnail renders | Y (if upload succeeded) | |
| Flash card notes area | Y | |
| Pause button visible | Y | |

Record: all sub-checks.

---

### STEP 9 — Pause/Unpause Client

**On /clients/[id]:**

1. Click "Pause" button.
   Expected: client status changes to paused, button changes to "Unpause" (or equivalent), no error.

2. Click "Unpause" button.
   Expected: client status returns to active, no error.

Verify state via API:
```powershell
npx supabase@2.98.2 --workdir . db query "SELECT status FROM platform_users WHERE id = '[CLIENT_ID]';"
```
Expected: `active` after unpause.

Record: pause success Y/N, unpause success Y/N.

---

### STEP 10 — Metro Log and Browser Console Check

Review Metro log output (in the background PowerShell window):
- Any `ERROR` or `Warning: ...` lines?
- Any unhandled promise rejections?
- Any `Network request failed` errors not already documented?

Review web browser developer console (F12) on:
- `/dashboard`
- `/clients`
- `/clients/[id]`

Expected: no uncaught JS errors, no failed network requests (except expected 401s on protected routes when unauthenticated).

Record: Metro errors (list any), browser console errors (list any).

---

## 4. Pass Criteria — T1-17

All items marked YES must pass. Any NO = T1-17 FAIL.

| # | Criterion | Required | Result |
|---|-----------|----------|--------|
| 1 | Coach login succeeds | YES | |
| 2 | Client invite created (new or existing) | YES | |
| 3 | Client activates on Expo Go (mobile runtime confirmed) | YES | |
| 4 | App navigates to /(client)/home after activation | YES | |
| 5 | Daily log submits (steps, weight, description) | YES | |
| 6 | Photo upload produces signed URL and PUT succeeds | YES | |
| 7 | daily_logs row saved with meal_photo_key populated | YES | |
| 8 | Flash card compute returns processed ≥ 1, errors = 0 | YES | |
| 9 | Dashboard shows updated client flash card | YES | |
| 10 | /clients list shows client as active | YES | |
| 11 | /clients/[id] renders client info and daily log | YES | |
| 12 | /clients/[id] shows photo thumbnail | YES | |
| 13 | /clients/[id] shows flash card notes area | YES | |
| 14 | Pause succeeds from client profile | YES | |
| 15 | Unpause succeeds from client profile | YES | |
| 16 | Zero crash-level errors in Expo Go Metro log | YES | |
| 17 | Zero uncaught JS errors in web browser console | YES | |

---

## 5. Bug Documentation Format

For each bug found, record:

```
BUG-T1-17-NN
Screen/Step: [step number and name]
Severity: BLOCKING | MINOR
Description: [what happened]
Expected: [what should have happened]
Fix applied: YES/NO
Fix description: [if yes, what was changed and which file]
Fix scope: [in-scope / out-of-scope]
```

---

## 6. Files Allowed to Modify

| File | Allowed change |
|------|---------------|
| `apps/mobile/.env` | Created new (gitignored, never committed) |
| `apps/web/.env.local` | Read-only; may be updated only if ANON_KEY/SERVICE_KEY is wrong (gitignored, never committed) |
| `PROJECT_STATE.md` | Update with T1-17 results |
| `TASK_LOG.md` | Append T1-17 session log |
| `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` | Update current state |
| Any source file with an approved small bug fix | Only if bug is BLOCKING, in-scope, and documented |

---

## 7. Files Explicitly NOT to Modify

| File/Path | Reason |
|-----------|--------|
| `supabase/migrations/*` | Immutable — no approval |
| `packages/supabase/database.types.ts` | No schema changes in this task |
| `supabase/tests/*` | Gate 0 test files — immutable |
| Any new npm package installation | No new deps without founder approval |
| `DECISIONS.md` | No new decisions in validation task |
| `apps/web/app/api/**` | No API changes unless blocking bug, in-scope, approved |
| `apps/mobile/app/**` | No feature changes; only approved blocking bug fixes |

---

## 8. Exact Validation Commands Reference

All commands are PowerShell. Run from `E:\Claude-project-Coaching-app-MVP`.

```powershell
# Supabase status
npx supabase@2.98.2 --workdir . status

# Get LAN IP
ipconfig | Select-String "IPv4"

# Get JWT keys from Docker
docker exec supabase_storage_s3 env | Select-String "ANON_KEY|SERVICE_KEY"

# Check existing users
npx supabase@2.98.2 --workdir . db query "SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;"

# Check existing clients + invite tokens
npx supabase@2.98.2 --workdir . db query "SELECT c.id, pu.email, c.activated_at FROM clients c JOIN platform_users pu ON pu.id = c.id ORDER BY c.created_at DESC LIMIT 3;"

# Coach login (replace values)
$loginRes = Invoke-RestMethod -Uri "http://localhost:3000/api/login" -Method POST -ContentType "application/json" -Body '{"email":"COACH_EMAIL","password":"COACH_PASS"}'
$coachJwt = $loginRes.access_token

# Invite client
$inviteRes = Invoke-RestMethod -Uri "http://localhost:3000/api/clients/invite" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $coachJwt" } -Body '{"email":"testclient@example.com","full_name":"Test Client"}'
$activationToken = $inviteRes.activation_token

# Run flash-card compute
$cronSecret = (Get-Content apps\web\.env.local | Select-String "CRON_SECRET").ToString().Split("=",2)[1].Trim()
Invoke-RestMethod -Uri "http://localhost:3000/api/flash-cards/compute" -Method POST -Headers @{ Authorization = "Bearer $cronSecret" } | ConvertTo-Json

# Check daily log saved
npx supabase@2.98.2 --workdir . db query "SELECT id, log_date, p_steps, p_weight, meal_photo_key FROM daily_logs ORDER BY created_at DESC LIMIT 3;"

# Check client status after pause/unpause
npx supabase@2.98.2 --workdir . db query "SELECT id, status FROM platform_users WHERE id = 'CLIENT_UUID';"

# Verify apps/mobile/.env is gitignored
git check-ignore -v apps/mobile/.env

# Final git status check
git status --short
```

---

## 9. Control Document Updates (After Validation)

After completing all steps, update the following regardless of pass/fail:

### PROJECT_STATE.md
Add row to Completed Tasks table:
```
| T1-17 | Real-Coach Core Loop + Mobile Runtime Validation | 2026-06-01 | [PASS/FAIL — summary] |
```

Add T1-17 verification log section with:
- All 17 pass criteria results
- Bug list (or "None")
- Gate 1 final status confirmation

If PASS: update "Next Up" section to:
> **Tier 2 planning** — T1-17 complete [date]. Mobile runtime validated. Gate 1 core loop fully validated. Requires founder approval before starting Tier 2.

If FAIL: update "Next Up" to list blocking issues and state T1-17 is incomplete.

### TASK_LOG.md
Append T1-17 session log:
- What ran
- Pre-flight results
- All 17 checklist results
- Bugs found and fixes applied (if any)
- Artifacts produced
- Gate recommendation

### CLAUDE_IDE_CONTEXT_HANDOFF.md
Update:
- "Updated" date → 2026-06-01
- Current state description → T1-17 PASS/FAIL + result summary
- "Current next task" → Tier 2 planning (if PASS) or T1-17 blocked (if FAIL)

---

## 10. Commit

After control doc updates, commit:
```powershell
git add PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

If an approved small bug fix was applied, also stage those files.

Do NOT stage:
- `apps/mobile/.env`
- `apps/web/.env.local`
- `claude agents/`
- `.codex/`
- Any unrelated file

Commit message format:
```
feat(validation): T1-17 [PASS/FAIL] — mobile runtime + core loop validated
```

Or if bug fix included:
```
fix(mobile): [brief fix description]; T1-17 validation [PASS/FAIL]
```

---

## 11. Final Deliverable to Report

After this task, report to founder:

1. **T1-17 result:** PASS or FAIL
2. **Pass criteria:** N/17 passed
3. **Bugs found:** list or "None"
4. **Fixes applied:** list or "None"
5. **Recommendation:** Ready for Tier 2 planning / OR blocked by [issue]
6. **Commit hash** of control doc update

---

## 12. Locked Decision Log for This Task

| Decision ID | Item | Locked Value |
|-------------|------|-------------|
| D-T1-17-01 | Test data strategy | Reuse T1-16 data; no db reset without founder approval |
| D-T1-17-02 | Mobile runtime target | Physical Android device, Expo Go |
| D-T1-17-03 | Expo connection mode | LAN first; tunnel fallback |
| D-T1-17-04 | apps/mobile/.env | Created locally, gitignored, LAN IP not 127.0.0.1 |
| D-T1-17-05 | Photo test asset | Device photo library; camera deferred |
| D-T1-17-06 | Bug fix authority | Small non-migration only; out-of-scope = stop and report |
| D-T1-17-07 | Pass criteria | All 17 YES items must pass |
| D-T1-17-08 | Manual token entry | Confirmed wired in activate.tsx; deep-link not required for PASS |
| D-T1-17-09 | No db reset | Default is reuse; reset requires explicit founder approval |
| D-T1-17-10 | Commit scope | Control docs + approved bug fixes only; never commit .env files |
