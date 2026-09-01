# Coach Web — Studio Day Retheme (design spec)

## Goal

Retheme the coach-facing web app (`apps/web/app/(coach)/`) from its current "Iron Ledger" look to the "Studio Day" visual language specified in `C:\Users\hammd\Downloads\COACHOS.md`, adapted per the user's explicit call: **drop Studio Day's cream page background and its cream-matched warm border** — keep everything else from the spec (navy-only actions, Fraunces/Public Sans, 2px radius, underlined status instead of pills, navy stamped-square initials instead of gradient avatars) but on the neutral gray/white surface this product already uses on mobile and (nominally) on web today, for cross-platform token consistency rather than a third invented palette.

This mirrors the client mobile app's liquid-glass retheme (already shipped this session, branch `feature/client-liquid-glass-retheme`) in process and rigor, but is visually its own system — **the two skins stay hard-separated per COACHOS.md's own rule ("Don't restyle coach web to match the client")**. This spec covers coach-web only.

## Explicitly out of scope

- **VIP Groups** (`#/groups` list + group-member pages) — a net-new feature (new DB table + RLS + routes), not a retheme. User's call: split off as its own follow-up project after this ships.
- Any change to the client mobile app (already shipped, separate branch history).
- Any change to backend auth, RLS beyond what's needed for the one new field below, or any RPC not named in this spec.

## Source of truth

- Design language: `COACHOS.md`, section "Coach web = Studio Day" + "Coach web — IA, breakpoints, screens" + the Screen checklist's "Coach web" subsection.
- **No `platform.html`/`studio.css` prototype exists on this machine** (same situation as the mobile retheme) — building from the written spec's prose/tables only, inventing nothing beyond what's below.

## 1. Token layer

New/changed exports in `apps/web/lib/design-system.tsx`:

| Token | Current (Iron Ledger) | New (Studio Day, cream dropped) |
|---|---|---|
| Page background | (untokenized — pages currently don't set one explicitly, browser default) | `#ffffff` (explicit) |
| Border | `T.border = 'rgba(25,28,30,0.07)'` | keep this exact value — it's already the cool neutral border Studio Day's cream-matched `#d9d2c5` would otherwise need translating away from |
| Ink/text | `T.onSurface #191c1e` / `T.onSurfaceVar #424752` | unchanged — already the values to standardize on |
| Navy actions | `T.primary #00488d` / `T.primaryMid #005fb8` | unchanged — same hex the spec calls for, already shared with mobile |
| Radius | 12px (`Card`), 20px (`Badge`, pills), 8px (`Btn`, `inputStyle`) | **2px everywhere** — cards, buttons, inputs, filter chips |
| Shadows | `shadow.card`/`shadow.float`/`shadow.sidebar` (soft drop shadows) | **none** — Studio Day: "No shadows. No gradient avatars. No pills." |
| Fonts | `font.heading = 'Manrope'`, `font.body = 'Inter'` — **currently unloaded, see below** | `font.heading = 'Fraunces'` (names, titles, kg, KPIs), `font.body = 'Public Sans'` (UI, nav, labels) |
| Status display | `Badge` — pill, colored bg+text | **underlined word**, no pill, no background fill — new `StatusWord` export (mirrors mobile's) |
| Avatar/initials | `Avatar` — gradient circle | **navy stamped square** (flat `T.primary` fill, square/minimal corner radius matching the 2px token, white initials) |

**Real gap found during investigation, not assumed:** `apps/web/app/layout.tsx` has no `next/font` setup at all, and `globals.css` has no `@font-face`/import either — `font.heading`/`font.body` are just CSS fallback-chain *names* with nothing actually loading Manrope or Inter; the app has been silently rendering the browser's default sans-serif this whole time. Fraunces + Public Sans need a **real** `next/font/google` setup added in `app/layout.tsx` (both fonts, the weights COACHOS.md calls out — Fraunces variable/600 for headings, Public Sans 400/500/600/700 for UI), not a rename of an already-working pipeline.

`Card`, `Btn`, `SectionLabel`, `FieldLabel`, `inputStyle`, `FlashDot` keep their existing signatures/call sites — only their internal style values change (2px radius, no shadow, new font tokens), same "keep primitives, restyle them" approach as the mobile retheme. `Badge`/`BADGE_MAP` stay for non-status chips (mirrors mobile's Task 1 decision) — audit call sites during implementation to decide `Badge` vs new `StatusWord` per COACHOS.md's actual rule: status = underlined word specifically for coaching status (flash-card state, client account status), not necessarily every colored tag (e.g. "Meal"/"Workout" plan-type tags may reasonably stay as `Badge`, same distinction the mobile retheme made — audit, don't blanket-convert).

## 2. Responsive sidebar shell

**Real gap found:** `apps/web/app/(coach)/_components/Shell.tsx` (302 lines) has **zero** responsive logic today — no media queries, no `matchMedia`, no drawer or bottom-bar code. This is a full new build per COACHOS.md's three breakpoints, not an extension of existing behavior:

- **≥1100px** — left sidebar (existing behavior, retheme only). Leftover vertical space on Dashboard becomes the "next session desk" (section 4 below), not empty background.
- **768-1099px** — overlay drawer: hamburger trigger + scrim, desk stacked below content instead of beside it.
- **<768px** — bottom bar: Home, Clients, Inbox, Alerts, More. "More" opens a sheet with VIP Groups (link only — screen itself is out of scope per section above), Plans, Reports, Team, Settings, Route map (COACHOS.md flags "Route map" as prototype-only, not a real screen — omit it entirely from the real "More" sheet, don't build a stub for it).

Check `apps/web/app/globals.css:41`'s existing media query (flagged but not inspected during spec research) during implementation — coordinate the new breakpoint logic with whatever grid reflow it already does rather than fighting it.

## 3. Flash cards — new data, not just new styling

**Real gap found:** the current `FlashCard.tsx` (202 lines) shares **zero** field overlap with COACHOS.md's spec. Current fields: `status/reason/food_summary/interpretation/notes/last_log_at` + a coach-notes textarea + Refresh/Profile buttons. Spec wants: navy square initials, Fraunces name, protocol + week + time, kg/steps + a steps-trend indicator, Open file, **and** a 7-day log strip (oldest-left/today-right; navy tick = a daily log landed that day, neutral tick = nothing; **bar height = that day's steps relative to the client's own highest day in the visible 7-day window**; a paused client shows seven neutral ticks).

This needs a real data query, not a style change: last-7-days `daily_logs` rows (`weight`, `steps`, `log_date` — table already has these columns, confirmed in `supabase/migrations/002_create_tables.sql:173-185`) per client shown on the dashboard, plus each client's assigned plan/protocol name + week + session time for the card header.

**Resolved — no new field.** User's call: skip `step_target` entirely (no clear ownership/purpose for a coach-set numeric target was established). Bar height is self-relative instead: each visible day's steps as a fraction of that same client's own max day in the 7-day window (a day with 0 logged steps or no log at all renders as a neutral/empty tick, not a zero-height navy bar — matches the "neutral tick = nothing" rule). Same no-target, self-scaled approach the mobile app's own `StepsBarChart` already uses — no new schema, no new coach-facing setting to add or maintain.

Whether this needs a new RPC (a `get_dashboard_flash_cards`-style query joining `clients` + last-7-`daily_logs` + `plans`) or can be composed client-side from existing per-client queries is an implementation-stage decision, not a design-stage one — the plan should investigate current dashboard data-fetching (`DashboardClient.tsx`) before choosing.

## 4. Next-session desk — resolved: stub for now, real scheduling later

**Real gap found (confirmed via repo-wide search, not assumed):** there is no appointments/sessions/scheduling concept **anywhere** in this codebase — no table in any migration, no "Today" list in `Shell.tsx`, nothing. COACHOS.md's "next session desk" and its sidebar "Today" appointments list both assume a scheduling system this app has never had. Coaches currently have no way to record or view scheduled sessions at all; the product's only time-based concepts are `daily_logs.log_date` (client-submitted, not coach-scheduled) and `plans` (assigned content, no calendar).

**User's call: same treatment as Groups.** Real scheduling (appointments table + RLS + coach UI to create/view sessions + the sidebar list + the desk panel reading from it) is deferred to its own future follow-up project — out of scope here.

For this pass, the ≥1100px sidebar's leftover vertical space is filled with something that already has real data behind it rather than staying empty: the absence/alerts queue (already exists — `app/(coach)/alerts/`) and/or the roster's most-urgent (red/yellow flash-card) clients, surfaced as a compact "needs attention" panel. Exact content choice is an implementation-stage decision (whichever the actual `alerts` data model supports more cleanly) — the requirement is: real data, not a placeholder, not empty background, and it must be clearly a *different* thing from the real scheduling desk that'll replace it later (don't name it "Next session" if it isn't one).

## 5. Per-screen retheme scope

Dashboard (KPI row gains "unread"/"adherence%" per COACHOS.md's `24 active, 1 at risk, 3 unread, 86% adherence` example — currently only has active/missing/red/yellow/green counts, confirmed via fork research), Clients (roster — structure not fully confirmed during spec research, needs its own read at plan time), client file (already has a 3-tab Overview/Meals/Report structure with reasonable conceptual overlap — verify field-level coverage against spec at plan time, not assumed complete), Messages, Plans, Alerts, Reports, Team, Settings — apply the token layer (section 1) to each; check each for hardcoded style values that bypass `design-system.tsx` (Dashboard's `FlashCard.tsx` doesn't even use the shared `Card` primitive today — raw `borderRadius: 14` div — this pattern may repeat elsewhere and needs auditing per screen, not assumed only there).

No screen gets new IA/navigation beyond what COACHOS.md's hash table already defines (`#/dashboard`, `#/clients`, `#/clients/:id`, `#/plans`, `#/plans/:id`, `#/messages`, `#/messages/:id`, `#/alerts`, `#/reports`, `#/team`, `#/settings`) — this app doesn't use literal hashes (it's Next.js App Router with real routes), so these are a content/IA reference, not something to literally implement as URL hashes.

## 6. Motion

Per COACHOS.md: 180ms fade/rise on view change, navy underline on active nav and status words. No bounce, no page-flip, no parallax. Light-touch, applied during the retheme pass, not a separate subsystem.

## Testing approach

This app has no existing frontend test suite for these screens (confirm at plan time — mirrors the mobile situation where verification leaned on `tsc`/manual review rather than component tests, since these are presentational Next.js pages). Verification plan: `next build`/typecheck must stay clean after each task, and — since this is a `next dev`-servable web app, unlike the mobile app which had no available emulator all session — actual visual verification via the `run` skill (start the dev server, view real pages) IS available here and should be used, unlike the mobile retheme which had to defer all visual confirmation to physical-device testing.

## Resolved decisions (previously flagged, now settled)

1. **Step target** — no new field. Flash-card steps bar is self-relative to each client's own 7-day max (section 3).
2. **Next-session desk** — no scheduling system this pass. Sidebar space filled with existing alerts/roster data instead; real scheduling deferred to its own future project (section 4).

## Still open for plan-time investigation (not blocking, no user decision needed)

1. **`Badge` vs `StatusWord` audit** — which existing colored chips are "coaching status" (convert) vs. other tags (keep as `Badge`) needs a per-screen pass at plan time, not a blanket rule.
2. Whether the flash-card dashboard query becomes a new RPC or a client-composed query (section 3).
3. Exact content for the "needs attention" desk panel — alerts queue vs. roster's red/yellow clients vs. both (section 4).
