# CoachOS — Plan: What's Left

**As of:** 2026-07-23. Companion to `2026-07_TAKEOVER_HANDOFF.md` in this folder — read that first for what's already done.

Items below are grouped by workstream, roughly in the order it makes sense to tackle them. Items marked **[DECISION NEEDED]** are blocked on a call only hamdi can make — nothing to build until that's resolved.

---

## A. Reports tier (in progress)

1. **Commit the client-facing mobile report** — built (`apps/mobile/app/(client)/report.tsx`), typechecked, but unverified on a real device/emulator. Test it, then commit.
2. **PDF export** — not built. Original scope picked "in-app + exportable PDF" for both coach reports (roster-wide and per-client). Needs a PDF generation approach chosen (e.g. `@react-pdf/renderer`, or server-side HTML→PDF) since nothing in the stack does this yet.
3. **[DECISION NEEDED] Business/owner-facing report** — blocked. `client_subscriptions` has no stored price, so revenue/MRR can't be shown honestly. Options:
   - Add a manual price field per subscription now (quick, but a fake/manual number, not real billing)
   - Wait until Stripe is actually integrated (was deferred at MVP scope-lock) and derive revenue from real billing data
   - Skip revenue entirely, report only non-financial ops metrics (client count, staff load, churn-by-status) for now

## B. Deployment hardening

4. **Custom domain** — still on `coachos-mvp-web.vercel.app`. Needs a domain purchased/pointed and added in Vercel.
5. **Resend domain verification** — client-invite emails currently only land in hamdi's own inbox (test sender). Needs DNS records added and verified in Resend (~10–30 min) before any real client can be invited.

## C. Mobile

6. **EAS production build** — mobile app has never been built as a real installable app, only run from source. Needed before any real client can use it on their own phone.
7. **Device/emulator test pass** — the entire mobile app (not just the new report screen) has never been run on a device or emulator this whole project. Worth doing as one pass rather than piecemeal.

## D. Backend gaps (spec'd, never built, no active consumer yet — lower urgency)

8. `/api/absence/send-reminder`
9. `/api/flash-cards/compute-all`
10. `/api/subscriptions/check-expiry`

## E. Quality

11. **No automated tests** beyond DB-level pgTAP (84 tests, DB layer only). No web or mobile test coverage at all. Worth deciding whether to add before or after the pilot coach onboards — retrofitting tests after real user data exists is harder to justify skipping.

## F. Go-live blocker (the actual next milestone)

12. **First pilot coach onboarding** — signup flow with the real invite code was tested successfully once (`hamdiadnanabderrahmen@gmail.com`), but that was hamdi testing himself, not a real external coach. Realistically blocked on B (domain + email) at minimum before it makes sense to hand this to someone outside the project.

---

## Suggested order

Given the state above, a reasonable sequence:

1. Finish Reports (PDF export; get hamdi's call on the revenue question) — since it's already mid-flight
2. Resend domain verification (B.5) — small, unblocks real invites
3. Mobile device test pass (C.7) + commit the report screen (A.1)
4. Custom domain (B.4)
5. EAS build (C.6) once the mobile app itself is trusted
6. Pilot coach onboarding (F.12) — the actual goal
7. Tests (E.11) and backend gaps (D) as ongoing hardening, not blockers

This is a suggestion, not a decision — confirm the order and the two flagged decisions with hamdi before starting the next chunk of work.
