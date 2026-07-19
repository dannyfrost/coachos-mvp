# MVP Current Build Status for External Review

**Project:** Coaching Platform MVP  
**Document type:** Current execution status update for consultant review  
**Purpose:** Supplement the original `MVP_READINESS_FINAL.md` so Claude Opus can understand that the project is no longer at ground zero.  
**Current stage:** Phase 0 complete; Tier 0 database foundation started.  
**Last confirmed completed task:** T0-02 — Create Tables Migration.  
**Next task not yet started:** T0-03 — Create Composite Constraints Migration.

---

## 1. How this document should be used

This document does **not** replace `MVP_READINESS_FINAL.md`.

It should be read **after** the original readiness file.

The original file explains the pre-build readiness state and intended sequence. This file explains what has actually been completed since then.

Claude Opus / consultant role:

- Read `MVP_READINESS_FINAL.md` first.
- Read this file second.
- Treat this file as the current execution update.
- Review whether the current build direction remains coherent.
- Identify risks, inconsistencies, missing checks, and what should happen next.
- Do **not** assume the project is still at ground zero.
- Do **not** generate code unless explicitly asked.

---

## 2. Current project status

The project is no longer at ground zero.

Current status:

- Phase 0 is complete.
- Tier 0 has started.
- T0-01 is complete and accepted.
- T0-02 is complete and accepted.
- T0-03 has not started yet.
- Gate 0 has not started yet.
- No application code has started.
- No UI work has started.
- No mobile app implementation has started.
- No RLS policies have started.
- No RPC functions have started.
- No seed data has started.
- No Stripe billing work has started.
- VIP Group is excluded from MVP-core.

---

## 3. Completed work

## 3.1 Phase 0 — Complete

Phase 0 produced the control and bootstrap files needed before database work.

Created Phase 0 outputs:

1. Repo structure
2. `PROJECT_STATE.md`
3. `DECISIONS.md`
4. `MVP_SCOPE_LOCK.md`
5. `FLASH_CARD_RULES.md`
6. `ROLE_SEED_MATRIX.md`
7. `TESTING_STRATEGY.md`
8. `.env.example`
9. `.gitignore`
10. `package.json`
11. `pnpm-workspace.yaml`

Repo structure created:

```text
apps/web
apps/mobile
packages/shared
packages/supabase
supabase/migrations
docs
scripts
tests
```

Phase 0 status: **accepted**.

---

## 4. Locked decisions after Phase 0

The following decisions are now locked:

| Area | Decision |
|---|---|
| Package manager | `pnpm` |
| Supabase workflow | Local-first using `supabase start` |
| Remote Supabase | Reserved for staging/production later |
| Testing now | Database/RLS tests only |
| Testing later | Vitest / Playwright / mobile tests after app code exists |
| Gate 0 testing style | SQL/pgTAP-style database tests |
| VIP Group | OUT of MVP-core |
| VIP revisit point | After Gate 5 only |

VIP exclusion means:

- No VIP tables in MVP-core.
- No VIP enums in MVP-core.
- No VIP RLS policies in MVP-core.
- No VIP RPCs in MVP-core.
- No VIP UI in MVP-core.

---

## 5. T0-01 — Create Enum Types Migration

Status: **complete and accepted**.

Migration file created:

```text
supabase/migrations/001_create_enums.sql
```

Purpose:

Define all PostgreSQL enum types required before table creation.

Important correction history:

An early draft introduced incorrect/invented enum names and values. It was rejected and rewritten to align with the locked schema and task guide.

Incorrect enum types removed:

- `account_status`
- `subscription_status`
- `flash_card_color`
- `invite_status`
- `message_type`
- `user_role`

Incorrect or invented values removed:

- `grey`
- `revoked`
- `image`
- `pending_activation`

Schema-required values restored:

- `pending`
- `suspended`
- `banned`
- `deactivated`
- `past_due`
- `overdue`

---

## 6. Final accepted enum set

The accepted enum set in `001_create_enums.sql` contains exactly these 12 enum types.

## 6.1 `public.user_status`

Values:

- `pending`
- `active`
- `paused`
- `suspended`
- `banned`
- `deactivated`

Used for lifecycle status of platform users.

## 6.2 `public.role_type`

Values:

- `super_admin`
- `coach`
- `assistant`
- `client`

Important:

`senior_assistant` and `billing_operations` are **not** values of `role_type`. They are seeded role/permission profiles in the `roles` table later.

## 6.3 `public.trial_status`

Values:

- `trial_not_started`
- `trial_active`
- `trial_expired`
- `paid_active`
- `paid_skipped_trial`

## 6.4 `public.coach_subscription_status`

Values:

- `active`
- `past_due`
- `cancelled`
- `expired`

## 6.5 `public.client_subscription_status`

Values:

- `active`
- `expired`
- `overdue`

## 6.6 `public.staff_status`

Values:

- `active`
- `disabled`

## 6.7 `public.flash_status`

Values:

- `green`
- `yellow`
- `red`

Important:

There is no stored `grey` enum value. Grey/no-data/paused display behavior remains a UI/computation decision, not a stored enum value for now.

## 6.8 `public.plan_type_enum`

Values:

- `meal`
- `workout`

## 6.9 `public.plan_status`

Values:

- `active`
- `archived`

## 6.10 `public.plan_assign_status`

Values:

- `active`
- `completed`
- `replaced`

## 6.11 `public.absence_level`

Values:

- `24h`
- `48h`
- `72h`

## 6.12 `public.absence_action`

Values:

- `pending`
- `message_sent`
- `escalated_to_coach`
- `resolved`

---

## 7. T0-02 — Create Tables Migration

Status: **complete and accepted**.

Migration file created:

```text
supabase/migrations/002_create_tables.sql
```

Purpose:

Create all MVP-core tables using the enum types from T0-01.

Scope:

- 16 MVP-core tables created.
- VIP tables excluded.
- Table definitions only.
- PKs, simple FKs, defaults, NOT NULL, and simple UNIQUE constraints included.
- No composite FKs.
- No indexes.
- No triggers.
- No RLS policies.
- No RPC functions.
- No seed data.
- No app code.

---

## 8. Final accepted MVP-core tables

The final accepted T0-02 migration creates these 16 tables:

1. `platform_users`
2. `roles`
3. `role_permissions`
4. `coaches`
5. `coach_subscriptions`
6. `clients`
7. `client_subscriptions`
8. `staff_assignments`
9. `client_staff_assignments`
10. `daily_logs`
11. `flash_cards`
12. `plans`
13. `plan_assignments`
14. `messages`
15. `absence_events`
16. `audit_logs`

Excluded VIP tables:

- `vip_groups`
- `vip_group_members`
- `vip_group_posts`
- `vip_post_reactions`

---

## 9. Important T0-02 correction history

The first T0-02 draft had major schema drift. It was rejected and rewritten.

Corrections made and accepted:

### 9.1 Identity model corrected

Final accepted model:

- `coaches.id` shares the same UUID as `platform_users.id`.
- `clients.id` shares the same UUID as `platform_users.id`.
- No separate generated `coach_id` or `client_id` plus nullable `user_id` pattern.

### 9.2 Media field corrected

Final accepted field:

```text
daily_logs.meal_photo_key
```

Rejected field:

```text
daily_logs.meal_photo_url
```

Reason:

The database stores the Supabase Storage object key, not a signed or public URL. Signed URLs are generated at read time.

### 9.3 Daily log fields corrected

Final accepted `daily_logs` fields include:

- `client_id`
- `coach_id`
- `log_date`
- `weight`
- `steps`
- `meal_description`
- `meal_photo_key`
- `questions`
- `created_at`

Also corrected:

- `questions` is `text`, not `jsonb`.
- `UNIQUE(client_id, log_date)` is included.

### 9.4 Flash card fields corrected

Final accepted `flash_cards` fields include:

- `client_id`
- `coach_id`
- `status`
- `reason`
- `food_summary`
- `interpretation`
- `notes`
- `last_log_at`
- `computed_at`

Also corrected:

- `notes` is used, not `coach_notes`.
- `UNIQUE(client_id)` is included.

### 9.5 Messaging model corrected

Final accepted `messages` model:

- `coach_id`
- `sender_id`
- `recipient_id`
- `content`
- `read_at`
- `created_at`

Rejected model:

- `client_id`
- `body`
- `sent_at`

Reason:

The locked API and RLS model use sender/recipient participant validation.

### 9.6 Client subscription fields corrected

Final accepted `client_subscriptions` fields include:

- `client_id`
- `coach_id`
- `start_date`
- `end_date`
- `status`
- `payment_confirmed_by`
- `notes`
- `created_at`
- `updated_at`

Rejected fields:

- `starts_at`
- `ends_at`

### 9.7 Roles and permissions corrected

Final accepted `roles` includes:

- `name UNIQUE`
- `description`
- `is_default`
- `locked`
- `created_at`
- `updated_at`

Final accepted `role_permissions` includes:

- `id`
- `role_id`
- `permission`
- `granted`
- `UNIQUE(role_id, permission)`

### 9.8 Audit log fields corrected

Final accepted `audit_logs` includes:

- `actor_id`
- `coach_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

Rejected fields:

- `target_table`
- `payload`

---

## 10. Accepted simple constraints in T0-02

T0-02 includes simple constraints only. The following are accepted:

- `platform_users.email UNIQUE`
- `roles.name UNIQUE`
- `role_permissions UNIQUE(role_id, permission)`
- `clients.activation_token_hash UNIQUE`
- `client_staff_assignments UNIQUE(client_id, staff_id)`
- `daily_logs UNIQUE(client_id, log_date)`
- `flash_cards.client_id UNIQUE`

T0-02 does not include composite FKs. Those are reserved for T0-03.

---

## 11. Current next task

Next task:

```text
T0-03: Create Composite Constraints Migration
```

Expected file:

```text
supabase/migrations/003_composite_constraints.sql
```

T0-03 has not started yet.

T0-03 should:

- Add tenant-integrity composite constraints for MVP-core tables only.
- Add `UNIQUE(id, coach_id)` on required parent tables.
- Add composite foreign keys on required child tables.
- Add `CHECK(end_date >= start_date)` on `client_subscriptions` if not already present.
- Exclude all VIP constraints.

T0-03 must not:

- Create tables.
- Modify T0-01 unless explicitly approved.
- Modify T0-02 unless explicitly approved.
- Create indexes.
- Create triggers.
- Create RLS policies.
- Create RPC functions.
- Create seed data.
- Create app code.
- Start T0-04.

---

## 12. Likely MVP-core composite constraints for T0-03

Potential parent constraints:

```text
clients: UNIQUE(id, coach_id)
plans: UNIQUE(id, coach_id)
```

Potential child composite FKs:

```text
daily_logs(client_id, coach_id) → clients(id, coach_id)
flash_cards(client_id, coach_id) → clients(id, coach_id)
client_subscriptions(client_id, coach_id) → clients(id, coach_id)
plan_assignments(client_id, coach_id) → clients(id, coach_id)
plan_assignments(plan_id, coach_id) → plans(id, coach_id)
absence_events(client_id, coach_id) → clients(id, coach_id)
client_staff_assignments(client_id, coach_id) → clients(id, coach_id)
```

Potential check constraint:

```text
client_subscriptions: CHECK(end_date >= start_date)
```

Important:

The original schema included VIP composite constraints, but VIP is now explicitly OUT of MVP-core. Do not include VIP constraints in T0-03.

---

## 13. Remaining pending decisions

These remain pending and should not block T0-03 unless they directly affect constraints:

1. Flash card green/yellow/red threshold percentages
2. Flash card cron frequency
3. Flash card no-data display behavior
4. Senior assistant permission details
5. Client own profile write access
6. Mobile pilot platform
7. Mobile test framework
8. Admin client directory scope
9. Super admin moderation write permissions
10. Admin role boundary

---

## 14. What must not start yet

Do not start:

- Coach dashboard UI
- Client mobile app UI
- Messaging UI
- VIP Group
- Admin panel write paths
- Stripe billing implementation
- RLS policies
- RPC functions
- Seed data
- Public launch preparation

---

## 15. Review questions for Claude Opus / consultant

Claude Opus should review the original `MVP_READINESS_FINAL.md` and this current status file, then answer these questions:

1. Is the current sequence still coherent after Phase 0, T0-01, and T0-02?
2. Are the accepted enum types and tables aligned enough to continue to T0-03?
3. Did excluding VIP from MVP-core introduce any downstream inconsistency in the remaining task sequence?
4. What exact checks should be performed before accepting T0-03?
5. Should any pending decision be resolved before T0-03, or can it wait?
6. What risks exist if T0-03 adds composite constraints on top of the current T0-02 table definitions?
7. What should be the recommended T0-03 prompt?
8. What should be checked manually after T0-03?
9. Are there any warnings before moving toward T0-04 indexes, T0-05 triggers, and T0-06 RLS helper functions?
10. Is the current foundation still safe for AI-assisted implementation, or should any corrective action happen first?

---

## 16. Current go / no-go table

| Area | Status |
|---|---|
| Original readiness review | Still useful as baseline |
| Phase 0 | Complete |
| T0-01 enums | Complete and accepted |
| T0-02 tables | Complete and accepted |
| T0-03 composite constraints | Next; not started |
| T0-04 indexes | Not started |
| T0-05 triggers | Not started |
| T0-06 private schema / RLS helpers | Not started |
| RLS policies | Not started |
| RPC functions | Not started |
| Seed data | Not started |
| Gate 0 tests | Not started |
| Application code | Not started |
| VIP Group | Out of MVP-core |

---

## 17. Bottom line

The project has progressed from documentation-only to early Tier 0 database foundation.

Current accepted state:

- Phase 0 complete.
- Enum migration complete.
- MVP-core table migration complete.
- VIP excluded from MVP-core.
- Next task is composite tenant-integrity constraints.

The project is not yet ready for application development. It must complete the remaining Tier 0 migrations and Gate 0 acceptance tests before moving to auth, core loop, UI, mobile, messaging, Stripe, or admin work.