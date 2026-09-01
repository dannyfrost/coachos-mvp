# Coach Web Studio Day Retheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the coach-facing web app (`apps/web/app/(coach)/`) from "Iron Ledger" to a "Studio Day" visual language (navy-only actions, Fraunces/Public Sans, 2px radius, no shadows/pills/gradients, underlined status words, navy stamped-square initials) on a white (not cream) page background, plus the real structural additions COACHOS.md calls for on the Dashboard (7-day flash-card log strips, a "needs attention" panel filling the sidebar's leftover space).

**Architecture:** A token-layer swap in `apps/web/lib/design-system.tsx` ripples to every screen since they all already build from its shared primitives (`Card`/`Btn`/`Badge`/`Avatar`/`SectionLabel`/`FieldLabel`/`inputStyle`). Two genuinely new pieces sit on top: (1) a real font-loading setup (none exists today — confirmed, `app/layout.tsx` has zero `next/font` config), and (2) new Dashboard data queries (7-day `daily_logs` history per client, `plan_assignments`+`plans` join for protocol/week, `client_staff_assignments` join for the roster's assistant column) — none of this is styling, it's real data the current queries don't fetch yet. The existing off-canvas drawer (`globals.css`, `@media (max-width: 860px)`) is retuned to spec breakpoints and extended with a third bottom-bar tier, not rebuilt from scratch.

**Tech Stack:** Next.js 14 App Router, React Server Components + client components, Supabase (Postgres + `@coaching/supabase/ssr-server`/`browser` clients), no existing frontend test suite for these screens (verification is `tsc`/`next build` + manual visual pass via a running dev server — unlike the mobile retheme, a dev server IS available in this environment).

**Spec:** `docs/superpowers/specs/2026-08-31-coach-web-studio-day-retheme-design.md`

## Global Constraints

- Page background: `#ffffff`, explicit — not Studio Day's cream `#f6f3ec`.
- Border/ink/text tokens: reuse existing `T.border`, `T.onSurface #191c1e`, `T.onSurfaceVar #424752` verbatim — do not adopt Studio Day's cream-matched `#d9d2c5` border or `#1c1916` ink.
- Navy: `T.primary #00488d` / `T.primaryMid #005fb8` — unchanged, actions/active-nav/stamps/links only, never decorative.
- Radius: 2px everywhere (cards, buttons, inputs, chips) — replaces 12px/20px/8px.
- Shadows: **none**. Remove `shadow.card`/`shadow.float`/`shadow.sidebar` usage from every call site touched.
- Fonts: Fraunces (names, titles, kg, KPIs) + Public Sans (UI, nav, labels) — real `next/font/google` loading, replacing the currently-unloaded "Manrope"/"Inter" CSS names.
- Status = one underlined word, no pill, no background fill — for coaching/account status specifically (flash-card state, client account status), not every colored tag.
- Avatar/initials = flat navy stamped square, not a gradient circle.
- No `step_target` field, no new schema for it — flash-card steps bar height is self-relative to that client's own 7-day max.
- No scheduling/appointments system this pass — the Dashboard's leftover sidebar space is filled with a "needs attention" panel built from the existing `absence_events` data (already queried in `app/(coach)/alerts/`), not a session-scheduling desk. Never label it "next session" — it isn't one.
- Flash-card content is "protocol + week" (derived from `plans.title` + weeks elapsed since `plan_assignments.assigned_at`), **not** "protocol + week + time" — there is no session-time data source (same reason as no scheduling system), so the "time" part of COACHOS.md's flash-card content line is dropped for this pass, consistent with the scheduling deferral above.
- VIP Groups: **out of scope entirely** — do not add a `#/groups` route, nav item, or DB table. The `_components/Shell.tsx` "More" sheet (mobile-width nav) may reference it as a disabled/upcoming label at most, never a working link.
- Motion: 180ms fade/rise on view change, navy underline on active nav + status words. No bounce/page-flip/parallax.

---

### Task 1: Design tokens + real font loading

**Files:**
- Modify: `apps/web/lib/design-system.tsx` (full file, 248 lines — every token/primitive)
- Modify: `apps/web/app/layout.tsx` (12 lines — add font loading)

**Interfaces:**
- Consumes: nothing (base layer)
- Produces: `T` (border/ink/navy values unchanged per Global Constraints; new `T.white` stays `#ffffff`), `font.heading`/`font.body` (now real loaded font CSS variables, not bare name strings), `Card`/`Btn`/`SectionLabel`/`FieldLabel`/`inputStyle`/`FlashDot` (same signatures, 2px radius + no shadow internally), new `StatusWord({status, labelOverride?, style?})` export, `Avatar({initials, size?})` reworked to a flat navy square (same signature).

- [ ] **Step 1: Add real font loading in `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import { Fraunces, Public_Sans } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CoachOS',
  description: 'Coaching platform MVP',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body style={{ background: '#ffffff' }}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Update `font` export in `design-system.tsx`**

Replace:
```typescript
export const font = {
  heading: 'Manrope, sans-serif',
  body: 'Inter, sans-serif',
}
```
with:
```typescript
export const font = {
  heading: 'var(--font-fraunces), Georgia, serif',
  body: 'var(--font-public-sans), -apple-system, sans-serif',
}
```
The CSS variables come from Step 1's `next/font` setup applied on `<html>`, so every existing `fontFamily: font.heading`/`font.body` call site across the app picks up the real fonts automatically — no call-site changes needed anywhere else in the codebase for this specific change.

- [ ] **Step 3: Drop shadows, set 2px radius on every primitive**

In `design-system.tsx`:
- `shadow` export: keep the object (some call sites outside this file may still reference `shadow.card` etc. during a transition — but zero out the actual values so anything still using them renders with no visible shadow): change all three to `'none'`.
- `Card`: `borderRadius: 12` → `borderRadius: 2`, remove `boxShadow: shadow.card` from the inline style.
- `Badge`: `borderRadius: 20` → this component is being replaced by `StatusWord` for coaching-status use (Step 5) but stays for non-status chips — change its radius to `2`.
- `Btn`: `borderRadius: 8` → `2`; the `primary` variant's `boxShadow: '0 2px 8px rgba(0,72,141,0.25)'` → remove entirely (no shadows).
- `inputStyle`: `borderRadius: '8px 8px 0 0'` → `'2px 2px 0 0'` (keep the bottom-border-only underline treatment, just flatten the corner radius).

- [ ] **Step 4: Add `StatusWord` export**

```typescript
export function StatusWord({
  status,
  labelOverride,
  style = {},
}: {
  status: string
  labelOverride?: string
  style?: React.CSSProperties
}) {
  const s = BADGE_MAP[status] || { bg: '#f3f4f6', text: T.muted, label: status }
  return (
    <span
      style={{
        fontFamily: font.body,
        fontWeight: 600,
        fontSize: 13,
        color: s.text,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        ...style,
      }}
    >
      {labelOverride ?? s.label}
    </span>
  )
}
```
Place it directly after the existing `Badge` function. Keep `Badge`/`BADGE_MAP` as-is (values, not shape) — later tasks decide per call site whether a given usage is "coaching status" (→ `StatusWord`) or a non-status tag (→ stays `Badge`, just picks up the 2px radius from Step 3).

- [ ] **Step 5: Replace gradient `Avatar` with a flat navy square**

Replace the `Avatar` function body:
```typescript
export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        background: T.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: font.heading,
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
```
Same signature (`initials`, `size`) — every existing call site keeps working unmodified.

- [ ] **Step 6: Typecheck and build**

```bash
cd apps/web && npx tsc --noEmit
npx next build
```
Expected: both clean. No call-site signature changed, only internal style values and one new export.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/design-system.tsx apps/web/app/layout.tsx
git commit -m "feat(web): retheme design-system tokens to Studio Day (Fraunces/Public Sans, 2px radius, no shadows, StatusWord, flat navy avatar)"
```

---

### Task 2: Responsive shell — retune existing drawer, add bottom-bar tier

**Files:**
- Modify: `apps/web/app/globals.css` (the `.shell-*` rules, currently lines ~48-77)
- Modify: `apps/web/app/(coach)/_components/Shell.tsx` (302 lines — nav retheme + new bottom-bar JSX)

**Interfaces:**
- Consumes: `T`, `font` from Task 1
- Produces: nothing further downstream (top-level shell)

**Correction to the design spec's assumption:** the spec described this as a full new build ("zero responsive logic"). That was based on an incomplete first pass that only checked the `.tsx` file. A working off-canvas drawer **already exists** in `globals.css` (`@media (max-width: 860px)`: `.shell-sidebar` slides in via `transform: translateX`, `.shell-hamburger` shows, `.shell-overlay` scrims) — confirmed by reading the actual CSS. What's genuinely missing is only the third `<768px` bottom-bar tier; the drawer itself needs retuning (breakpoint number, visual retheme) not rebuilding.

- [ ] **Step 1: Retune the existing drawer breakpoint and add the bottom-bar tier in `globals.css`**

Replace the existing shell media-query block:
```css
.shell-hamburger {
  display: none;
}
.shell-overlay {
  display: none;
}

@media (max-width: 860px) {
  .shell-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .shell-sidebar.is-open {
    transform: translateX(0);
  }
  .shell-hamburger {
    display: flex;
  }
  .shell-overlay.is-open {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 30;
  }
}
```
with:
```css
.shell-hamburger {
  display: none;
}
.shell-overlay {
  display: none;
}
.shell-bottombar {
  display: none;
}

/* 768-1099px: overlay drawer (COACHOS.md's spec range — was max-width:860px) */
@media (max-width: 1099px) {
  .shell-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.18s ease;
  }
  .shell-sidebar.is-open {
    transform: translateX(0);
  }
  .shell-hamburger {
    display: flex;
  }
  .shell-overlay.is-open {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 30;
  }
}

/* <768px: bottom bar replaces the sidebar/drawer entirely */
@media (max-width: 767px) {
  .shell-sidebar {
    display: none;
  }
  .shell-hamburger {
    display: none;
  }
  .shell-bottombar {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    background: #ffffff;
    border-top: 1px solid rgba(25,28,30,0.07);
  }
  .page-pad {
    padding-bottom: 76px; /* clear the fixed bottom bar */
  }
}
```

- [ ] **Step 2: Read `Shell.tsx` and confirm the current nav item list**

The 8 existing `NAV` entries (`dashboard`/`clients`/`plans`/`messages`/`alerts`/`team`/`reports`/`settings`, each `{id, label, href, Icon}`) already carry everything needed. Read the file yourself to confirm this hasn't drifted before editing (this plan's research read it at a point-in-time; verify line numbers/exact shape before touching).

- [ ] **Step 3: Add the `<768px` bottom bar JSX**

Add a new nav element rendering a subset of `NAV` (Dashboard→Home label, Clients, Messages→Inbox label, Alerts, plus a "More" trigger) with `className="shell-bottombar"`, positioned as a sibling to the existing `<nav>`/sidebar JSX in the component's return. "More" opens a simple sheet/dropdown (a `<div>` toggled by local state, same pattern as the existing `navOpen` state for the drawer) listing Plans, Reports, Team, Settings — do not add a VIP Groups link (out of scope per Global Constraints) and do not add a "Route map" item (COACHOS.md itself flags Route map as prototype-only).

- [ ] **Step 4: Retheme the sidebar/drawer/bottom-bar visuals**

Apply Task 1's tokens throughout `Shell.tsx`: active nav item gets a navy underline (not a filled pill/background — per Global Constraints' status/nav-word underline rule extending to active-nav treatment generally, matching COACHOS.md's "Navy underline on coach active nav"), `font.heading`/`font.body` for any text styling currently hardcoding a font-family, 2px radius on any rounded elements, no shadows.

- [ ] **Step 5: Add the 180ms fade/rise page-view motion**

Per COACHOS.md's Motion section — light-touch only, no animation library needed. Add to `globals.css`:

```css
@media (prefers-reduced-motion: no-preference) {
  .page-pad {
    animation: page-rise 0.18s ease both;
  }
  @keyframes page-rise {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: none; }
  }
}
```
`.page-pad` (already defined in this file, already applied as the content-padding wrapper on every coach screen per its existing usage) is the natural place for this — it fires once per navigation since each page's root re-mounts the element. No JS, no dependency, matches "light" per spec (no bounce/page-flip/parallax).

- [ ] **Step 6: Typecheck and build**

```bash
cd apps/web && npx tsc --noEmit
npx next build
```

- [ ] **Step 7: Manual verification via dev server**

```bash
cd apps/web && npm run dev
```
Open the app, resize the browser window through all three breakpoints (or use devtools responsive mode at ~1200px, ~900px, ~600px widths) and confirm: sidebar at wide, drawer+hamburger+scrim at medium, bottom bar at narrow, no layout break at the exact boundary widths (1099/767). Navigate between screens and confirm the brief fade/rise on each page.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/globals.css "apps/web/app/(coach)/_components/Shell.tsx"
git commit -m "feat(web): retune shell breakpoints to spec (1099px drawer, 767px bottom bar), retheme nav"
```

---

### Task 3: Dashboard — flash-card data model + component rebuild

**Files:**
- Modify: `apps/web/app/(coach)/dashboard/page.tsx` (109 lines — extend the server-side query)
- Modify: `apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx` (190 lines — prop threading + KPI row)
- Modify: `apps/web/app/(coach)/dashboard/_components/FlashCard.tsx` (202 lines — near-total content rebuild)

**Interfaces:**
- Consumes: `T`, `font`, `Card`, `StatusWord`, `Avatar`, `initialsOf` from Task 1's `design-system.tsx`
- Produces: nothing further downstream (leaf feature)

**Real data gap, not styling** (confirmed via direct schema/query reads, not assumed): the current `FlashCard` component's fields (`reason`/`food_summary`/`interpretation`/`notes`/`last_log_at`) share zero overlap with what COACHOS.md wants shown (protocol/week, kg/steps, 7-day strip). `page.tsx`'s current query (read in full) fetches `flash_cards` + `clients` + one day of `daily_logs` (today's check-in presence, for the "missing check-ins" KPI) + `coach_subscriptions` — it does **not** fetch `plan_assignments`/`plans` (needed for protocol/week) or 7 days of `daily_logs` (needed for the strip + kg/steps display + self-relative bar scaling).

- [ ] **Step 1: Extend `page.tsx`'s data query**

Add two more queries to the existing `Promise.all` (currently 4 entries: `flashCardsRes`, `clientsRes`, `dailyLogsRes`, `subscriptionRes`) — extend to 6:

```typescript
const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const [flashCardsRes, clientsRes, dailyLogsRes, subscriptionRes, weekLogsRes, planAssignmentsRes] = await Promise.all([
  supabase
    .from('flash_cards')
    .select(
      'id, client_id, status, reason, food_summary, interpretation, notes, last_log_at, computed_at'
    ),
  supabase
    .from('clients')
    .select('id, platform_users(full_name, status)')
    .eq('coach_id', user.id),
  supabase.from('daily_logs').select('client_id').eq('log_date', today),
  supabase
    .from('coach_subscriptions')
    .select('plan_name, current_period_end, status')
    .eq('coach_id', user.id)
    .maybeSingle(),
  supabase
    .from('daily_logs')
    .select('client_id, log_date, weight, steps')
    .gte('log_date', sevenDaysAgo)
    .lte('log_date', today),
  supabase
    .from('plan_assignments')
    .select('client_id, plan_id, assigned_at, plans(title, type)')
    .eq('status', 'active'),
])
```

Build a per-client 7-day log map and a per-client plan map after the existing `flashCards`/`clients` mapping code:

```typescript
type WeekLogEntry = { log_date: string; weight: number | null; steps: number | null }

const weekLogsByClient = new Map<string, WeekLogEntry[]>()
for (const row of weekLogsRes.data ?? []) {
  const list = weekLogsByClient.get(row.client_id) ?? []
  list.push({ log_date: row.log_date, weight: row.weight, steps: row.steps })
  weekLogsByClient.set(row.client_id, list)
}

type PlanInfo = { title: string; type: string; assigned_at: string }

const planByClient = new Map<string, PlanInfo>()
for (const row of planAssignmentsRes.data ?? []) {
  const plan = row.plans as { title: string; type: string } | null
  if (!plan) continue
  const existing = planByClient.get(row.client_id)
  if (!existing || row.assigned_at > existing.assigned_at) {
    planByClient.set(row.client_id, { title: plan.title, type: plan.type, assigned_at: row.assigned_at })
  }
}
```

Pass both maps down to `DashboardClient` as new props: `weekLogsByClientId: Record<string, WeekLogEntry[]>` and `planByClientId: Record<string, PlanInfo>` (convert the `Map`s to plain objects before passing — Next.js server-to-client component props must be serializable, `Map` isn't; use `Object.fromEntries(weekLogsByClient)` / `Object.fromEntries(planByClient)`).

- [ ] **Step 2: Add a `weekNumber` helper**

Add near the top of `page.tsx` (or a small shared util if one already exists for date math — check `apps/web/lib/` first):

```typescript
function weekNumberSince(assignedAt: string): number {
  const assigned = new Date(assignedAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDays / 7) + 1)
}
```
Include `weekNumberSince(plan.assigned_at)` in each `PlanInfo` entry (add a `week: number` field to `PlanInfo` computed at map-build time, so `FlashCard` doesn't need today's-date logic itself — pass it down already-computed).

- [ ] **Step 3: Thread the new props through `DashboardClient.tsx`**

Read the file yourself to find where it currently maps `flashCards`/`clients` into rendered `<FlashCard>` elements (partial read during planning confirmed `Card`/`Badge`/`Avatar` imports and a status-pill filter row exist around line 160 — confirm exact current line numbers before editing). Add `weekLogsByClientId`/`planByClientId` to `DashboardClient`'s prop types, and pass each client's own slice (`weekLogsByClientId[client.id] ?? []`, `planByClientId[client.id]`) into each `<FlashCard>` as new props.

- [ ] **Step 4: Add the missing KPI fields to the KPI row**

COACHOS.md's example: `24 active, 1 at risk, 3 unread, 86% adherence`. Current KPI row (confirmed via research: active/missing-checkins/red/yellow/green counts) has no "unread" or "adherence%". Add:
- **Unread**: count of unread coach-facing messages — check `apps/web/app/(coach)/messages/` for how unread state is currently tracked (a `read_at`-style column on `messages`, confirmed to exist on the client mobile side's `messages` table per this session's earlier chat-upload investigation — `read_at timestamptz`) and query a count where `read_at IS NULL` and `recipient_id = <coach's own user id>` scoped to this coach's clients, in `page.tsx`'s existing query batch.
- **Adherence%**: define as `(clients with today's daily_log) / (active clients) * 100`, rounded — this reuses data already fetched (`todayLogClientIds`/`missingCheckIns` in the existing code), just compute and display the percentage form alongside the existing missing-count, not a separate query.

- [ ] **Step 5: Rebuild `FlashCard.tsx`'s content and visuals**

New props:
```typescript
export default function FlashCard({
  card: initialCard,
  clientName,
  weekLogs,
  plan,
  onRefresh,
}: {
  card: FlashCardData
  clientName: string
  weekLogs: { log_date: string; weight: number | null; steps: number | null }[]
  plan: { title: string; type: string; week: number } | undefined
  onRefresh: (card: FlashCardData) => void
}) {
```

Render, in order: `Avatar` (navy stamped square, from Task 1) + `clientName` in `font.heading` (Fraunces) — replaces any current name styling; `plan ? `${plan.title} — week ${plan.week}`` shown in a muted small line under the name, `font.body`, omit the line entirely if `plan` is `undefined` (a client with no active plan assignment); latest `weekLogs` entry's `weight`/`steps` as the kg/steps readout (find the entry matching today's date, or the most recent one in the array if today's hasn't landed); `<StatusWord status={card.status} />` replacing whatever colored badge/pill currently shows status — no colored background box; the 7-day strip (Step 6); "Open file" as a link/button to the client's profile route (check what route the existing "Profile" button currently navigates to and reuse it).

Keep the existing coach-notes textarea + save flow and the `handleRefresh`/`refresh_flash_card` RPC call — those are working, unrelated to the content-fields it's tied to visually rebuilding.

- [ ] **Step 6: Build the 7-day strip**

Pure rendering logic, no new state:

```tsx
function SevenDayStrip({ weekLogs }: { weekLogs: { log_date: string; weight: number | null; steps: number | null }[] }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const byDate = new Map(weekLogs.map(l => [l.log_date, l]))
  const maxSteps = Math.max(1, ...weekLogs.map(l => l.steps ?? 0))

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
      {days.map(date => {
        const log = byDate.get(date)
        const hasLog = !!log
        const stepsHeight = log?.steps ? Math.max(4, Math.round((log.steps / maxSteps) * 24)) : 4
        return (
          <div
            key={date}
            style={{
              width: 10,
              height: stepsHeight,
              borderRadius: 1,
              background: hasLog ? T.primary : T.surfaceHigh,
            }}
          />
        )
      })}
    </div>
  )
}
```
Oldest day first, today last (matches the `days` array's left-to-right construction). A day with no log at all renders as a short neutral (`T.surfaceHigh`) tick, not a navy bar, per COACHOS.md's "cream tick = nothing" rule (translated to the non-cream neutral token). Place this function in `FlashCard.tsx` below the main export, or extract to a sibling file `dashboard/_components/SevenDayStrip.tsx` if `FlashCard.tsx` is getting long after the Step 5 changes — use judgment based on the file's resulting size.

- [ ] **Step 7: Typecheck and build**

```bash
cd apps/web && npx tsc --noEmit
npx next build
```

- [ ] **Step 8: Manual verification via dev server**

```bash
cd apps/web && npm run dev
```
Open `/dashboard`, confirm: flash cards show protocol/week (or omit gracefully with no plan), kg/steps, a visible 7-day strip with varying bar heights, underlined status word (not a pill), navy square avatar (not a gradient circle), KPI row shows unread + adherence%.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/app/(coach)/dashboard"
git commit -m "feat(web): dashboard flash cards show protocol/week/7-day strip, KPI row gains unread/adherence%"
```

---

### Task 4: Dashboard "needs attention" panel (replaces the empty leftover sidebar space)

**Files:**
- Create: `apps/web/app/(coach)/dashboard/_components/NeedsAttentionPanel.tsx`
- Modify: `apps/web/app/(coach)/dashboard/page.tsx` (add one query)
- Modify: `apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx` (render the panel in the leftover space, ≥1100px only)

**Interfaces:**
- Consumes: `T`, `font`, `Card`, `StatusWord` from Task 1
- Produces: nothing further downstream

- [ ] **Step 1: Add an unresolved-absence-events query to `page.tsx`**

Reuses the exact query shape already working in `apps/web/app/(coach)/alerts/page.tsx:23` (confirmed via direct read — `absence_events` joined to `clients!absence_events_client_coach_fkey(platform_users(full_name))`), scoped to unresolved + sorted most-urgent-first:

```typescript
const attentionRes = await supabase
  .from('absence_events')
  .select('id, client_id, trigger_date, level, action_taken, clients!absence_events_client_coach_fkey(platform_users(full_name))')
  .neq('action_taken', 'resolved')
  .order('level', { ascending: false }) // '72h' > '48h' > '24h' lexically descending — verify this sort order matches urgency intent when implementing; if not, sort client-side with an explicit level-rank map instead
  .limit(6)
```
Pass `attentionRes.data ?? []` to `DashboardClient` as a new `attentionItems` prop (map to a small typed shape mirroring `AlertsClient.tsx`'s existing `Level`/row typing — check that file's types first and reuse the same shape rather than inventing a parallel one).

- [ ] **Step 2: Build `NeedsAttentionPanel.tsx`**

```tsx
import { T, font, Card, StatusWord } from '../../../../lib/design-system'

type AttentionItem = {
  id: string
  client_id: string
  trigger_date: string
  level: '24h' | '48h' | '72h'
  clientName: string
}

export default function NeedsAttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <div style={{ fontFamily: font.heading, fontSize: 15, marginBottom: 4 }}>Needs attention</div>
        <div style={{ fontFamily: font.body, fontSize: 13, color: T.muted }}>Nothing urgent right now.</div>
      </Card>
    )
  }
  return (
    <Card>
      <div style={{ fontFamily: font.heading, fontSize: 15, marginBottom: 10 }}>Needs attention</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <a
            key={item.id}
            href={`/clients/${item.client_id}`}
            style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: T.onSurface, fontFamily: font.body, fontSize: 13 }}
          >
            <span>{item.clientName}</span>
            <StatusWord status={item.level === '72h' ? 'red' : item.level === '48h' ? 'yellow' : 'pending'} labelOverride={item.level} />
          </a>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Render it in `DashboardClient.tsx`'s leftover space**

Read the file to find the current layout grid/flex structure for the flash-card list. Add `<NeedsAttentionPanel items={attentionItems} />` in a sidebar-adjacent column that only renders at ≥1100px (use the same breakpoint convention Task 2 established — a CSS class gated by the same media-query width, or an inline check against a `useEffect`-tracked window width if the codebase has a precedent for that; check `profile-header-grid`'s CSS-only approach in `globals.css` first and prefer matching it over introducing JS-based width detection).

- [ ] **Step 4: Typecheck, build, verify, commit**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```
Manual check via `npm run dev`: `/dashboard` at ≥1100px width shows the panel with real unresolved-alert data (or the empty state if none exist); hidden below 1100px (that space is needed for stacked content there instead).

```bash
git add "apps/web/app/(coach)/dashboard"
git commit -m "feat(web): add needs-attention panel to dashboard's leftover sidebar space"
```

---

### Task 5: Clients roster — retheme + assistant column

**Files:**
- Modify: `apps/web/app/(coach)/clients/page.tsx` (91 lines — add staff-assignment join)
- Modify: `apps/web/app/(coach)/clients/_components/ClientsClient.tsx` (377 lines — retheme + new column)

**Interfaces:**
- Consumes: `T`, `font`, `Card`, `StatusWord` from Task 1
- Produces: nothing further downstream

**Real content gap confirmed** (not assumed): the current roster query (read in full) has `name`/`flash status`/`subscription end date` but no assistant/staff-assignment data at all — COACHOS.md's roster spec explicitly lists "assistant" as a column.

- [ ] **Step 1: Add the staff-assignment join to `page.tsx`**

Add to the existing `Promise.all([subsResult, flashResult])` (currently 2 entries — extend to 3):

```typescript
const [subsResult, flashResult, staffResult] = await Promise.all([
  clientIds.length > 0
    ? supabase.from('client_subscriptions').select('*').in('client_id', clientIds)
    : Promise.resolve({ data: [], error: null }),
  clientIds.length > 0
    ? supabase.from('flash_cards').select('id, client_id, status, last_log_at, computed_at').in('client_id', clientIds)
    : Promise.resolve({ data: [], error: null }),
  clientIds.length > 0
    ? supabase.from('client_staff_assignments').select('client_id, platform_users!client_staff_assignments_staff_id_fkey(full_name)').in('client_id', clientIds)
    : Promise.resolve({ data: [], error: null }),
])
```
(verify the exact FK constraint name Supabase's PostgREST needs for the `platform_users` join — `client_staff_assignments.staff_id → platform_users.id`, confirmed in `supabase/migrations/002_create_tables.sql:157-164` — check the actual generated constraint name in that migration file if the join errors, PostgREST requires the exact FK name when a table has multiple FKs to the same target as `client_staff_assignments` likely does via both `coach_id`→`coaches` and `staff_id`→`platform_users`, so ambiguity is possible only if `platform_users` is referenced twice, which it isn't here — should resolve without needing the explicit constraint name, but verify by running the query).

Build a `staffByClient` map (same pattern as `subByClient`/`flashByClient` immediately above it in the file) and add a `assistantName: string | null` field to each `ClientRow` in the `merged` array.

- [ ] **Step 2: Add the assistant column to `ClientsClient.tsx`**

Read the file's table-rendering section (confirmed via research: `<Card style={{padding:0, overflow:'hidden'}}>` wraps a table, `Badge` used for flash/subscription status around lines 324/333/334). Add a new column showing `c.assistantName ?? '—'`. Convert the flash/subscription-status `Badge` usages to `StatusWord` (these are coaching/account status per Global Constraints' rule) — keep the "expiring soon" `Badge` as `Badge` (it's a qualifier tag, not a status word) unless it reads more naturally as `StatusWord` once you see it rendered; use judgment, note the choice in your task report.

- [ ] **Step 3: Retheme remaining hardcoded values**

Research confirmed hardcoded `borderRadius: 14` (a modal, line ~99) and `borderRadius: 8`/`boxShadow: shadow.card` (row-action buttons, lines ~220-242) that bypass the shared primitives. Change all `borderRadius` values to `2`, remove the `boxShadow` lines (no shadows per Global Constraints).

- [ ] **Step 4: Typecheck, build, verify, commit**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```
`npm run dev`, open `/clients`, confirm assistant column shows real data (or `—` for unassigned clients), status displays as underlined words, no shadows/pills on the retouched elements.

```bash
git add "apps/web/app/(coach)/clients"
git commit -m "feat(web): retheme clients roster, add assistant column"
```

---

### Task 6: Client file — retheme audit

**Files:**
- Modify: `apps/web/app/(coach)/clients/[id]/page.tsx` (191 lines)
- Modify: `apps/web/app/(coach)/clients/[id]/_components/ClientProfileClient.tsx` (694 lines — biggest screen in the app)

**Interfaces:**
- Consumes: `T`, `font`, `Card`, `StatusWord`, `Avatar` from Task 1
- Produces: nothing further downstream

Research confirmed this screen already has a 3-tab structure (`Overview`/`Meals`/`Report`) with reasonable conceptual overlap with COACHOS.md's "kg/steps/adherence, assigned plan, open thread, alerts" — this task is a retheme + field-coverage audit, not a rebuild.

- [ ] **Step 1: Read the full file and audit against the spec**

Confirm each of COACHOS.md's client-file content items has a home in the existing tabs: initials (→ `Avatar`, navy square), kg/steps/adherence (check Overview tab), assigned plan (check Overview tab, likely already shows `plan_assignments`/`plans` data — if so, reuse rather than re-querying), open thread (check for a Messages link/embed), alerts (check for an absence_events section). Note any genuinely missing item in your task report rather than silently adding scope beyond what's confirmed missing.

- [ ] **Step 2: Apply the token retheme**

Confirmed hardcoded pattern from research: tabs use inline `borderBottom` active-state styling with `T.primary` directly rather than a shared tab primitive — this is fine to keep as inline styling (not required to extract a new primitive, YAGNI), just update it to match the navy-underline active-state convention Task 2 established for nav, and apply `font.heading` (Fraunces) to the client's name header, `font.body` elsewhere, 2px radius, no shadows, `StatusWord` for the client's account/flash status displays.

- [ ] **Step 3: Typecheck, build, verify, commit**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```
`npm run dev`, open a client's profile, click through all 3 tabs, confirm visual consistency with the rest of the retheme and no broken data display.

```bash
git add "apps/web/app/(coach)/clients/[id]"
git commit -m "feat(web): retheme client file screen to Studio Day tokens"
```

---

### Task 7: Remaining screens — batched retheme pass

**Files:**
- Modify: `apps/web/app/(coach)/messages/` (list + `[participantId]/`)
- Modify: `apps/web/app/(coach)/plans/` (list + `[id]/` if present)
- Modify: `apps/web/app/(coach)/alerts/_components/AlertsClient.tsx` (155 lines — confirmed structure: level/status filters, `Badge` for level at line ~113)
- Modify: `apps/web/app/(coach)/reports/`
- Modify: `apps/web/app/(coach)/team/`
- Modify: `apps/web/app/(coach)/settings/`

**Interfaces:**
- Consumes: `T`, `font`, `Card`, `Btn`, `StatusWord`, `Avatar`, `SectionLabel`, `FieldLabel`, `inputStyle` from Task 1
- Produces: nothing further downstream

No content/structural changes on any of these six areas — COACHOS.md's checklist entries for them (Messages: thread + composer; Plans: library + Fat Loss Phase 1 detail; Alerts: 72h/48h/24h queue, already confirmed matching exactly in research; Reports: rollup; Team: staff list; Settings: profile/workspace/billing) are already what these screens do. This is a visual-only pass, same pattern as the mobile retheme's Task 5 batch.

- [ ] **Step 1: For each of the 6 areas, apply the token retheme**

Read each file first (don't assume structure from this plan alone — only Alerts' structure was confirmed in detail during research). For each: replace hardcoded `borderRadius`/`boxShadow`/font-family values with the Task 1 tokens, convert coaching-status `Badge` usages to `StatusWord` where the item is a genuine status readout (Alerts' `level` badge at `AlertsClient.tsx:113` is a strong candidate — confirmed real usage), leave non-status tags as `Badge`.

- [ ] **Step 2: Typecheck and build**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```

- [ ] **Step 3: Manual verification via dev server**

`npm run dev`, click through all 6 screens, confirm visual consistency, no broken layouts, filters/forms/composers still function exactly as before (this is styling-only — if any interaction changed, that's a regression, not an intended part of this task).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(coach)/messages" "apps/web/app/(coach)/plans" "apps/web/app/(coach)/alerts" "apps/web/app/(coach)/reports" "apps/web/app/(coach)/team" "apps/web/app/(coach)/settings"
git commit -m "feat(web): retheme messages/plans/alerts/reports/team/settings to Studio Day tokens"
```

---

### Task 8: Full verification pass

**Files:** none (verification-only)

- [ ] **Step 1: Full typecheck and build**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```
Expected: both clean across the whole app, not just the files each task touched individually — a token or type change in Task 1 could surface a break in a file no other task specifically visited.

- [ ] **Step 2: Full manual pass via dev server**

```bash
cd apps/web && npm run dev
```
Click through every one of the 9 retheme'd screens (Dashboard, Clients, client file, Messages, Plans, Alerts, Reports, Team, Settings) plus the 3 responsive breakpoints on Dashboard and at least one other screen. Confirm: white background (not cream, not leftover default), Fraunces on names/headings, Public Sans on UI text, 2px radius, no shadows anywhere, no pills (status reads as an underlined word), navy square avatars (not gradient circles), Dashboard's flash cards show real 7-day strips + protocol/week, needs-attention panel shows real unresolved alerts.

- [ ] **Step 3: No commit** (verification-only; if Step 1 or 2 surface a problem, fix it as part of the task that owns the broken file, not here).
