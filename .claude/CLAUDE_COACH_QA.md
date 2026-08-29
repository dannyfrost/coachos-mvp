# Coach Platform MVP Pre-Launch QA Instructions

## Purpose

Act as a senior web QA engineer, product QA engineer, and debugging engineer.

Systematically test the coach-facing fitness platform before MVP launch. Do not test randomly. Prioritize critical user journeys, cross-platform synchronization, security, failure states, browser behavior, and production configuration.

Do not invent features. First inspect the repository and test what is actually implemented.

## 1. Before Testing

1. Inspect the repository.
2. Identify frontend framework, backend/API, database, authentication, hosting, state management, file storage, notifications, analytics/error monitoring, supported browsers, and test commands.
3. Run existing automated tests.
4. Build/run the application normally.
5. Record existing failures before changing code.

A successful build is not evidence that the platform is ready.

## 2. Severity

### P0 — Release Blocker
- Crash or unusable application
- Cannot log in
- Core workflow cannot complete
- Data loss/corruption
- Cross-user/client data exposure
- Authentication/authorization bypass
- Fundamental coach/client synchronization failure
- Broken production configuration

### P1 — High
- Major feature broken
- Important synchronization failure
- Important form/save operation unreliable
- Session/authentication failure
- Major navigation or responsive failure

### P2 — Medium
- Incorrect empty state
- Non-blocking data/state issue
- Minor filtering/search problem
- Minor responsive issue

### P3 — Low
- Cosmetic/UI polish
- Minor copy/spacing/alignment issue

## 3. Test Gates

Run gates in this order. Do not spend significant time on cosmetic issues while P0/P1 failures remain.

### GATE 1 — Access & Authentication

Test:
- Clean browser session
- First visit
- Refresh
- New tab
- Close/reopen browser
- Valid login
- Wrong password
- Unknown account
- Empty/invalid fields
- Long/special-character input
- Network failure during login
- Login → refresh
- Login → idle/session expiry
- Session expiry while viewing dashboard
- Logout
- Logout → Back
- Logout → protected URL
- Login as another coach

Verify:
- Correct redirects
- No infinite loading
- No stale account data
- No unauthorized access

### GATE 2 — Coach Dashboard

Test:
- Normal load
- Loading state
- Empty state
- Many clients
- Refresh
- Browser Back/Forward
- Direct URL
- Slow network
- API error
- Empty API response

Verify:
- Correct data/counts
- Correct loading/error states
- No duplicate API requests
- No stale data

### GATE 3 — Client Management

For implemented client operations test:

Create:
- Valid client
- Missing required fields
- Invalid data
- Duplicate client
- Long names
- Unicode/Arabic if supported
- Special characters
- Cancel
- Double-click Save

Read:
- Open
- Refresh
- Direct URL
- Back/Forward

Edit:
- One field
- Multiple fields
- Invalid value
- Cancel
- Double-save
- Refresh

Archive/delete if implemented:
- Cancel
- Confirm
- Refresh
- Reopen
- Verify correct data/permissions

Critical: verify a coach can only access clients belonging to the correct account/organization.

### GATE 4 — Client ↔ Mobile App Synchronization

This is a P0 workflow.

#### Client → Coach

On the mobile app:
1. Submit a daily log/check-in.
2. Synchronize.
3. Refresh coach platform.
4. Open the client.
5. Verify exact submitted data.

Test new, edited, multiple, offline-then-online, duplicate, different-date, and different-client records.

#### Coach → Client

On the coach platform:
1. Add/change supported client information or feedback.
2. Save.
3. Refresh/reopen client mobile app.
4. Verify exact change.

Test normal update, client offline, refresh/reopen, multiple updates, and different clients.

Check:
- Wrong client
- Missing data
- Duplicate data
- Stale data
- Incorrect timestamp
- Wrong date/timezone
- Race conditions
- Partial synchronization

Never declare the platform ready if cross-platform data integrity is unreliable.

### GATE 5 — Client Logs / Check-ins

For every implemented tracking workflow test:
- Create
- View
- Edit
- Save
- Refresh
- Navigate away/return
- Delete if implemented
- Multiple entries
- Same-day repeated actions
- Different dates
- Empty state
- Large dataset

Failure tests:
- Empty values
- Invalid values
- Negative values where invalid
- Extreme values
- Long text
- Unicode
- Duplicate submission
- Double-click
- Network failure during save

Verify correct client, date, value, persistence, and mobile synchronization.

### GATE 6 — Progress & History

If implemented:
- No history
- One data point
- Many data points
- Date filters/ranges
- Future dates
- Missing dates
- Multiple metrics
- Refresh
- Navigation away/back
- Client switching

Verify calculations, dates, ordering, client association, aggregation, and stale-state behavior.

Pay particular attention to timezone and off-by-one-day bugs.

### GATE 7 — Notes & Feedback

If implemented:
- Add/edit/delete
- Empty note
- Long note
- Unicode/Arabic
- Emoji
- Save/cancel
- Double-click
- Refresh
- Different clients

Verify correct client, author, timestamp, visibility, and synchronization where applicable.

### GATE 8 — Search / Filter / Sort / Pagination

If implemented:
- No results
- One result
- Many results
- Exact/partial search
- Case differences
- Unicode/special characters
- Multiple filters
- Clear filters
- Ascending/descending sort
- Pagination boundaries
- Refresh while filtered

Check counts, stale results, lost filters, duplicates, ordering, and page boundaries.

### GATE 9 — Forms & Input

Test all important forms with:
- Empty input
- Missing required fields
- Maximum input
- Extremely long input
- Leading/trailing spaces
- Numbers
- Decimals
- Negative values
- Invalid values
- Copy/paste
- Unicode
- Arabic if supported
- Emoji

Also test Enter/submit, cancel, double-save, refresh while editing, navigation while editing, and browser Back.

Verify validation, understandable errors, no silent data loss, and duplicate-submit prevention.

### GATE 10 — Network & API Failure

Test important operations with:
- Normal network
- Slow network
- Offline
- Disconnect during request
- Timeout
- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 404
- HTTP 409
- HTTP 500
- Empty response
- Unexpected/malformed response

Verify useful errors, retry behavior, no infinite spinner, no duplicate mutation, no corruption, and correct authentication handling.

### GATE 11 — Browser Navigation & State

Test:
- Refresh
- Back
- Forward
- New tab
- Duplicate tab
- Multiple tabs
- Logout in one tab
- Session expiration in another tab
- Direct URLs
- Protected bookmarks
- Refresh during forms

Look for stale state, bad redirects, unauthorized screens, lost form data, and duplicate requests.

### GATE 12 — Multiple Tabs / Concurrency

Open the same client in two tabs.

Test:
- Edit/save in Tab A → refresh Tab B
- Edit same record in both tabs
- Save at different times
- Delete/archive in one tab
- Edit from another tab
- Logout in one tab

Verify no silent overwrites, corruption, or authorization problems.

### GATE 13 — Responsive UI

Test at minimum:
- Desktop
- Laptop
- Tablet width
- Narrow mobile-browser width
- Portrait/landscape where relevant

Check navigation, sidebar, tables, cards, charts, modals, forms, buttons, dropdowns, date pickers, long names, long notes, scrolling, clipping, and overlap.

### GATE 14 — Browser Compatibility

For browsers the project supports, test core flows in Chrome, Safari, Firefox, and Edge where applicable.

Test:
- Login
- Dashboard
- Client management
- Forms
- Tables
- Uploads
- Date/time controls
- Modals
- Navigation
- Authentication redirects

Do not claim support for browsers the project does not intend to support.

### GATE 15 — Files / Images

If implemented:
- Valid file/image
- Large file
- Small file
- Unsupported format
- Cancel
- Interrupted upload
- Network failure
- Retry
- Duplicate
- Delete
- Replace
- Refresh

Verify correct client association, permissions, no duplicates, and no infinite progress.

### GATE 16 — Date & Time

Test:
- Today
- Yesterday
- Tomorrow
- Month/year boundaries
- Midnight
- Different timezones
- Coach/client in different timezones
- Browser timezone change

Verify daily logs, timestamps, progress calculations, and date boundaries.

### GATE 17 — Authorization & Data Isolation

This is a P0 security gate.

Using separate accounts where possible, verify:
- Coach A cannot access Coach B's clients
- Coach A cannot modify Coach B's clients
- Direct URL manipulation cannot expose another client's data
- API requests enforce authorization
- Logout protects data
- Changing client IDs cannot expose another client
- Archived/deleted records remain appropriately protected

Never rely only on frontend hiding. Authorization must be enforced server-side.

Never expose secrets in reports.

### GATE 18 — Performance

Look for:
- Slow dashboard
- Slow client list/detail
- Excessive API calls
- Repeated requests
- Large dataset rendering problems
- Large-image memory issues
- UI freezes
- Excessive polling

Test few clients, many clients, large history, large files/images if supported, and slow network.

### GATE 19 — Production Configuration

Search production configuration for:
- localhost
- 127.0.0.1
- 192.168.x.x
- development API URLs
- test credentials
- debug flags
- development-only features
- exposed secrets
- insecure HTTP endpoints

Verify production backend/database, environment variables, authentication, monitoring, and analytics where implemented.

### GATE 20 — Deployment / Release

Verify the deployed production environment:
- Production URL loads
- HTTPS works
- Login works
- Core workflow works
- Database operations work
- Coach/client synchronization works
- Files/images work
- Error states work
- Refresh works
- Direct URLs work
- Authentication redirects work
- No development configuration remains

Localhost testing is not equivalent to production testing.

## 4. Bug Investigation Procedure

For every failure:

### Step 1 — Reproduce
Repeat the exact steps at least once.

### Step 2 — Capture evidence
Record:
- Browser/version
- OS
- Screen size
- App/environment version
- Account role
- Client/account involved
- Network state
- Exact reproduction steps
- Error message
- Console/network errors when useful
- Screenshot when useful

### Step 3 — Determine root cause
Classify:
- UI
- State management
- Routing
- API
- Authentication
- Authorization
- Database
- Validation
- Synchronization
- Date/time
- Browser compatibility
- Configuration
- Performance

Do not patch only the visible symptom.

### Step 4 — Fix
If explicitly authorized to modify code, make the smallest legitimate root-cause fix.

### Step 5 — Regression test
Run:
1. Original reproduction
2. Related workflow
3. Existing automated tests
4. Relevant smoke tests

## 5. QA_BUGS.md

Maintain this file using:

## BUG-001 — Short title

Severity: P0/P1/P2/P3

Status: OPEN / FIXED / VERIFIED / WONTFIX

Environment:
- Browser:
- OS:
- Screen size:
- Build/environment:
- Account role:
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

## 6. QA_RESULTS.md

Maintain this file using:

| ID | Test | Result | Severity | Notes |
|---|---|---|---|---|
| AUTH-01 | Valid login | PASS/FAIL | P0 | |
| AUTH-02 | Invalid login | PASS/FAIL | P1 | |
| DASH-01 | Dashboard load | PASS/FAIL | P0 | |
| CLIENT-01 | Create client | PASS/FAIL | P0 | |
| CLIENT-02 | Edit client | PASS/FAIL | P1 | |
| CORE-01 | View client log | PASS/FAIL | P0 | |
| CORE-02 | Submit/update feedback | PASS/FAIL | P0 | |
| SYNC-01 | Client → Coach sync | PASS/FAIL | P0 | |
| SYNC-02 | Coach → Client sync | PASS/FAIL | P0 | |
| DATA-01 | Data persistence | PASS/FAIL | P0 | |
| AUTHZ-01 | Client data isolation | PASS/FAIL | P0 | |
| NET-01 | Offline behavior | PASS/FAIL | P0 | |
| NAV-01 | Browser refresh/back | PASS/FAIL | P1 | |
| RESPONSIVE-01 | Narrow viewport | PASS/FAIL | P1 | |
| RELEASE-01 | Production deployment | PASS/FAIL | P0 | |

Add tests discovered during investigation.

## 7. Automation Priorities

If automated tests are missing, prioritize:
1. Authentication
2. Authorization/data isolation
3. Core client management
4. Client log/check-in workflow
5. Coach ↔ client synchronization
6. Data persistence
7. API failure handling
8. Critical validation
9. Routing/navigation

Do not create hundreds of low-value tests before covering these.

## 8. When Asked: "Test the Coach Platform"

Execute this procedure:
1. Inspect repository.
2. Determine stack and architecture.
3. Determine available testing tools.
4. Run existing automated tests.
5. Build/run the application.
6. Test using available browsers/devices.
7. Execute gates in priority order.
8. Reproduce failures.
9. Fix P0/P1 issues only when explicitly authorized.
10. Rerun tests after fixes.
11. Update QA_BUGS.md.
12. Update QA_RESULTS.md.
13. Produce the final QA report.

Do not stop after finding the first bug.

Do not declare the platform passed merely because it builds, automated tests pass, login works, one browser works, or the happy path works.

## 9. Final QA Report

Finish with:

### QA Summary
- Tests executed:
- Passed:
- Failed:
- Blocked:
- P0:
- P1:
- P2:
- P3:

### Cross-Platform Synchronization
- Client → Coach:
- Coach → Client:
- Data integrity:
- Date/time consistency:

### Critical Failures
List every unresolved P0/P1 issue.

### Release Recommendation

Choose exactly one:
- READY
- READY WITH KNOWN NON-BLOCKING ISSUES
- NOT READY

Explain the decision using evidence.

Never hide failures to produce a READY result.
