# CoachOS — SaaS Design System & Platform Refinement Audit

> **Status:** Research + recommendation only. **No application code changed.** No packages installed.
> Target: the coach-facing web app (`apps/web`). Awaiting approval before any implementation.
> Date: 2026-10-15.

---

## 1. Executive recommendation

**Adopt Option C: preserve the existing architecture and build a coherent CoachOS design
system on the current inline-style tokens — do NOT migrate onto a Tailwind/shadcn starter.**

The single fact that drives this: **`apps/web` has no Tailwind pipeline.** Styling is done
with inline `style={{}}` objects sourced from `apps/web/lib/design-system.tsx`. Every
high-quality component library in the research (shadcn/ui, Tremor, dub's UI) assumes Tailwind,
so adopting them means introducing a Tailwind build + rewriting every screen — a rewrite the
project's own guardrails forbid and that would discard the shipped, reviewed "Studio Day"
system.

The premise "generic, AI-generated, too much red" is **partly stale**: the app already has a
deliberate, restrained, semantic-red design system (details in §2). The real problems are
hierarchy/density, accessibility of interactive primitives, dead CSS, and absence of motion —
not an over-red reskin.

**Recommended path:** keep the inline-style architecture + Studio Day tokens; refine tokens,
hierarchy, and density; adopt **Radix UI primitives** (MIT, unstyled — no Tailwind required)
for accessible dialogs/dropdowns/tooltips/popovers; add **Motion** (`framer-motion`, MIT) for
purposeful, reduced-motion-aware transitions; borrow **layout/IA/density patterns** (not code)
from `next-shadcn-dashboard-starter` and `twenty`. Treat "adopt Tailwind" as a separate,
explicit decision (§12) — not required for the bulk of the win.

---

## 2. Baseline repository assessment (Phase 0 — verified from source)

**Stack (verified):** Next.js 14 (App Router) · React 18 · TypeScript · pnpm monorepo
(`apps/web`, `apps/mobile`, `packages/`) · Supabase (`@supabase/ssr`) for auth + data ·
Resend (email) · `@anthropic-ai/sdk` (weight-OCR route). Deps: `apps/web/package.json`.

**Styling (verified):** **No Tailwind, no shadcn, no Radix, no CSS framework.** Inline style
objects via `apps/web/lib/design-system.tsx` + one small `apps/web/app/globals.css`
(container-query-style responsive helpers, off-canvas/bottom-bar shell, reduced-motion page
fade). `components.json`/`tailwind.config` absent.

**Design system (verified — `apps/web/lib/design-system.tsx`, 273 lines):**
- Tokens `T`: primary navy `#00488d`, light neutral surfaces, `border rgba(25,28,30,0.07)`,
  semantic `success/amber/red/blue` with bg pairs.
- `shadow = { card:'none', float:'none', sidebar:'none' }` — deliberately flat.
- `font = { heading: Fraunces (serif), body: Public Sans }` via `next/font/google`
  (`apps/web/app/layout.tsx`). Radius 2px throughout.
- Primitives: `Card, Badge, StatusWord, FlashDot, Btn, SectionLabel, FieldLabel, inputStyle,
  Avatar, initialsOf`. `BADGE_MAP` maps status → semantic color + label (On Track / Needs
  Attention / At Risk).

**Routing / shell (verified):**
- Route group `app/(coach)/` → `dashboard`, `clients`, `clients/[id]`, `messages`,
  `messages/[participantId]`, `plans`, `reports`, `settings`, `team`; plus `login`, `signup`.
- `app/(coach)/_components/Shell.tsx` (460 lines): sidebar → off-canvas drawer (≤1099px) →
  bottom bar (≤767px). Responsive breakpoints in `globals.css`.
- Pages are Supabase-SSR **server components** that fetch, then delegate rendering to client
  components in each route's `_components/*Client.tsx` (e.g. `clients/page.tsx` →
  `ClientsClient`).

**Data fetching (verified):** direct Supabase queries in server components (e.g.
`clients/page.tsx` fetches clients + subscriptions + flash_cards + staff in `Promise.all`).
No TanStack Query/SWR on these pages.

**Strengths worth preserving:**
1. Coherent, restrained token set; **red is already semantic-only** (errors, At Risk,
   Suspended, Expired, Escalated) — not decorative.
2. Flat/no-shadow editorial identity is a real point of view, not default slop.
3. Responsive shell with reduced-motion handling already exists.
4. `StatusWord`/`FlashDot` are a genuine product idea (client health at a glance).
5. Lean dependency surface (easy to reason about, fast builds).

**Main UX / visual problems (verified, with refs):**
| # | Problem | Evidence |
|---|---|---|
| P-A | **Dead Tailwind classes** render unstyled — e.g. error state `className="p-6 text-red-600"` with no Tailwind pipeline. | `apps/web/app/(coach)/clients/page.tsx:25` |
| P-B | **Interactive primitives are hand-rolled** (no accessible dialog/dropdown/tooltip library) → focus-trap, ESC, ARIA, keyboard nav likely incomplete. | inline primitives in `design-system.tsx`; no Radix in deps |
| P-C | **Hierarchy/density** lean on flat cards + serif headings; dashboards risk reading as "blocks" without a strong typographic/spacing rhythm. | `dashboard/page.tsx` (198 lines), `_components/*` |
| P-D | **Motion is almost absent** — only a page-level opacity fade. No feedback on list/table/dialog/status changes. | `globals.css` `page-rise` only |
| P-E | **Serif display font (Fraunces)** is a strong choice that can read informal/editorial for an operational CRM — worth validating. | `design-system.tsx:32`, `layout.tsx` |
| P-F | **Styling is per-page inline** — risk of drift; no shared spacing/elevation scale beyond `T`. | inline `style={{}}` across `_components` |

**Technical constraints:** inline-style architecture (no utility CSS); Next 14/React 18
(not 16/19); Supabase auth+RLS is load-bearing; mobile app shares nothing visual with web
but shares the Supabase backend (do not touch). **Must not regress:** auth/login/signup,
Supabase RLS queries, the flash-card status logic, messages, plans upload/download, weight
OCR route, responsive shell.

---

## 3. GitHub research — candidates (verified facts vs. judgments)

All licenses/stacks below were read from each repo's GitHub page (README/manifest/sidebar).
Items marked *unknown* were not verifiable without opening the LICENSE/source directly.

| # | Repo | License | Stack | Purpose | Verdict |
|---|---|---|---|---|---|
| 1 | [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | MIT | Next 16 + Tailwind v4 + shadcn/Base UI, TanStack, Recharts, Clerk | Premium generic SaaS CRM shell | **Pattern reference** (shell/IA/tables) |
| 2 | [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | Apache-2.0 | React + **Tailwind + Radix** | Dashboard/chart component kit | **Reference / use only if Tailwind adopted** |
| 3 | Radix UI + [Motion](https://github.com/motiondivision/motion) (`framer-motion`) | MIT | React, **unstyled**, framework-agnostic | Accessible primitives + motion | **ADOPT (foundation)** |
| 4 | [Snouzy/workout-cool](https://github.com/Snouzy/workout-cool) | MIT | Next + Tailwind + shadcn/Radix + Prisma | OSS fitness platform (single-user) | **Pattern reference** (fitness UI) |
| 5 | [twentyhq/twenty](https://github.com/twentyhq/twenty) | *unknown (check LICENSE)* | NestJS + React + Linaria + GraphQL + Postgres | Full open-source CRM | **Pattern reference** (CRM records/views/density) |
| 6 | [dubinc/dub](https://github.com/dubinc/dub) | **AGPLv3** + commercial EE | Next + Tailwind + Prisma + PlanetScale | SaaS analytics product | **Reference only** (AGPL blocks reuse) |
| 7 | [codee-sh/payload-training-app](https://github.com/codee-sh/payload-training-app) | MIT | Next 16 + Payload CMS + Postgres | Coach↔client training app | **Reference only** (role/data model) |
| 8 | [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) | **AGPL-3.0** | React/Vite + JSON store | Single-user tracker | **REJECT** (wrong shape + viral license) |
| 9 | [netanelhadad2009-bit/gymbro](https://github.com/netanelhadad2009-bit/gymbro) | **none / archived** | Supabase + Expo + Turborepo | Coach/client (abandoned) | **REJECT** (no license, archived, leaked key) |

**Verified notes:**
- Tremor, shadcn-starter, dub, workout-cool **all require Tailwind** → low compatibility with
  CoachOS's inline-style app.
- Radix primitives are **unstyled** and framework-level → they work with inline styles, **no
  Tailwind needed**. This is why they top the matrix.
- `twenty` is a full NestJS/GraphQL app — architecturally incompatible, but the **best
  reference for CRM information density, record lists, and detail layouts**.
- AGPL (openGym, dub) is incompatible with a closed commercial SaaS; reject for reuse.

---

## 4. Weighted comparison matrix

Criteria weights: Workflows 25 · Visual 20 · Compatibility 20 · Reusable/design-system 15 ·
Interaction/responsive 10 · Maintenance/a11y/licensing 10. Scores 1–5; weighted out of 100.

| Candidate | Work (25) | Vis (20) | Compat (20) | Reuse (15) | Inter (10) | Maint (10) | **Total** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Radix + Motion (foundation)** | 3 | 3 | **5** | 5 | 5 | 5 | **82** |
| next-shadcn-dashboard-starter | 3 | 5 | 2 | 5 | 4 | 5 | **76** |
| workout-cool | 4 | 3 | 2 | 4 | 4 | 4 | **68** |
| Tremor | 3 | 4 | 2 | 4 | 3 | 4 | **65** |
| twenty | 5 | 4 | 1 | 2 | 3 | 3 | **63** |
| dub | 3 | 5 | 1 | 2 | 4 | 3 | **59** |
| payload-training-app | 4 | 2 | 2 | 2 | 2 | 3 | **52** |
| openGym / gymbro | — | — | — | — | — | — | **reject** |

Compatibility (20%) is heavily weighted and dominated by one question — does it need Tailwind
and/or a different backend. Radix+Motion win because they are unstyled, MIT, and backend-
agnostic, so they slot into the inline-style app with no rewrite. The visually strongest
option (shadcn-starter, 76) is a **pattern** source, not a drop-in, precisely because of
compatibility. *(Scores for Workflows/Visual are provisional judgments; Compat/License/Maint
are from verified repo facts.)*

**Winners:**
- **Best foundation to adopt:** Radix UI primitives + Motion.
- **Best overall visual/IA reference:** next-shadcn-dashboard-starter.
- **Best CRM-workflow reference:** twenty.
- **Best dataviz:** Tremor *(only if Tailwind is adopted)*; otherwise `recharts`/`visx` (MIT) or hand-rolled SVG.
- **Best low-risk strategy:** Option C (§8).
- **Reject:** openGym, gymbro.

---

## 5. Recommended visual direction

Keep Studio Day's spirit (calm, flat, precise) and tighten it for operational density:
- **Color:** keep navy `#00488d` primary; **keep red semantic-only** (do not strip — it is
  already correct). Add one calmer neutral-ink for secondary text; ensure AA contrast.
- **Typography:** validate Fraunces for the CRM. Recommend **Fraunces for marketing/empty-
  states only**, and a neutral sans for dense UI headings (Public Sans or Geist), to improve
  scanability. *(Decision item §12.)*
- **Density & hierarchy:** define a real spacing scale (4/8/12/16/24/32) and a type scale
  (12/14/16/20/24/30) as tokens in `design-system.tsx`; replace flat card-grids with
  grouped sections, table-first client views, and clear primary-action placement.
- **Elevation:** keep flat; introduce exactly one soft shadow token for overlays
  (dialogs/popovers) so layering reads correctly.

---

## 6. Design-system & animation strategy

- **Primitives:** add `@radix-ui/react-{dialog,dropdown-menu,popover,tooltip,tabs,select}`
  (MIT), styled with existing `T` tokens via inline styles / `globals.css`. Gains: focus
  trap, ESC, ARIA, keyboard nav — the P-B gap — with no Tailwind.
- **Motion:** add `framer-motion` (MIT). Scope to meaningful transitions only:

| Trigger | Behavior | Duration/easing | Layout move | Reduced-motion |
|---|---|---|---|---|
| Open dialog/drawer | fade + 8px rise | 160ms ease-out | no | fade only |
| Dropdown/popover | fade + 4px | 120ms ease-out | no | instant |
| Sidebar drawer (mobile) | slide X | 180ms ease (already CSS) | yes | keep CSS |
| Row/list add-remove | height+opacity | 160ms | yes | opacity only |
| Status change (FlashDot) | color crossfade | 200ms | no | instant |
| Async submit | button spinner + toast | n/a | no | n/a |

All gated on `prefers-reduced-motion`; no parallax, counters, or animated backgrounds.
- **Dataviz:** client progress (weight/steps trend) → `recharts` (MIT) or hand-rolled SVG;
  adopt Tremor only if Tailwind is introduced.
- **Relevant installed skills for implementation:** `frontend-design`, `design:design-system`,
  `apple-design`, `animate` / `improve-animations` / `find-animation-opportunities`,
  `dataviz`, `design:design-critique`, `design:accessibility-review`,
  `redesign-existing-projects`, `claude-stop-the-slop`, `superpowers:writing-plans`.

---

## 7. Reference-pattern → CoachOS mapping

| Pattern (source) | Apply to CoachOS |
|---|---|
| Sidebar + contextual header + content max-width (shadcn-starter) | tighten `Shell.tsx` header/active states + content width token |
| Searchable/filterable/sortable data table (shadcn-starter / twenty) | `clients/_components/ClientsClient` → real table with search/filter/sort/pagination |
| Record detail: header + tabbed sections (twenty) | `clients/[id]` client file: profile header + tabs (logs / plan / progress / notes / messages) |
| KPI row used sparingly (Tremor) | dashboard: 3–4 real metrics max, then an **attention queue**, not a card wall |
| Command menu / quick client switch (shadcn-starter) | optional ⌘K client search |
| Accessible dialog/dropdown (Radix) | replace hand-rolled menus/modals in `_components` |

---

## 8. Application-shell & page-layout changes (proposed, not implemented)

- **Shell:** standardize header (page title + breadcrumb + primary action slot); explicit
  active-nav state; one content-width token; keep the responsive drawer/bottom-bar.
- **Dashboard:** "today's priorities" first (at-risk / needs-attention queue), then a small
  KPI row, then recent activity — reduce undifferentiated cards.
- **Clients:** table-first (name, status word, last log, subscription, assistant), with
  search/filter/sort; row → client file.
- **Client file (`clients/[id]`):** consistent header + tabbed sections; progress charts.

---

## 9. Phased implementation roadmap

Each task: outcome · files · deps · risk · acceptance · verification.

### P0 — Foundation
- **Tokens & scales** — outcome: shared spacing/type/elevation tokens. files:
  `lib/design-system.tsx`. deps: none. risk: low. accept: all screens read from tokens;
  no visual regression. verify: typecheck + visual diff.
- **Kill dead CSS** — outcome: no non-functional Tailwind classes (e.g. P-A). files:
  grep `className=` across `apps/web`. deps: none. risk: low. accept: error/empty states
  styled via inline tokens. verify: render each state.
- **Shell polish** — outcome: consistent header/active-state/width. files:
  `(coach)/_components/Shell.tsx`, `globals.css`. risk: medium (shared). accept: all pages
  consistent; responsive intact. verify: 3 breakpoints.

### P1 — Core coaching workflows
- **Clients table** (search/filter/sort/pagination). files: `clients/_components/*`. risk:
  medium. accept: 100+ clients scannable; RLS queries unchanged. verify: with seeded data.
- **Client file tabs + progress chart.** files: `clients/[id]/_components/*`; add `recharts`.
  risk: medium. accept: logs/plan/progress/notes/messages reachable; no data regression.
- **Dashboard attention-first.** files: `dashboard/_components/*`. risk: low.
- **Reusable page/section/table components.** files: `lib/design-system.tsx` (+ small set).

### P2 — Interaction polish
- **Radix primitives** for dialogs/dropdowns/tooltips. deps: `@radix-ui/*` (MIT). risk:
  medium (replaces hand-rolled). accept: keyboard + focus-trap + ESC work.
- **Motion** per §6 table. deps: `framer-motion`. risk: low. accept: reduced-motion honored.
- **States:** hover/focus/loading(skeleton)/empty/success/error standardized.

### P3 — QA
- `pnpm lint`, typecheck, `pnpm test` (vitest), `pnpm build`.
- Before/after screenshots (desktop + mobile-web) if tooling available.
- Keyboard nav, focus visibility, `prefers-reduced-motion`.
- Regression pass on auth, RLS, messages, plans, weight OCR.

**Essential pre-beta:** P0 + P1 + Radix primitives (a11y) + core states.
**Optional:** full motion set, ⌘K, chart richness.

---

## 10. Risks, dependencies, licensing

- **New deps (all MIT):** `@radix-ui/react-*`, `framer-motion`, optionally `recharts`.
  No AGPL, no Tailwind required. *(Installs happen only after approval.)*
- **Risk:** replacing hand-rolled modals/menus with Radix can change focus/markup — test
  keyboard paths. Shell changes touch every page — do P0 behind a visual diff.
- **Do NOT:** adopt Tailwind-dependent kits (shadcn/Tremor/dub) without the explicit Tailwind
  decision; reuse AGPL code (openGym/dub); touch Supabase/auth/mobile.
- **Licensing verified:** Radix/Motion/recharts/shadcn-starter/workout-cool/Tremor reuse is
  permissive (MIT/Apache-2.0); dub + openGym are AGPL (reference only); twenty license
  **unconfirmed — verify before any code reuse** (patterns only is fine).

---

## 11. Private-beta acceptance checklist

- [ ] All coach pages use shared tokens; no dead/un-styled CSS.
- [ ] Clients table: search, filter, sort, pagination; keyboard operable.
- [ ] Client file: consistent header + tabs + progress chart; no data regression.
- [ ] Dialogs/dropdowns/tooltips accessible (focus-trap, ESC, ARIA) via Radix.
- [ ] Loading/empty/error/success states on every async surface.
- [ ] `prefers-reduced-motion` honored; visible focus everywhere.
- [ ] Responsive at phone/tablet/desktop; shell drawer + bottom bar intact.
- [ ] `pnpm lint` + typecheck + `pnpm test` + `pnpm build` green.
- [ ] Auth, RLS, messages, plans, weight OCR verified unregressed.

---

## 12. Decisions requiring your approval

1. **Tailwind — yes or no?** Recommended **no** (keep inline styles; adopt Radix+Motion).
   "Yes" unlocks shadcn/Tremor but means a full styling migration (large, higher risk).
2. **Display font.** Keep Fraunces serif everywhere, or move to a neutral sans for dense UI
   (recommended) and reserve Fraunces for marketing/empty-states?
3. **Strategy confirm:** Option C (preserve architecture) vs A (adopt starter) vs B (swap
   components). Recommended **C**.
4. **Relationship to `coachos-studio`** (the separate workout-cool fork from earlier today):
   is this audit the chosen direction (refine the real app) and the fork is shelved, or do
   both continue?
5. **Charts dep:** `recharts` (recommended) vs hand-rolled SVG vs Tremor (needs Tailwind).

**Stop point:** no code changes until you approve the strategy + these decisions.
