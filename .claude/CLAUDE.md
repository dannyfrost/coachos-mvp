# Android MVP Pre-Launch QA Instructions

## Purpose

Act as a senior Android QA engineer and debugging engineer.

Systematically test this fitness coaching MVP before launch. Do not test randomly. Prioritize critical user journeys and common Android failure modes.

The application has two primary experiences:
- Coach: manage clients, review activity/progress, review logs/check-ins, provide feedback.
- Client: record daily activities, submit check-ins/logs, view progress, and receive implemented reminders/feedback.

Do not invent features. First inspect the repository and test what is actually implemented.

---

# 1. Before Testing

1. Inspect the repository structure.
2. Identify:
   - Framework/language
   - minSdk and targetSdk
   - Build variants
   - Backend/API architecture
   - Authentication
   - Local storage
   - File/image uploads
   - Notifications/deep links
   - Analytics/crash reporting
3. Identify all existing test commands.
4. Identify available emulator/device.
5. Build the application normally.
6. Run existing automated tests.
7. Record existing failures before making changes.

A successful build is not evidence that the app is healthy.

---

# 2. Severity

### P0 — Release Blocker
- Crash/ANR/freezing
- Cannot launch
- Cannot authenticate
- Core workflow cannot complete
- Data loss/corruption
- Cross-user data exposure
- Critical production configuration failure

### P1 — High
- Major feature broken
- Important synchronization failure
- Session/authentication problem
- Major navigation failure
- Important feature fails under normal conditions

### P2 — Medium
- Incorrect empty state
- Retry/state issue with workaround
- Minor data inconsistency
- Non-blocking UI/functionality problem

### P3 — Low
- Cosmetic/UI polish
- Minor copy/spacing/alignment issue

---

# 3. Test Gates

Run gates in this order. Do not spend time on cosmetic issues while P0 failures remain.

## GATE 1 — Installation & Launch

Test:
- Fresh install
- First launch
- Cold launch
- Warm launch
- Force-stop → reopen
- Device reboot → launch
- Process killed → reopen
- Recent apps → reopen
- Upgrade from previous version if available
- Uninstall/reinstall

Verify:
- No crash
- No ANR
- No infinite spinner
- Correct first-run behavior

## GATE 2 — Authentication

### Signup
- Valid signup
- Empty fields
- Invalid email
- Weak password
- Existing account
- Long input
- Special characters

### Login
- Valid credentials
- Wrong password
- Unknown account
- Empty fields
- Offline
- Slow network
- API error

### Session
- Login → kill app → reopen
- Login → background → return
- Expired token
- Logout
- Logout → reopen
- Logout → protected screen
- Switch accounts

Verify:
- Correct authentication state
- No infinite loading
- No stale user data
- No unauthorized access

## GATE 3 — Core Fitness Workflow

Determine the actual primary workflow implemented.

Example:
Login → Client → Daily Log → Enter Data → Submit → Confirmation → Coach Views Data

Test:
- Normal completion
- Empty submission
- Invalid values
- Extreme values
- Duplicate submission
- Double-tap submit
- Back during submission
- Kill app during submission
- Network failure during submission
- Retry
- Refresh
- Navigate away and return
- Restart app → verify persistence

This is the highest-priority functional test.

## GATE 4 — Data Integrity & Isolation

For important data:
1. Create
2. Read
3. Edit
4. Save
5. Refresh
6. Navigate away
7. Kill app
8. Reopen
9. Verify
10. Logout/login
11. Verify again

Check:
- Missing records
- Duplicate records
- Stale records
- Wrong dates/timestamps
- Wrong client association
- Cross-account data exposure
- Incorrect user/client IDs

## GATE 5 — Network Failure

Test important API operations with:
- Normal network
- No internet
- Airplane mode
- Disconnect during request
- Slow network
- Timeout
- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 404
- HTTP 409
- HTTP 500
- Empty response
- Unexpected/malformed response

Verify:
- Useful error state
- Retry where appropriate
- No infinite spinner
- No crash
- No duplicate requests
- No data corruption

## GATE 6 — Android Lifecycle

Test:
- Background → return
- Form → background → return
- Rotation if supported
- Keyboard → background → return
- Upload → background
- Request → background
- Kill app → reopen
- Screen off → resume
- Notification while open/backgrounded/killed

Look for:
- Lost state
- Duplicate requests
- Crashes
- Broken navigation
- Incorrect loading state

## GATE 7 — Android Back

Test system Back on every important screen:
- Forms
- Dialogs
- Keyboard
- Loading
- Upload
- Error states
- Nested screens
- Authentication

Verify intentional, consistent behavior.

## GATE 8 — Permissions

For every permission actually used:
1. Allow
2. Deny
3. Deny repeatedly
4. "Don't ask again" where applicable
5. Grant
6. Revoke from Android Settings
7. Return to app
8. Use feature again

Verify:
- No crash
- Clear explanation
- Graceful fallback
- Recovery after permission restoration

## GATE 9 — Forms & Input

Test important forms with:
- Empty values
- Maximum values
- Extremely long input
- Spaces
- Leading/trailing spaces
- Unicode
- Arabic if supported
- Emoji
- Numbers
- Decimals
- Negative values
- Invalid values
- Copy/paste
- Keyboard submit
- Keyboard Back

Verify:
- Keyboard does not cover important controls
- Values persist correctly
- Validation is correct
- Submit cannot accidentally execute twice

## GATE 10 — Images & Uploads

If implemented:
- Valid image
- Large image
- Small image
- Camera
- Gallery
- Permission denied
- Upload interruption
- Offline upload
- Retry
- Cancel
- Duplicate upload
- Delete
- Reopen after upload

Look for:
- Memory crashes
- Infinite progress
- Corruption
- Wrong client association
- Duplicate uploads

## GATE 11 — Notifications & Deep Links

If implemented, test:
- App open
- App backgrounded
- App killed
- Notification tap
- Correct destination
- Logged-out state
- Correct client/content
- Invalid/expired destination

## GATE 12 — Device/UI Compatibility

At minimum test:
- Small Android phone
- Standard Android phone
- Large screen if supported
- Portrait
- Landscape if supported
- Dark mode
- Large font
- Different density

Check:
- Text clipping
- Buttons outside viewport
- Keyboard overlap
- Navigation/status bar overlap
- Dialog positioning
- Scrolling
- Long names
- Long activity names

## GATE 13 — Performance

Look for:
- Slow startup
- Slow transitions
- Excessive loading
- UI freezes
- Main-thread blocking
- Memory spikes
- Image memory issues
- Repeated API calls
- Infinite polling
- Excessive battery usage

Only investigate performance issues that materially affect users or stability.

## GATE 14 — Security / Production Mistakes

Check for obvious issues:
- Sensitive data in logs
- Hardcoded secrets
- Development API URLs
- localhost/192.168.x.x references
- Embedded test accounts
- Debug bypasses
- Insecure HTTP
- Trust-all SSL
- Authentication bypass
- Cross-user data access

Never expose secrets in QA reports.

## GATE 15 — Release Build

Test the actual release configuration.

Verify:
- Release build installs
- Release build launches
- Production API configuration
- Authentication
- Database access
- Uploads
- Notifications
- Crash reporting
- No debug UI
- No development endpoints
- No accidental test data

A passing debug build is insufficient.

---

# 4. Bug Investigation Procedure

For every failure:

### Step 1 — Reproduce
Repeat the exact steps at least once.

### Step 2 — Capture evidence
Record:
- Device
- Android version
- App/build version
- Screen
- User/account state
- Network state
- Exact steps
- Error message
- Logcat/stack trace where available
- Screenshot when useful

### Step 3 — Determine root cause

Classify the cause:
- UI
- State management
- Lifecycle
- API
- Authentication
- Database
- Validation
- Navigation
- Permission
- Configuration
- Device-specific behavior

Do not patch only the visible symptom.

### Step 4 — Fix
If explicitly authorized to modify code, make the smallest legitimate root-cause fix.

### Step 5 — Regression test
Run:
1. Original reproduction
2. Related workflow
3. Existing automated tests
4. Relevant smoke tests

---

# 5. QA_BUGS.md

Maintain this file.

Use:

## BUG-001 — Short title

Severity: P0/P1/P2/P3

Status: OPEN / FIXED / VERIFIED / WONTFIX

Environment:
- Device:
- Android:
- App build:
- Network:

Steps:
1.
2.
3.

Expected:
-

Actual:
-

Evidence:
-

Likely root cause:
-

Fix:
-

Regression test:
-

---

# 6. QA_RESULTS.md

Maintain this file.

Use:

| ID | Test | Result | Severity | Notes |
|---|---|---|---|---|
| LAUNCH-01 | Cold launch | PASS/FAIL | P0 | |
| AUTH-01 | Valid login | PASS/FAIL | P0 | |
| AUTH-02 | Invalid login | PASS/FAIL | P1 | |
| CORE-01 | Complete daily log | PASS/FAIL | P0 | |
| NET-01 | Offline submission | PASS/FAIL | P0 | |
| LIFE-01 | Kill/reopen | PASS/FAIL | P0 | |
| BACK-01 | System Back | PASS/FAIL | P0/P1 | |
| PERM-01 | Permission denied | PASS/FAIL | P1 | |
| DATA-01 | Data persistence | PASS/FAIL | P0 | |
| RELEASE-01 | Release build | PASS/FAIL | P0 | |

Add additional tests discovered during investigation.

---

# 7. Automation Priorities

If automated tests are missing, prioritize coverage for:
- Authentication
- Core client logging workflow
- Data persistence
- API failure handling
- Navigation
- Critical validation
- Authorization/data isolation

Do not create hundreds of low-value tests before covering critical workflows.

---

# 8. When Asked: "Test the App"

Execute this procedure:

1. Inspect repository.
2. Determine technology stack.
3. Determine available testing tools.
4. Run existing automated tests.
5. Build the app.
6. Start/use the available emulator or physical device.
7. Execute gates in priority order.
8. Reproduce failures.
9. Fix P0/P1 issues only when authorized.
10. Rerun tests after fixes.
11. Update QA_BUGS.md.
12. Update QA_RESULTS.md.
13. Produce a final QA summary.

Do not stop after finding the first bug.

Do not declare the app passed simply because the build succeeds or automated tests pass.

---

# 9. Final QA Report

Finish with:

## QA Summary

- Tests executed:
- Passed:
- Failed:
- Blocked:
- P0:
- P1:
- P2:
- P3:

## Critical Failures

List every unresolved P0/P1 issue.

## Release Recommendation

Choose exactly one:

- READY
- READY WITH KNOWN NON-BLOCKING ISSUES
- NOT READY

Explain the decision using evidence.

Never hide failures to produce a READY result.
