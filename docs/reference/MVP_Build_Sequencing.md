**Build Sequencing & Task Breakdown**

Coaching Platform — MVP

Priority Tiers • Dependency Chains • Parallel Workstreams

# Build Philosophy

**The MVP is built in priority tiers, not sprints or timeframes. Each tier unlocks the next. Within a tier, independent workstreams can be parallelized. The goal is: at the end of each tier, you have a working subset of the product that can be tested with real coaches.**

## Principles

**1. Foundation first. Schema, auth, and RLS must work before any feature screen is built. Stripe must be done before paid rollout but does not block initial feature development.**

**2. Core loop before features. The daily check-in → flash card → coach action loop is the product. Everything else supports it.**

**3. Coach web and client input must progress together. The coach dashboard is where value is demonstrated; the client app is where value is generated. Neither works without the other. Coach web remains the primary demonstration surface.**

**4. Test each tier before moving on. If the foundation is broken, nothing built on top of it matters.**

**5. VIP Group is gated. It ships only in the MVP+community track, after the core loop is stable.**

# Dependency Map

**This shows what depends on what. Read top to bottom — nothing below can start until everything above it in the same chain is done.**

## Chain 1: Foundation (blocks everything)

| **Order** | **Task** | **Produces** |
| --- | --- | --- |
| **1** | **Supabase project setup (database, auth, storage bucket)** | **Empty database, auth configured, private bucket** |
| **2** | **Deploy schema DDL (20 tables, constraints, composite FKs, triggers)** | **All tables, enums, indexes, role-type triggers, roles.locked triggers** |
| **3** | **Deploy RLS policies + helper functions (private schema)** | **All 20 tables RLS-enabled, 5 helper functions live** |
| **4** | **Seed initial data (roles, role_permissions, Super Admin user)** | **Seeded roles (locked), Super Admin account** |
| **5** | **Deploy Storage RLS policies (tenant-media bucket)** | **Upload/download/delete policies enforced** |
| **6** | **RLS acceptance tests pass** | **Cross-tenant, participant-scope, assignment-scope, storage tests green** |

*Nothing else starts until Chain 1 is complete and tests pass. This is the security boundary.*

## Chain 2: Auth (blocks coach access)

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **7** | **Coach signup flow (POST /api/auth/signup)** | **Chain 1** |
| **8** | **Email verification + workspace creation** | **Task 7** |
| **9** | **Trial activation logic (trial_status state machine)** | **Task 8** |
| **10** | **Coach login + post-login routing** | **Task 8, 9** |

## Chain 2B: Billing (blocks paid rollout, not core loop)

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **10B** | **Stripe integration (create-checkout, webhook, customer-portal)** | **Task 7** |
| **11** | **Trial expiry → read-only enforcement** | **Task 9, 10B** |
| **12** | **Post-login routing update (expired → billing screen)** | **Task 10, 11** |

*Stripe can be built in parallel with Chain 3. The core loop (invite → log → flash card → dashboard) does not require Stripe. Stripe must be done before any coach pays, not before features are built.*

## Chain 3: Core Loop (the product)

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **13** | **Client invite flow (create_client_invite RPC + /api/client-activation/complete)** | **Chain 1, Chain 2 (auth only)** |
| **14** | **Client list screen (coach web)** | **Task 13** |
| **15** | **Client mobile: Activation screen** | **Task 13** |
| **16** | **Client mobile: Home / Today (update_today_log RPC + signed-upload-url)** | **Task 15** |
| **17** | **Flash card computation (refresh_flash_card RPC + /api/flash-cards/compute cron)** | **Task 16** |
| **18** | **Coach Dashboard with flash card grid** | **Task 17** |
| **19** | **Client Profile screen (daily log timeline, flash card, photos)** | **Task 16, 17** |
| **20** | **Flash card notes (update_flash_card_notes RPC)** | **Task 17** |

*After Task 20: the core loop works. Coach can invite clients, clients log daily data, flash cards compute, coach sees status and takes action. This is the testable MVP core.*

## Chain 4: Communication

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **21** | **Messaging RPCs (send_message, list_conversations, get_conversation, mark_message_read)** | **Chain 1** |
| **22** | **Coach: Messages Inbox + Conversation View** | **Task 21** |
| **23** | **Client mobile: Messages screen** | **Task 21, 15** |
| **24** | **Push notifications for new messages (Expo Push)** | **Task 23** |

## Chain 5: Follow-up & Subscription Operations

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **25** | **Absence detection cron (/api/absence/detect)** | **Task 16 (daily_logs must exist)** |
| **26** | **Absence reminder cron (/api/absence/send-reminder)** | **Task 25** |
| **27** | **Absence / Follow-up Queue screen (coach web)** | **Task 25** |
| **28** | **Absence RPCs (mark_absence_handled, resolve_absence)** | **Task 25** |
| **29** | **Client subscription tracking (client_subscriptions CRUD)** | **Chain 1** |
| **30** | **Subscription expiry cron (/api/subscriptions/check-expiry)** | **Task 29** |
| **31** | **Client Subscription Tracker screen** | **Task 29** |
| **32** | **confirm_client_payment RPC** | **Task 29** |
| **33** | **Renewal banner on Client Home + Profile** | **Task 29, 16** |

## Chain 6: Plans & Team

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **34** | **Plans CRUD (coach web: Plans & Templates screen)** | **Chain 1** |
| **35** | **Plan assignment RPCs (assign_plan, replace_active_plan)** | **Task 34, 13 (clients must exist)** |
| **36** | **Client mobile: My Plan screen** | **Task 35** |
| **37** | **Staff invite (/api/auth/invite-staff)** | **Chain 1, 2** |
| **38** | **Staff management RPCs (assign/remove staff to client, update_staff_status, reassign_staff_clients)** | **Task 37** |
| **39** | **Team screen (coach web)** | **Task 37, 38** |
| **40** | **Client mobile: Log History / Progress screen** | **Task 16** |

## Chain 7: VIP Group (gated — MVP+community only)

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **41** | **VIP Group CRUD (vip_groups, vip_group_members)** | **Chain 1, 13 (clients exist)** |
| **42** | **VIP Group posts + reactions (coach web)** | **Task 41** |
| **43** | **VIP Group moderation (delete, mute, remove, pin)** | **Task 42** |
| **44** | **Client mobile: VIP Group screen** | **Task 41, 15** |

*Gate decision: build Chain 7 only after Chains 1–6 are stable and tested. This is the MVP-core vs MVP+community split.*

## Chain 8: Admin Panel

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **45** | **Admin Dashboard (platform KPIs)** | **Chain 1, 2 (coaches + subscriptions exist)** |
| **46** | **Admin Coach List + Coach Detail** | **Task 45** |
| **47** | **Admin suspend/ban/restore routes** | **Task 46** |
| **48** | **Admin Role Management (read-only at MVP)** | **Chain 1 (roles seeded)** |
| **49** | **Admin Audit Log screen + routes** | **Chain 1 (audit_logs exists)** |
| **50** | **Admin Support Access (logging only)** | **Task 49** |

## Chain 9: Operations & Backup

| **Order** | **Task** | **Depends On** |
| --- | --- | --- |
| **51** | **Daily database backup cron (/api/backup/database → R2)** | **Chain 1** |
| **52** | **Backup cleanup cron (/api/backup/cleanup)** | **Task 51** |
| **53** | **Coach Settings screen (thresholds, workspace config)** | **Chain 1, 2** |
| **54** | **Coach Billing screen (Stripe portal redirect)** | **Task 10** |
| **55** | **Client mobile: Profile expanded polish (grace period, export option)** | **Task 13, 29** |

# Priority Tiers

**Tiers define what to build in what order. Each tier produces a testable, demonstrable milestone.**

## Tier 0: Foundation

**Tasks 1–6. Nothing works without this.**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Supabase project + schema DDL** | **Infrastructure** | **Medium** |
| **RLS policies + helper functions** | **Security** | **Medium** |
| **Seed data (roles, Super Admin)** | **Data** | **Small** |
| **Storage RLS policies** | **Security** | **Small** |
| **RLS acceptance tests** | **QA** | **Medium** |

**Exit criteria: all acceptance tests pass (cross-tenant, participant-scope, assignment-scope, storage, default-deny).**

## Tier 1: Auth & Core Loop

**Tasks 7–20. The product becomes real.**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Coach signup + email verification** | **Auth** | **Medium** |
| **Trial activation + state machine** | **Auth** | **Small** |
| **Coach login + routing** | **Auth** | **Small** |
| **Client invite + activation flow** | **Auth** | **Medium** |
| **Client mobile: Activation + Home/Today** | **Mobile** | **Large** |
| **Flash card computation (RPC + cron)** | **Backend** | **Medium** |
| **Coach Dashboard (flash card grid + alerts)** | **Frontend** | **Large** |
| **Client List screen** | **Frontend** | **Medium** |
| **Client Profile screen** | **Frontend** | **Large** |
| **Flash card notes RPC** | **Backend** | **Small** |
| **Stripe integration (checkout, webhook, portal)** | **Billing** | **Large — can parallel with above** |
| **Trial expiry → read-only enforcement** | **Billing** | **Small** |

**Exit criteria: a coach can sign up, invite a client, client logs daily data, flash cards compute, coach sees the dashboard and can open client profiles. Stripe must work before any coach pays but does not block core loop validation.**

**CRITICAL: After Gate 1 passes, stop and test with at least one real coach before expanding scope further.**

*Gate 1 is the most important milestone. If the core loop does not work for a real coach with real clients, nothing else matters. Do not proceed to Tier 2 until at least one coach has used the core loop and provided feedback. This is not optional.*

## Tier 2: Communication & Retention

**Tasks 21–33. Parallel workstreams possible.**

**Workstream A — Messaging**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Messaging RPCs (send, list, get, mark_read)** | **Backend** | **Medium** |
| **Coach: Messages Inbox + Conversation View** | **Frontend** | **Medium** |
| **Client mobile: Messages** | **Mobile** | **Medium** |
| **Push notifications (Expo)** | **Mobile/Infra** | **Medium** |

**Workstream B — Absence Detection**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Absence detection cron** | **Backend** | **Medium** |
| **Absence reminder cron** | **Backend** | **Small** |
| **Follow-up Queue screen** | **Frontend** | **Medium** |
| **Absence RPCs (mark_handled, resolve)** | **Backend** | **Small** |

**Workstream C — Subscription Tracking**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Client subscription tracking (CRUD)** | **Backend** | **Small** |
| **Subscription expiry cron** | **Backend** | **Small** |
| **Client Subscription Tracker screen** | **Frontend** | **Medium** |
| **confirm_client_payment RPC** | **Backend** | **Small** |
| **Renewal banners (client Home + Profile)** | **Mobile** | **Small** |

**Exit criteria: coach and client can message each other, absence events are detected and managed, client subscription status is tracked with renewal reminders.**

*Workstreams A, B, C can run in parallel. They share no dependencies beyond Tier 1.*

## Tier 3: Plans, Team & History

**Tasks 34–40. Parallel workstreams possible.**

**Workstream D — Plans**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Plans CRUD (coach web)** | **Frontend** | **Medium** |
| **Plan assignment RPCs** | **Backend** | **Small** |
| **Client mobile: My Plan** | **Mobile** | **Small** |

**Workstream E — Team Management**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Staff invite flow** | **Backend/Auth** | **Medium** |
| **Staff management RPCs** | **Backend** | **Small** |
| **Team screen (coach web)** | **Frontend** | **Medium** |

**Workstream F — Client History**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Client mobile: Log History / Progress** | **Mobile** | **Medium** |

**Exit criteria: coaches can create/assign/replace plans, manage assistants and their client assignments, clients can view their log history.**

*Workstreams D, E, F can run in parallel.*

## Tier 4: Admin Panel

**Tasks 45–50.**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Admin Dashboard (KPIs)** | **Frontend** | **Medium** |
| **Admin Coach List + Detail** | **Frontend** | **Medium** |
| **Admin suspend/ban/restore routes** | **Backend** | **Small** |
| **Admin Role Management (read-only)** | **Frontend** | **Small** |
| **Admin Audit Log screen + routes** | **Frontend/Backend** | **Medium** |
| **Admin Support Access (logging)** | **Backend** | **Small** |

**Exit criteria: Super Admin can view platform KPIs, manage coaches (suspend/ban/restore), view audit logs, and log support access.**

## Tier 5: Operations & Polish

**Tasks 51–55.**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **Daily database backup cron (recommended for pilot, required pre-launch)** | **Backend/Infra** | **Small** |
| **Backup cleanup cron** | **Backend** | **Tiny** |
| **Coach Settings screen** | **Frontend** | **Small** |
| **Coach Billing screen** | **Frontend** | **Small** |
| **Client mobile: Profile expanded polish (grace period, export option)** | **Mobile** | **Small** |

**Exit criteria: backup running (if implemented), coach can configure thresholds and manage billing, client has a complete polished profile view.**

## Tier 6: VIP Group (Gated)

**Tasks 41–44. Only if MVP+community track is chosen.**

| **Task** | **Category** | **Effort** |
| --- | --- | --- |
| **VIP Group CRUD (groups + members)** | **Backend** | **Medium** |
| **VIP Group posts + reactions (coach web)** | **Frontend** | **Large** |
| **VIP Group moderation** | **Frontend/Backend** | **Medium** |
| **Client mobile: VIP Group** | **Mobile** | **Large** |

**Exit criteria: coach can create a VIP group, add members, members can post/react/reply, coach can moderate. Gate decision must be made before starting this tier.**

# Parallel Workstream Map

**Shows which workstreams can run simultaneously within each tier.**

| **Tier** | **Workstreams** | **Can Parallelize?** |
| --- | --- | --- |
| **Tier 0** | **Foundation (one stream)** | **No — sequential** |
| **Tier 1** | **Auth + Core Loop (one stream)** | **Limited — Stripe can parallel with client invite** |
| **Tier 2** | **A: Messaging, B: Absence, C: Subscriptions** | **Yes — all three independent** |
| **Tier 3** | **D: Plans, E: Team, F: Client History** | **Yes — all three independent** |
| **Tier 4** | **Admin Panel (one stream)** | **Internal — can parallel with Tier 3 if team allows** |
| **Tier 5** | **Operations & Polish (one stream)** | **Can parallel with Tier 4** |
| **Tier 6** | **VIP Group (gated)** | **After Tiers 1–5 stable** |

# Team Allocation Guide

**How to distribute work depending on team size.**

## Solo Developer

**Build sequentially: Tier 0 → 1 → 2 (one workstream at a time) → 3 → 4 → 5. Skip Tier 6 initially. Focus on getting Tier 0+1 testable as fast as possible.**

## 2 Developers (Backend + Frontend/Mobile)

| **Phase** | **Backend Dev** | **Frontend/Mobile Dev** |
| --- | --- | --- |
| **Tier 0** | **Schema + RLS + seeds + tests** | **Repo setup, component library, layout shells** |
| **Tier 1** | **Auth routes, Stripe, invite RPCs, flash card cron** | **Coach Dashboard, Client List, Client Profile, Client Activation + Home** |
| **Tier 2** | **Messaging RPCs, absence crons, subscription RPCs** | **Messages screens, Follow-up Queue, Subscription Tracker, renewal banners** |
| **Tier 3** | **Plan RPCs, staff RPCs, invite-staff route** | **Plans screen, Team screen, My Plan + Log History (mobile)** |
| **Tier 4** | **Admin routes (suspend/ban/restore, audit)** | **Admin Dashboard, Coach List, Coach Detail, Roles, Audit Log** |
| **Tier 5** | **Backup crons** | **Settings, Billing, Client Profile (mobile full)** |

## 3+ Developers (Backend + Frontend + Mobile)

| **Phase** | **Backend** | **Frontend (Web)** | **Mobile (React Native)** |
| --- | --- | --- | --- |
| **Tier 0** | **Schema, RLS, tests** | **Repo, components, layouts** | **Expo setup, nav structure** |
| **Tier 1** | **Auth, Stripe, RPCs, cron** | **Dashboard, Client List, Profile** | **Activation, Home/Today** |
| **Tier 2** | **Messaging, absence, subs RPCs** | **Inbox, Conversation, Queue, Tracker** | **Messages, renewal banners** |
| **Tier 3** | **Plan RPCs, staff RPCs** | **Plans, Team** | **My Plan, Log History** |
| **Tier 4** | **Admin routes** | **Admin screens** | **(idle or polish)** |
| **Tier 5** | **Backup crons** | **Settings, Billing** | **Profile (full)** |
| **Tier 6** | **VIP backend** | **VIP Group (web)** | **VIP Group (mobile)** |

# Critical Path

**The critical path is the longest chain of dependent tasks that determines the earliest possible testable product. Everything off the critical path can be deferred or parallelized without delaying the core.**

## Critical Path (shortest path to testable core loop)

| **Step** | **Task** | **Blocks** |
| --- | --- | --- |
| **1** | **Supabase + schema + RLS + tests** | **Everything** |
| **2** | **Coach signup + trial activation** | **Coach access** |
| **3** | **Stripe checkout + webhook** | **Paid access** |
| **4** | **Client invite + activation** | **Client access** |
| **5** | **Client Home / Today (daily logging)** | **Data input** |
| **6** | **Flash card computation** | **Coach visibility** |
| **7** | **Coach Dashboard (flash card grid)** | **Coach decision-making** |
| **8** | **Client Profile (timeline + photos)** | **Coach deep-dive** |

**After step 8: the core product loop is testable with a real coach and real clients.**

## Off Critical Path (important but not blocking)

| **Feature** | **Why Off Path** | **When to Build** |
| --- | --- | --- |
| **Messaging** | **Valuable but coaches can use WhatsApp initially** | **Tier 2 (after core loop works)** |
| **Absence detection** | **Automates manual follow-up but not required for day 1** | **Tier 2** |
| **Subscription tracking** | **Manual tracking works for first few clients** | **Tier 2** |
| **Plans** | **Coaches can describe plans informally initially** | **Tier 3** |
| **Team management** | **No assistants needed for first pilot coach** | **Tier 3** |
| **Admin panel** | **Platform owner can use Supabase Dashboard initially** | **Tier 4** |
| **VIP Group** | **Engagement feature, not core workflow** | **Tier 6 (gated)** |
| **Backup** | **Risk accepted for private pilot** | **Tier 5** |

# Testing Gates

**Each tier has explicit exit criteria. Do not proceed to the next tier until the gate passes.**

| **Gate** | **Tests** | **Pass Criteria** |
| --- | --- | --- |
| **Gate 0** | **RLS acceptance suite (cross-tenant, participant-scope, assignment-scope, storage, default-deny, triggers)** | **All tests green. Zero cross-tenant data leaks** |
| **Gate 1** | **Coach can signup → subscribe → invite client → client activates → client logs data → flash card computes → coach sees dashboard** | **Full loop completes end-to-end with real data** |
| **Gate 2** | **Coach ↔ client messaging works. Absence events detected and managed. Subscription reminders sent. Expired clients blocked** | **Communication and retention loops work** |
| **Gate 3** | **Plans assigned/replaced correctly. Assistants invited, assigned to clients, scoped properly. Client sees plan and history** | **Delegation and planning work** |
| **Gate 4** | **Admin can view KPIs, manage coaches, view audit log. Suspend/ban/restore works** | **Admin operations functional** |
| **Gate 5** | **Backup runs successfully. Restore tested once. Settings and billing screens work** | **Operational safety net in place** |
| **Gate 6** | **VIP Group: create, post, react, reply, moderate, membership-scoped visibility** | **Community feature works (if built)** |

# Build Risk Register

**Known risks during build, ordered by likelihood and impact.**

| **Risk** | **Impact** | **Mitigation** |
| --- | --- | --- |
| **RLS policies have bugs → data leaks** | **Critical** | **Gate 0 tests must pass. Never skip. Re-test after any RLS change** |
| **Stripe webhook handling is fragile** | **High** | **Use Stripe CLI for local testing. Handle all subscription states. Idempotent webhook processing** |
| **Flash card computation is slow at scale** | **Medium** | **Use incremental updates (on new daily_log), not full recompute. Index daily_logs properly** |
| **Client activation token flow has UX friction** | **Medium** | **Test with real phone on real network. Simplify to minimum steps** |
| **Storage signed URLs leak or expire incorrectly** | **High** | **Short TTL (15 min). Never cache signed URLs client-side. Test cross-tenant blocked** |
| **VIP Group scope creep** | **High** | **Gate decision before build. Reduced scope only (no leaderboard). Strict feature freeze** |
| **Team size too small for parallel workstreams** | **Medium** | **Stay sequential. Prioritize critical path. Defer Admin, VIP, backup** |
| **Schema migration needed mid-build** | **Medium** | **Use Supabase migrations. Never modify live schema without migration file** |

# MVP Deliverables Checklist

**Complete list of what must exist for MVP launch.**

## Infrastructure

| **Deliverable** | **Status** |
| --- | --- |
| **Supabase project (database, auth, storage)** | **Required** |
| **Vercel deployment (Next.js coach web + admin)** | **Required** |
| **Expo/EAS build (React Native client app)** | **Required** |
| **Stripe account (test mode for pilot, live for launch)** | **Required** |
| **Cloudflare R2 bucket (backup storage)** | **Recommended for pilot. Required before public launch** |
| **Domain + DNS configured** | **Required** |
| **Environment variables documented + secured** | **Required** |

## Database

| **Deliverable** | **Status** |
| --- | --- |
| **20 tables deployed with all constraints** | **Required** |
| **Composite FKs on all tenant-scoped tables** | **Required** |
| **Triggers (role-type, roles.locked, role_permissions locked)** | **Required** |
| **Indexes (dashboard, messaging, daily_logs, flash_cards)** | **Required** |
| **Seed data (roles, permissions, Super Admin)** | **Required** |
| **RLS enabled on all tables** | **Required** |
| **RLS policies for all 20 tables** | **Required** |
| **Helper functions in private schema** | **Required** |
| **Storage RLS policies** | **Required** |

## Backend

| **Deliverable** | **Count** | **Status** |
| --- | --- | --- |
| **Custom RPCs** | **20** | **Required** |
| **Server API routes** | **16** | **Required** |
| **Cron jobs** | **4 (+2 backup)** | **Required (backup: MVP-minimal)** |

## Frontend — Coach Web

| **Deliverable** | **Status** |
| --- | --- |
| **Login / Signup** | **Required** |
| **Dashboard (flash card grid + alerts)** | **Required** |
| **Client List** | **Required** |
| **Client Profile** | **Required** |
| **Invites / Activations** | **Required** |
| **Plans & Templates** | **Required** |
| **Messages Inbox + Conversation View** | **Required** |
| **Absence / Follow-up Queue** | **Required** |
| **Team** | **Required** |
| **Client Subscription Tracker** | **Required** |
| **Workspace Settings** | **Required** |
| **Billing** | **Required** |
| **VIP Group** | **Gated (MVP+community only)** |

## Frontend — Client Mobile

| **Deliverable** | **Status** |
| --- | --- |
| **Activation** | **Required** |
| **Home / Today** | **Required** |
| **Log History / Progress** | **Required** |
| **My Plan** | **Required** |
| **Messages** | **Required** |
| **Profile (basic: name, coach, subscription status)** | **Required** |
| **Profile (expanded: grace period, full polish)** | **Tier 5 polish** |
| **VIP Group** | **Gated (MVP+community only)** |

## Frontend — Admin Panel

| **Deliverable** | **Status** |
| --- | --- |
| **Dashboard** | **Required** |
| **Coach List + Detail** | **Required** |
| **Role Management (read-only)** | **Required** |
| **Audit Log** | **Required** |
| **Support Access** | **Required** |

## Operations

| **Deliverable** | **Status** |
| --- | --- |
| **Daily database backup to R2** | **Recommended for pilot. Required before public launch** |
| **Storage backup to R2** | **Required (pre-public-launch)** |
| **Backup cleanup (30-day retention)** | **Recommended for pilot. Required before public launch** |
| **Restore procedure documented** | **Required** |
| **Restore tested once** | **Required (pre-public-launch)** |
| **Erasure runbook documented** | **Required (pre-public-launch)** |

# Summary

**Total tasks: 55 (51 for MVP-core, +4 for VIP Group if gated in).**

**Total tiers: 7 (0–5 core, 6 gated).**

**Critical path: 8 tasks from empty project to testable core loop.**

**Maximum parallelism: 3 workstreams in Tier 2 and Tier 3.**

**Testing gates: 7 (one per tier, mandatory before proceeding).**

**Build order: Foundation → Auth & Core Loop → Communication & Retention → Plans & Team → Admin → Operations → VIP (gated).**

**The single most important milestone: Gate 1.**

**When a coach can sign up, invite a client, see their flash card, and take action from the dashboard — you have a product. Everything else extends it.**

