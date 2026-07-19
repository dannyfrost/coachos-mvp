**MVP Database Schema**

Coaching Platform — Final Locked Version

20 Tables • Multi-Tenant • Supabase + PostgreSQL

# Design Rules

**1. coach_id on every tenant-scoped entity — non-negotiable for RLS and API filtering.**

**2. platform_users is the single auth identity — role-specific data lives in extension tables (coaches, clients). Password hashes are NOT stored in the application schema; authentication is managed entirely by Supabase Auth.**

**3. Flash card is a cached/computed record — recomputed on new daily_log, scheduled job, or manual refresh.**

**4. Soft deletes everywhere — use status fields, never hard delete. Exception: a separate compliance deletion/anonymisation path must exist for GDPR erasure requests (see Erasure Matrix appendix).**

**5. RLS policies filter every query by coach_id matched against authenticated user’s tenant.**

**6. Two-layer security — Supabase RLS + service-layer ownership checks. Neither alone is sufficient.**

**7. Configurable thresholds — flash card rules and absence detection read from coaches.settings JSONB, not hardcoded values.**

**8. Paused clients — clients with status = 'paused' are excluded from absence detection. Flash card shows distinct paused indicator.**

**9. Private Storage only — all media (meal photos, VIP group images) stored in private Supabase Storage buckets with tenant-scoped paths ({coach_id}/{client_id}/{filename}). RLS policies on storage.objects enforce tenant scope on every allowed operation (INSERT, SELECT, DELETE). All other operations are denied by default. Signed URLs are generated server-side with short TTL for authorized requesters only. No public buckets for any tenant data.**

**10. Erasure-capable design — schema must support GDPR Article 17 erasure. Each table has a defined erasure action (hard-delete, anonymise, or retain-minimal). Storage objects must be deletable independently. A tested deletion runbook must prove a single client and their media can be erased without orphaned references or broken dashboards.**

**11. Service role key governance — Supabase service keys bypass RLS on both DB and Storage. They must never appear in frontend bundles, SSR responses, or client-accessible endpoints. All background jobs using service role must rely on DB constraints (composite FKs, CHECKs, UNIQUEs) for tenant integrity since RLS is bypassed. Key rotation cadence and environment isolation must be documented. Constraints are the last line of defence when RLS is inactive.**

# Entity Relationships

**platform_users —1:1→ coaches**

**platform_users —1:1→ clients**

**coaches —1:N→ clients**

**coaches —1:N→ staff_assignments**

**coaches —1:N→ plans**

**coaches —1:N→ coach_subscriptions**

**coaches —1:1→ vip_groups (MVP: max 1)**

**clients —1:N→ daily_logs**

**clients —1:1→ flash_cards**

**clients —1:N→ client_subscriptions**

**clients —1:N→ plan_assignments**

**clients —N:M→ staff (via client_staff_assignments)**

**clients —N:M→ vip_groups (via vip_group_members)**

**roles —1:N→ role_permissions**

**roles —1:N→ staff_assignments**

**vip_groups —1:N→ vip_group_posts**

**vip_group_posts —1:N→ vip_post_reactions**

**vip_group_posts —1:N→ vip_group_posts (self-ref for replies)**

# Table Definitions

## 1. platform_users

**Central identity for every person on the platform. Supabase Auth handles authentication; this table extends it with platform role and status.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** | **Maps to Supabase Auth user ID** |
| **email** | **text UNIQUE** | **Login identity** |
| **full_name** | **text** | **Display name** |
| **role_type** | **enum** | **super_admin │ coach │ assistant │ client** |
| **status** | **enum** | **pending │ active │ paused │ suspended │ banned │ deactivated** |
| **email_verified** | **boolean** | **Set true after email confirmation** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*Every user has exactly one role_type. 'paused' status is used for clients with valid reasons to temporarily stop using the app (injury, vacation, etc.). When paused, absence detection is disabled. 'suspended' = temporary block (can be restored by Super Admin). 'banned' = permanent block (requires Super Admin intervention to reverse). Both suspended and banned block all access. password_hash is NOT stored here — authentication is managed entirely by Supabase Auth.*

## 2. coaches

**Extends platform_users for coach-specific data. This is the tenant anchor — every tenant-scoped entity references coaches.id.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK FK** | **→ platform_users.id** |
| **workspace_name** | **text** | **Coach’s workspace display name** |
| **timezone** | **text** | **e.g. Europe/Paris** |
| **trial_status** | **enum** | **trial_not_started │ trial_active │ trial_expired │ paid_active │ paid_skipped_trial** |
| **trial_started_at** | **timestamp** | **Nullable. Set on first workspace creation** |
| **trial_expires_at** | **timestamp** | **Nullable. trial_started_at + 30 days** |
| **stripe_customer_id** | **text** | **Nullable. Set when Stripe customer created** |
| **settings** | **jsonb** | **Configurable thresholds (see coach_settings below)** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*The 'settings' JSONB column stores configurable thresholds per coach:
• absence_warning_days (default 2)
• absence_critical_days (default 4)
• weight_stagnation_days (default 7)
• escalation_24h / 48h / 72h (default true)
Coaches can adjust these from their dashboard settings. Flash card computation and absence detection read from these values.*

## 3. coach_subscriptions

**Coach’s platform subscription managed via Stripe.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **stripe_subscription_id** | **text** | **Stripe subscription reference** |
| **plan_name** | **text** | **e.g. 'MVP Tier'** |
| **status** | **enum** | **active │ past_due │ cancelled │ expired** |
| **current_period_start** | **timestamp** | **Current billing period start** |
| **current_period_end** | **timestamp** | **Current billing period end** |
| **cancelled_at** | **timestamp** | **Nullable** |
| **created_at** | **timestamp** |  |

*Single tier at MVP. Pricing defined after test period.*

## 4. clients

**Extends platform_users for client-specific data. Always scoped to a coach. UNIQUE(id, coach_id) enables composite FK references from child tables.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK FK** | **→ platform_users.id** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **activation_token_hash** | **text** | **Nullable. Hashed token, cleared after activation** |
| **activation_expires_at** | **timestamp** | **Nullable. Token expiry time** |
| **onboarding_completed** | **boolean** | **True after client finishes onboarding** |
| **age** | **int** | **Nullable** |
| **condition_notes** | **text** | **Nullable (injury, pregnancy, etc.)** |
| **created_at** | **timestamp** |  |

*Client creation flow: coach enters email → platform creates pending record + hashed activation token with expiry → coach sends raw token to client → client activates on mobile app → sets password → completes onboarding → account becomes active. Token is one-time use; cleared on activation. UNIQUE(activation_token_hash) prevents duplicate tokens.*

## 5. client_subscriptions

**Manual tracking of client-to-coach payment status. NOT Stripe-processed at MVP.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **client_id** | **uuid FK** | **→ clients.id (composite FK with coach_id)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **start_date** | **date** |  |
| **end_date** | **date** | **CHECK(end_date >= start_date)** |
| **status** | **enum** | **active │ expired │ overdue** |
| **payment_confirmed_by** | **uuid FK** | **Nullable. → platform_users.id. Only coach or billing/operations role can mark** |
| **notes** | **text** | **Nullable** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*Standard assistants cannot mark payments as paid/unpaid. Only coach + billing/operations role can. System sends renewal reminders 7 days before end_date and on end_date. Access is blocked if client subscription expires. Composite FK: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id).*

## 6. staff_assignments

**Links assistants to a coach’s tenant with regional scope.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **user_id** | **uuid FK** | **→ platform_users.id (the assistant)** |
| **role_id** | **uuid FK** | **→ roles.id (assigned role)** |
| **assigned_timezones** | **text[]** | **e.g. ['Europe/Paris','Africa/Algiers']** |
| **assigned_regions** | **text[]** | **e.g. ['EU','Africa']** |
| **status** | **enum** | **active │ disabled** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*Time zones are assignment logic, not role logic. Single 'assistant' role with scoped assignments. When staff is removed: access disabled immediately, historical actions preserved, tasks/clients reassigned.*

## 7. client_staff_assignments

**Maps which assistants are assigned to which clients.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **client_id** | **uuid FK** | **→ clients.id** |
| **staff_id** | **uuid FK** | **→ platform_users.id** |
| **created_at** | **timestamp** |  |

*UNIQUE constraint on (client_id, staff_id). Composite FK: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id). Assistants can only access clients assigned to them.*

## 8. daily_logs

**Client daily check-in submissions.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **client_id** | **uuid FK** | **→ clients.id (composite FK with coach_id)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **log_date** | **date** | **One log per client per day** |
| **weight** | **decimal** | **Nullable** |
| **steps** | **int** | **Nullable** |
| **meal_description** | **text** | **Nullable. Free text describing meals** |
| **meal_photo_key** | **text** | **Nullable. Storage object key (not URL)** |
| **questions** | **text** | **Nullable. Client questions for coach** |
| **created_at** | **timestamp** |  |

*UNIQUE on (client_id, log_date). Composite FK: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id). Meal photo stored as object key; signed URLs generated at request time via Supabase Storage. Coach sees full photo on client profile page.*

## 9. flash_cards

**Cached/computed client intelligence card for coach dashboard.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **client_id** | **uuid FK** | **→ clients.id — UNIQUE (one card per client)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **status** | **enum** | **green │ yellow │ red** |
| **reason** | **text** | **Auto-generated: short explanation of status (e.g. 'no data for 2 days', 'weight unchanged for 7 days')** |
| **food_summary** | **text** | **Nullable. Latest meal descriptions as text summary** |
| **interpretation** | **text** | **Nullable. Rule-based only. System-generated, not editable (e.g. 'stagnation despite compliance')** |
| **notes** | **text** | **Nullable. Coach-editable private notes and reminders** |
| **last_log_at** | **timestamp** | **Nullable. Timestamp of most recent daily_log** |
| **computed_at** | **timestamp** | **When this card was last recomputed** |

*This is a computed/cached record. Recomputed when: (1) new daily_log arrives, (2) scheduled job runs, or (3) coach clicks manual Refresh button. Thresholds for status rules come from coaches.settings. 'reason' is auto-generated from data. 'interpretation' is system-generated only at MVP (rule-based if/then logic); coach uses 'notes' field separately for private context. 'food_summary' is text only; photos are on daily_logs. Composite FK: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id).*

## 10. plans

**Meal/workout plan templates owned by a coach. UNIQUE(id, coach_id) enables composite FK from plan_assignments.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **title** | **text** | **Plan name** |
| **type** | **enum** | **meal │ workout** |
| **status** | **enum** | **active │ archived. Default active** |
| **content** | **jsonb** | **Flexible structure for plan details** |
| **is_template** | **boolean** | **Reusable template vs one-off assignment** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*Coach-created plans are private to their tenant. No cross-coach sharing by default. JSONB content allows flexible plan structures without rigid schema. Deleting a plan sets status = archived. Archived plans are hidden from lists but preserved if referenced by existing plan_assignments.*

## 11. plan_assignments

**Links a plan to a client. Composite FKs enforce both plan and client belong to same tenant.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **client_id** | **uuid FK** | **→ clients.id (composite FK with coach_id)** |
| **plan_id** | **uuid FK** | **→ plans.id (composite FK with coach_id)** |
| **plan_type** | **text NOT NULL** | **Denormalized from plans.type (meal │ workout). Enables partial unique index** |
| **status** | **enum** | **active │ completed │ replaced** |
| **assigned_at** | **timestamp** |  |
| **assigned_by** | **uuid FK** | **→ platform_users.id (coach or permitted assistant)** |

*Composite FKs: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id) and FOREIGN KEY (plan_id, coach_id) REFERENCES plans(id, coach_id). Assistants can prepare draft plans but cannot finalize/assign unless explicitly allowed by coach. Partial unique index enforces one active plan per type per client.*

## 12. messages

**In-app messaging between coach/assistant and client.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **sender_id** | **uuid FK** | **→ platform_users.id** |
| **recipient_id** | **uuid FK** | **→ platform_users.id** |
| **content** | **text** | **Message body** |
| **read_at** | **timestamp** | **Nullable. Set when recipient reads** |
| **created_at** | **timestamp** |  |

*No threading at MVP — flat message list between two users, filtered by (coach_id + participant pair). Conversations between coaches and clients stay private within tenant.*

## 13. absence_events

**Tracks client absence detection and escalation state.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **client_id** | **uuid FK** | **→ clients.id (composite FK with coach_id)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **trigger_date** | **date** | **Date absence was first detected** |
| **level** | **enum** | **24h │ 48h │ 72h** |
| **action_taken** | **enum** | **pending │ message_sent │ escalated_to_coach │ resolved** |
| **handled_by** | **uuid FK** | **Nullable. → platform_users.id** |
| **created_at** | **timestamp** |  |
| **resolved_at** | **timestamp** | **Nullable** |

*Absence detection is disabled for clients with status = 'paused'. Escalation thresholds read from coaches.settings. +24h/+48h = assistant message. +72h = escalated to coach for manual intervention. UNIQUE(client_id, trigger_date, level) prevents duplicate detection events from cron jobs. Composite FK: FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id).*

## 14. roles

**Global role definitions managed by Super Admin.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **name** | **text UNIQUE** | **e.g. 'Assistant', 'Senior Assistant', 'Billing Operations'** |
| **description** | **text** | **Nullable** |
| **is_default** | **boolean** | **System-provided vs custom-created** |
| **locked** | **boolean NOT NULL** | **DEFAULT false. Set true for seeded/system roles. DB trigger prevents UPDATE/DELETE when locked = true** |
| **created_at** | **timestamp** |  |
| **updated_at** | **timestamp** |  |

*Edits by Super Admin propagate to ALL current assignees (not just new ones). Every role edit is recorded in audit_logs. At MVP, seed 2–3 roles via database and set locked = true. Super Admin UI for role editing is post-MVP. DB trigger blocks: (1) UPDATE/DELETE when OLD.locked = true, (2) UPDATE setting locked from true to false.*

## 15. role_permissions

**Permission flags per role.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **role_id** | **uuid FK** | **→ roles.id** |
| **permission** | **text** | **e.g. view_assigned_clients, send_messages, mark_payment, modify_plans** |
| **granted** | **boolean** | **Whether this permission is active for this role** |

*UNIQUE on (role_id, permission). At MVP, manage via database seeds. Permissions checked at API layer alongside RLS. DB trigger prevents INSERT/UPDATE/DELETE on permissions belonging to a locked role (checks roles.locked via join).*

## 16. vip_groups

**Coach-led VIP accountability group.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE, UNIQUE** |
| **name** | **text** | **Group display name** |
| **created_at** | **timestamp** |  |

*MVP constraint: one group per coach enforced by UNIQUE(coach_id) in the database. No leaderboard in first release. Group is private, coach-controlled.*

## 17. vip_group_members

**Membership list for VIP groups.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **group_id** | **uuid FK** | **→ vip_groups.id** |
| **client_id** | **uuid FK** | **→ clients.id** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **status** | **enum** | **active │ muted │ removed** |
| **joined_at** | **timestamp** |  |

*Coach adds/removes members. Muted members can view but not post. Composite FKs: FOREIGN KEY (group_id, coach_id) REFERENCES vip_groups(id, coach_id) and FOREIGN KEY (client_id, coach_id) REFERENCES clients(id, coach_id).*

## 18. vip_group_posts

**Posts in VIP group feed. UNIQUE(id, coach_id) enables composite FK from reactions.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **group_id** | **uuid FK** | **→ vip_groups.id** |
| **author_id** | **uuid FK** | **→ platform_users.id (client or coach)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **content** | **text** | **Post text** |
| **image_key** | **text** | **Nullable. Storage object key (not URL)** |
| **parent_post_id** | **uuid FK** | **Nullable. → vip_group_posts.id (for replies)** |
| **is_pinned** | **boolean** | **Default false. Only coach can pin** |
| **created_at** | **timestamp** |  |

*MVP supports: text + image posts, replies (via parent_post_id), pinning by coach. Coach moderation: delete any post, mute/remove members. Images stored as object keys; signed URLs generated at request time.*

## 19. vip_post_reactions

**Reactions on VIP group posts.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **post_id** | **uuid FK** | **→ vip_group_posts.id (composite FK with coach_id)** |
| **coach_id** | **uuid FK** | **→ coaches.id — TENANT SCOPE** |
| **user_id** | **uuid FK** | **→ platform_users.id** |
| **reaction_type** | **text** | **e.g. like, fire, strong** |
| **created_at** | **timestamp** |  |

*UNIQUE on (post_id, user_id, reaction_type). One reaction of each type per user per post. coach_id present to avoid RLS join chains to infer tenant. Composite FK: FOREIGN KEY (post_id, coach_id) REFERENCES vip_group_posts(id, coach_id).*

## 20. audit_logs

**Platform-wide audit trail.**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| **id** | **uuid PK** |  |
| **actor_id** | **uuid FK** | **→ platform_users.id** |
| **coach_id** | **uuid FK** | **Nullable. Set for tenant actions, null for platform-wide actions** |
| **action** | **text** | **e.g. role_updated, support_access, payment_marked, client_paused** |
| **target_type** | **text** | **e.g. role, client, coach, subscription** |
| **target_id** | **uuid** | **ID of affected entity** |
| **metadata** | **jsonb** | **Details of change (field names + sanitized diffs only — never raw PII, message content, or health data)** |
| **created_at** | **timestamp** |  |

*Records: role edits (propagated to all assignees), Super Admin support access, payment status changes, client status changes. Immutable — rows are never updated or deleted. Metadata must never contain raw sensitive data; store field names changed and anonymized diffs only.*

# Status Enums Reference

| **Field** | **Values** |
| --- | --- |
| **platform_users.status** | **pending │ active │ paused │ suspended │ banned │ deactivated** |
| **platform_users.role_type** | **super_admin │ coach │ assistant │ client** |
| **coaches.trial_status** | **trial_not_started │ trial_active │ trial_expired │ paid_active │ paid_skipped_trial** |
| **coach_subscriptions.status** | **active │ past_due │ cancelled │ expired** |
| **client_subscriptions.status** | **active │ expired │ overdue** |
| **staff_assignments.status** | **active │ disabled** |
| **flash_cards.status** | **green │ yellow │ red** |
| **plans.type** | **meal │ workout** |
| **plans.status** | **active │ archived** |
| **plan_assignments.status** | **active │ completed │ replaced** |
| **absence_events.level** | **24h │ 48h │ 72h** |
| **absence_events.action_taken** | **pending │ message_sent │ escalated_to_coach │ resolved** |
| **vip_group_members.status** | **active │ muted │ removed** |

# Composite Constraints (Tenant Integrity)

**These constraints ensure that child records cannot reference entities from a different tenant. This is the primary defence against tenant-mismatch bugs and RLS bypass patterns.**

# Role-Type Consistency Triggers

**These triggers prevent impossible states where an extension table row exists for a user with the wrong role_type. Enforced at DB level to protect against service-role scripts and back-office operations.**

# Recommended Indexes

**Targeted indexes for common dashboard, messaging, and RLS-accelerated queries.**

# Appendix: Erasure Matrix

**Defines the erasure action per table for GDPR Article 17 requests. 'Anonymise' means null out PII fields but retain structural record. 'Hard delete' means remove row entirely. 'Retain minimal' means keep ID + timestamps + coach_id only.**

| **Table** | **Erasure Action** |
| --- | --- |
| **platform_users** | **Anonymise (null full_name, email; keep ID + role_type + status)** |
| **coaches** | **Anonymise (null workspace_name; keep ID + settings)** |
| **coach_subscriptions** | **Retain minimal (keep billing period dates + status)** |
| **clients** | **Anonymise (null condition_notes, age; keep ID + coach_id)** |
| **client_subscriptions** | **Retain minimal (keep dates + status)** |
| **staff_assignments** | **Retain minimal** |
| **client_staff_assignments** | **Hard delete** |
| **daily_logs** | **Anonymise (null meal_description, questions; delete Storage object for meal_photo_key; keep weight/steps/dates for anonymised analytics)** |
| **flash_cards** | **Hard delete (computed record, can be recomputed if client returns)** |
| **plans** | **Retain (coach-owned, not client PII)** |
| **plan_assignments** | **Retain minimal (keep assignment dates + status)** |
| **messages** | **Anonymise (null content; keep timestamps + coach_id for structural integrity)** |
| **absence_events** | **Retain minimal (keep dates + level + action_taken)** |
| **roles** | **Retain (global, not PII)** |
| **role_permissions** | **Retain (global, not PII)** |
| **vip_groups** | **Retain (coach-owned)** |
| **vip_group_members** | **Hard delete membership row** |
| **vip_group_posts** | **Anonymise if author is erased client (null content, delete Storage object for image_key)** |
| **vip_post_reactions** | **Hard delete if user is erased client** |
| **audit_logs** | **Retain (immutable; metadata must never contain raw PII per Design Rule)** |

