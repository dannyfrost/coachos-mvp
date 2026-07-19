# Tasks — CoachOS

## In flight
- Pre-007 decision: bootstrap local Supabase vs. defer to T0-13

## Next up
- T0-06b: 007_rls_enable.sql (after bootstrap)
- T0-07: 008_rls_policies.sql
- T0-08: 009_rpc_functions.sql
- T0-09: 010_revoke_grants.sql
- T0-10: 011_storage_policies.sql
- T0-11: 012_seed_data.sql
- T0-12: TypeScript type generation
- Gate 0: write G0-01 through G0-12 test files; run suite

## Backlog (Tier 1 and beyond)
- Tier 1: Coach signup, email verify, workspace creation, trial activation, login, post-login routing
- Tier 1B: Stripe coach-billing parallel track
- Tier 2: Client invite + activation, daily log, flash card computation, dashboard
- Tier 3: Messaging
- Tier 4: Subscriptions, absence detection, follow-up queue
- Tier 5: Plans, team management, admin reads

## Deferred (do not start without approval)
- VIP Group (post-Gate 5)
- Admin panel write paths (blocked on role boundary decision)
- Admin client directory (blocked on scope decision)
- In-app plan builder (out of MVP)
- Push notifications (deferred)
- 7 remaining Client Mobile Stitch prompts