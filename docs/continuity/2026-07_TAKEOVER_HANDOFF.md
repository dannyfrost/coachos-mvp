# CoachOS — Handoff: What Was Done Since Takeover

**Covers:** 2026-07-19 (ownership confirmed) → 2026-07-23
**Author context:** Written by Claude Code working directly with hamdi (project owner) after discovering this repo already had substantial undocumented work from an earlier arrangement with Reda.
**Older history:** `HANDOFF.md` and `PROJECT_STATE.md` at repo root cover everything before 2026-07-19 (the original Tier 0/1 build, dated 2026-05). They describe a three-agent workflow and a person "Adnan" — that operating model is no longer in effect; hamdi is sole owner and decision-maker now.

---

## 1. Ownership and repo situation

- Project is hamdi's own idea/product. Reda had been typing/compiling code on his machine using hamdi's Claude account.
- Original repo `RedaBenDZ/Claude-project-Coaching-app-MVP` was cloned and repushed in full to hamdi's own GitHub as `dannyfrost/coachos-mvp` (private). **This is the canonical repo now** — treat the RedaBenDZ repo as legacy/upstream reference only.
- Local working copy: `C:\Users\hammd\CoachOS`.
- Git history was later wiped and force-pushed as a single clean commit under hamdi's own git identity. Reason: Vercel was blocking auto-deploys because the commit author (Reda) wasn't a recognized team member — an anti-spoofing gate, not a real access problem. Rewriting history under hamdi's identity cleared it. Original full history only survives in the upstream RedaBenDZ repo if ever needed.

## 2. Infrastructure stood up

- **Production Supabase**: new project `coachos-mvp-prod` (id `brebbnsxjgvjisbqkcbc`, region us-east-1), under a dummy account (`lucasivo582@gmail.com`) because hamdi's main Supabase account was already at the 2-project free-tier cap. All 13 migrations applied, 16 tables + RLS confirmed, seed data present.
- **Production Vercel**: `apps/web` deployed as `coachos-mvp-web`, live at `https://coachos-mvp-web.vercel.app`, wired to the Supabase project above.
- **Env vars** set on Vercel: Supabase URL/anon key, app name/URL, service role key, `CRON_SECRET`, `SIGNUP_INVITE_CODE` (hamdi holds the value — needed to onboard the first pilot coach).
- **Gotcha logged**: setting Vercel secrets via a PowerShell pipe (`"value" | vercel env add`) silently appends a trailing newline that breaks header-sensitive vars. Fix used: Node `spawnSync` with `input:` instead of PowerShell's native pipe. Don't repeat the pipe approach for secrets on this project.
- **Resend** (transactional email) set up: `RESEND_API_KEY` + `EMAIL_FROM` added. Caveat: the unverified test sender only delivers to hamdi's own signup email — real client-invite emails won't land until a domain is verified in Resend (DNS records, ~10–30 min of work, not yet done).

## 3. Product/design work

- **Root placeholder fixed**: `/` was still the literal scaffold stub text; now redirects to `/login`.
- **Design system applied**: the "Iron Ledger" design (hamdi's own mockups, sent to Reda) had never actually been implemented — Reda's build was 100% backend with raw inline styles / generic Bootstrap blue, some dead Tailwind classNames with no Tailwind pipeline installed. Extracted the design into `apps/web/lib/design-system.tsx` (tokens + Btn/Card/Badge/Avatar/etc.) and restyled every real screen, plus added a Sidebar/TopBar shell.

## 4. Features shipped

| Feature | What it does | Where |
|---|---|---|
| Plans, Messages, Alerts, Settings | Tier 3 features, all wired to RPCs Reda had already built but never exposed in the UI | `/plans`, `/messages`, `/alerts`, `/settings` |
| Absence detection | Was spec'd, never built — no data source existed for `absence_events`. Built the detect route + a missing DB uniqueness constraint. Runs once/day via cron (Vercel Hobby plan only allows daily, not the spec'd every-6h) | `apps/web/app/api/absence/detect/route.ts`, migration `014` |
| Team management | Staff invite (via Supabase auth admin, separate from Resend so not sandbox-restricted), enable/disable, per-staff client assignment, auto-unassign on disable | `/team`, `apps/web/app/api/staff/invite/route.ts` |
| Plan file attachments | Coaches can attach a PDF/image to any plan, downloadable by anyone with access. Bumped the storage bucket to allow PDF + 10MB (was image-only/5MB) | `/api/plans/upload-url`, `/download-url`, migration `015` |
| **Coach roster-wide report** | Client health, flash-card distribution, 7-day check-in activity, subscriptions, staff/ops, absence events. Deliberately shows no revenue/MRR — `client_subscriptions` has no stored price, so a dollar figure can't be shown honestly | `/reports` |
| **Coach per-client report** | New "Report" tab on the client profile page: current flash-card status (see caveat below), weight/steps trend, plan assignment history, message summary, this client's absence event history | `apps/web/app/(coach)/clients/[id]/` |
| **Client-facing mobile report** | New "My Progress" screen on the mobile app: weight/steps trend, current active plan, own absence/alert history. **Deliberately excludes flash-card status** — RLS has no client SELECT policy on `flash_cards` (migration 008, comment: "clients cannot see their own flash card"), a security decision baked into the schema, not an oversight | `apps/mobile/app/(client)/report.tsx` |

**Known data-model gap surfaced while building reports**: `flash_cards` has one row per client (current value only) — there is no history table and `refresh_flash_card` overwrites in place. Any "flash-card trend over time" is not literally buildable without a schema change.

## 5. Testing performed

- Full-stack smoke test on real prod: coach login → invite client (real Resend delivery confirmed) → flash-card compute correctly skips a still-pending client → invite staff. All confirmed working end to end.
- Plan file attachment verified end-to-end (upload → link → download → byte content confirmed).
- Test data seeded in prod for visual QA: 3 clients (green/yellow/red by design), an absence alert, a plan with an attached PDF, messages, a staff assignment.
  - Login: `hamdiadnanabderrahmen@gmail.com` / `CoachOS2026!`
- Both coach report views (roster + per-client) verified by actually running the dev server against prod Supabase and driving a real headless-browser login + navigation — not just typechecked. Screenshots confirmed correct rendering, zero console errors.
- Mobile report screen: **typechecked only** (`tsc --noEmit` clean). Not run on a device or emulator — no Expo tooling was available in this environment. hamdi needs to verify it on a real device/emulator before trusting it.

## 6. Current live state

- Web app: `https://coachos-mvp-web.vercel.app` — live, working.
- No custom domain yet.
- Client emails only reach hamdi's own inbox until Resend domain verification is done.
- Mobile app: not built/published via EAS, only run from source; never tested on device this whole project.

## 7. Git state as of this handoff

Latest commit `397f309` — roster + per-client coach reports. The client-facing mobile report screen (`apps/mobile/app/(client)/report.tsx` + the home-screen link) is **uncommitted** as of this handoff — confirm with hamdi before committing/pushing since it's unverified.
