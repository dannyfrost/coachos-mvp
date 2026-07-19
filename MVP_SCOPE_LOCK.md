# MVP_SCOPE_LOCK.md

**Project:** Coaching Platform MVP  
**Purpose:** Explicit yes/no decisions on every feature that affects schema, tiers, or build sequencing.  
**Status:** PARTIAL — items marked PENDING require founder decision before their affected tier begins.  
**Last updated:** 2026-05-09

---

## How to use this file

- **IN** — feature is in scope for MVP. Will be built.
- **OUT** — feature is explicitly excluded from MVP. Will not be built.
- **PENDING** — decision not yet made. Must be resolved before the tier listed in "Required before."
- Do not start any task that depends on a PENDING item until the item is resolved.

---

## Core Features

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Coach signup and workspace creation | IN | T1-00 | Includes trial activation |
| Coach login and post-login routing | IN | T1-02 | — |
| Email verification | IN | T1-01 | Required for workspace creation |
| Client invite flow | IN | T2-00 | `create_client_invite` RPC + activation route |
| Client mobile activation screen | IN | T2-01 | — |
| Client mobile Home / Today screen (daily log + meal photo) | IN | T2-02 | — |
| Flash card computation (RPC + cron) | IN | T2-03 | Core product value |
| Coach dashboard with flash card grid | IN | T2-04 | — |
| Flash card notes (`update_flash_card_notes` RPC) | IN | T2-05 | — |

---

## Communication

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| In-app messaging (coach ↔ client) | IN | Tier 3 | Real-time via Supabase Realtime |
| Push notifications | PENDING | Tier 3 / Messaging | Decision required: provider choice and mobile platform |
| Email reminders | PENDING | Tier 4 | Depends on email provider decision |

---

## Client Profile

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Client profile screen (mobile) | PENDING | Tier 2 client profile task | Scope unclear — decide: read-only vs editable fields |
| Client profile editing by coach | PENDING | Tier 2 | Decide: coach edits client profile, or client self-edits only |

---

## Plans and Subscriptions

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Plan builder (coach creates plans for clients) | IN | Tier 5 | — |
| Stripe billing integration | IN | Tier 1B (parallel track) | Not a core-loop blocker |
| Subscription management (upgrade / downgrade / cancel) | IN | Before paid rollout | — |
| Free trial logic | IN | T1-00 | — |

---

## VIP Group

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| VIP Group feature (any part) | OUT of MVP-core | Revisit after Gate 5 | Excluded from MVP. Do not build any VIP feature until Gate 5 passes and scope is reopened. |
| VIP Group schema in migration 002 | OUT | T0-02 (tables migration) | Do not create VIP tables in migration 002. VIP schema is deferred entirely. |
| VIP content posting | OUT of MVP-core | Post-Gate 5 | — |
| VIP member management | OUT of MVP-core | Post-Gate 5 | — |

> **Decision locked 2026-05-09:** VIP Group is OUT of MVP-core. No VIP tables, no VIP RPCs, no VIP UI. Revisit only after Gate 5 passes.

---

## Admin Panel

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Admin read views (coach list, client list, audit log) | IN | Tier 5 | Read-only admin dashboard |
| Admin client directory | PENDING | Admin panel tasks | Decide: does admin see all clients across all tenants, or only flagged ones? |
| Super admin moderation — suspend coach workspace | PENDING | Tier 7 | — |
| Super admin moderation — ban user | PENDING | Tier 7 | — |
| Super admin moderation — restore suspended account | PENDING | Tier 7 | — |
| Role boundary: Super Admin vs Senior Assistant in admin context | PENDING | Admin panel write paths | Decide: can Senior Assistant take any moderation actions, or Super Admin only? |

---

## Mobile

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Mobile pilot platform | PENDING | Mobile build begins | Options: Expo Go (easiest), TestFlight (iOS), Play Store internal track (Android). Affects OTA update capability. |
| Mobile app stores (public) | OUT for MVP | Post-launch | App store submission is post-MVP |
| Tablet / iPad support | OUT for MVP | — | Mobile phone only for MVP |

---

## Launch / Operations

| Feature | Decision | Required before | Notes |
|---|---|---|---|
| Backup and restore test | PENDING | Pre-launch | Define procedure and verify it works |
| Legal / privacy policy copy | PENDING | Pilot onboarding | Required for compliance |
| Public marketing site | OUT for MVP | Post-launch | — |
| Analytics / event tracking | OUT for MVP | — | Not a launch blocker |
| Localization / i18n | OUT for MVP | — | English-only for pilot |

---

## Summary of PENDING items

| # | Item | Blocks |
|---|---|---|
| 1 | ~~VIP Group IN/OUT~~ | ~~T0-02 tables migration~~ — **RESOLVED: OUT** |
| 2 | Mobile pilot platform | Mobile build |
| 3 | Push notification provider | Tier 3 messaging |
| 4 | Client profile screen scope | Tier 2 profile task |
| 5 | Admin client directory scope | Admin panel tasks |
| 6 | Super admin moderation write paths | Tier 7 |
| 7 | Admin role boundary (Super Admin vs Senior Assistant) | Admin panel write paths |

> No task may begin whose row in this table has a PENDING dependency.
