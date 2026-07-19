**API Endpoint Specification**

Coaching Platform — MVP

3 Layers • PostgREST • RPC • Server API Routes

# API Architecture

## Three Layers

**Layer 1 — Supabase PostgREST (auto-generated, RLS-protected)**

**Direct table reads and limited writes via supabase.from('table').select/insert/update/delete(). RLS handles access control. Used for simple operations where row-level filtering is sufficient and no cross-table business logic validation is needed.**

**Layer 2 — Supabase RPC (custom database functions)**

**For operations needing: column-level safety (prevent tampering with non-target fields), cross-table validation (recipient checks, type enforcement), atomic multi-step mutations (replace plan + deactivate old), or derived/computed responses (conversation grouping, profile summaries). Called via supabase.rpc('function_name', params).**

**Layer 3 — Next.js API Routes (server-side)**

**For operations requiring: service role key (bypasses RLS for background jobs), external service integration (Stripe, Supabase Auth admin), signed URL generation (Storage), admin-only workflows (suspend/ban/restore), auth identity creation, or compliance operations (erasure). Called from frontend via standard fetch to /api/* routes.**

## Key Principles

**1. Prefer Layer 1 for reads. Most screens load data via direct PostgREST queries with RLS filtering.**

**2. Use Layer 2 for writes that need business-rule validation beyond what RLS row-checks cover.**

**3. Use Layer 3 for service-role operations, external integrations, auth identity creation, and admin workflows.**

**4. Never expose service role key to the client. All Layer 3 routes run server-side.**

**5. Every write that modifies tenant data must be protected by either RLS (Layer 1) or explicit tenant checks inside RPCs/routes (Layer 2/3).**

**6. Auth identity creation (user signup, client activation, staff invitation) always goes through Layer 3 server routes, not database RPCs.**

**7. Heavy batch operations (recompute all flash cards) go through Layer 3 queued jobs, not direct RPCs.**

# Layer 1 — PostgREST Direct Access

**Schema has 20 tables total. All tables are readable via PostgREST with RLS enforcement. Direct writes (INSERT/UPDATE/DELETE) are limited to specific tables where row-level RLS is sufficient.**

## Read Access (All 20 Tables)

**Every table is readable via PostgREST. RLS policies control which rows are visible per role. audit_logs is also readable via PostgREST for coach (tenant-scoped) and super_admin (all), but admin-facing screens should use Layer 3 routes for filtering/formatting.**

## Write Access (Explicit Per Table)

*Only the following tables accept direct PostgREST writes. All other table writes go through Layer 2 RPCs or Layer 3 routes.*

| **Table** | **Allowed Ops** | **By Role** | **Restricted Fields** |
| --- | --- | --- | --- |
| **coaches** | **UPDATE** | **Coach (self only)** | **Only: workspace_name, timezone, settings, updated_at. Never: id, trial_status, stripe_customer_id** |
| **vip_groups** | **INSERT, UPDATE, DELETE** | **Coach** | **Coach can only manage own tenant group. UNIQUE(coach_id) enforces max 1** |
| **vip_group_members** | **INSERT, UPDATE, DELETE** | **Coach** | **Coach manages membership. Status changes (active/muted/removed) via UPDATE** |
| **vip_group_posts** | **INSERT** | **Coach, Client (active member)** | **Client: author_id must = auth.uid(). Coach: full INSERT. No client UPDATE (post is immutable once created)** |
| **vip_group_posts** | **UPDATE, DELETE** | **Coach only** | **Coach moderation: can update is_pinned, delete any post** |
| **vip_post_reactions** | **INSERT, DELETE** | **Client (active member)** | **Client: user_id must = auth.uid(). INSERT own reactions, DELETE own reactions. No UPDATE** |
| **vip_post_reactions** | **DELETE** | **Coach** | **Coach moderation: can delete any reaction** |
| **staff_assignments** | **(reads only)** | **Coach, Assistant** | **All writes go through Layer 2 RPCs (update_staff_status) or Layer 3 (invite-staff)** |
| **plan_assignments** | **(reads only)** | **Coach, Assistant, Client** | **All writes go through Layer 2 RPCs (assign_plan, replace_active_plan)** |
| **messages** | **(reads only)** | **Coach, Assistant, Client** | **All writes go through Layer 2 RPCs (send_message). UPDATE revoked for authenticated role** |
| **flash_cards** | **(reads only)** | **Coach, Assistant** | **All writes go through Layer 2 RPC (update_flash_card_notes) or service role. UPDATE revoked for authenticated role** |
| **daily_logs** | **(reads only)** | **Coach, Assistant, Client** | **All client writes go through Layer 2 RPC (update_today_log)** |

# Layer 2 — Custom RPCs

**Database functions enforcing business rules beyond what row-level RLS covers. Total: 20 RPCs.**

## Messaging (4 RPCs)

**send_message(recipient_id, content)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Insert message with explicit recipient validation** |
| **Called by** | **Coach, Assistant, Client** |
| **Validation** | **Coach: recipient must be tenant member (client or staff via is_tenant_member). Assistant: recipient must be assigned client OR own coach. Client: recipient must be own coach OR assigned assistant (checked via client_staff_assignments)** |
| **Writes** | **INSERT INTO messages (sender_id=auth.uid(), recipient_id, coach_id, content)** |
| **Returns** | **Created message row** |

**list_conversations()**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Return conversation list with last message and unread count** |
| **Called by** | **Coach, Assistant, Client** |
| **Coach model** | **Client-based aggregates (Option A): one row per client, aggregating all communication including assistant↔client activity. Coach sees the full client communication picture, not individual pair-level splitting** |
| **Assistant/Client model** | **Strict participant-pair grouping (Option B): one row per conversation partner** |
| **Returns** | **Array: participant name, last message preview, timestamp, unread count** |

**get_conversation(participant_id, cursor)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Return paginated messages for one conversation** |
| **Called by** | **Coach, Assistant (if participant), Client (if participant)** |
| **Coach behavior** | **Returns all messages involving the specified client (coach↔client + assistant↔client)** |
| **Assistant/Client behavior** | **Returns only messages where caller is sender or recipient** |
| **Pagination** | **Cursor-based by created_at DESC** |

**mark_message_read(message_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Column-safe update of read_at only** |
| **Called by** | **Recipient of the message (any role)** |
| **Validation** | **auth.uid() must equal recipient_id. Same tenant check** |
| **Writes** | **UPDATE messages SET read_at = now() WHERE id = message_id** |

*Direct UPDATE on messages is revoked for authenticated role. All updates go through RPCs.*

## Flash Cards (2 RPCs)

**update_flash_card_notes(card_id, notes)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Column-safe update of notes field only** |
| **Called by** | **Coach (own tenant), Assistant (assigned clients)** |
| **Validation** | **Coach: card.coach_id = auth.uid(). Assistant: is_my_assigned_client(card.client_id)** |
| **Writes** | **UPDATE flash_cards SET notes = p_notes WHERE id = card_id** |

**refresh_flash_card(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Trigger immediate recomputation of one client’s flash card** |
| **Called by** | **Coach** |
| **Logic** | **Read latest daily_logs + coaches.settings → compute status/reason/interpretation/food_summary → update flash_cards row** |
| **Returns** | **Updated flash card row** |

*Direct UPDATE on flash_cards is revoked for authenticated role. Bulk refresh (all clients) goes through Layer 3 queued job, not RPC.*

## Client Invitations (3 RPCs)

**create_client_invite(email)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Create pending client record with hashed activation token and expiry** |
| **Called by** | **Coach** |
| **Logic** | **Create platform_users (status=pending, role_type=client) + clients (coach_id, activation_token_hash, activation_expires_at). Return raw token to coach** |
| **Returns** | **Raw activation token (coach shares with client)** |

**regenerate_invite_token(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Generate new token + new expiry for pending client** |
| **Called by** | **Coach** |
| **Validation** | **Client must be status=pending and in coach’s tenant** |
| **Returns** | **New raw token** |

**revoke_invite(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Clear activation token, keep pending record** |
| **Called by** | **Coach** |
| **Writes** | **SET activation_token_hash = NULL, activation_expires_at = NULL** |

*Client activation (token validation + Auth user creation + session) is handled by Layer 3 server route, not RPC. See /api/client-activation/complete.*

## Plan Management (2 RPCs)

**assign_plan(client_id, plan_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Assign a plan to a client with type enforcement** |
| **Called by** | **Coach (or assistant with modify_plans permission)** |
| **Logic** | **Read plan.type → check no existing active assignment of same type for this client → create plan_assignment with plan_type denormalized → partial unique index prevents duplicates** |
| **Validation** | **Plan must be status=active (not archived), same tenant. Client must be active** |
| **Returns** | **Created plan_assignment row** |

**replace_active_plan(client_id, plan_type, new_plan_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Replace current active plan of a given type with a new one** |
| **Called by** | **Coach** |
| **Logic** | **SET current active assignment status=replaced → create new assignment with status=active. Atomic transaction** |
| **Validation** | **New plan must be status=active, match plan_type. Same tenant** |
| **Returns** | **New plan_assignment row** |

*Replaces direct INSERT/UPDATE on plan_assignments. Prevents double-active and type mismatch.*

## Absence Management (2 RPCs)

**mark_absence_handled(event_id, action)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Update action_taken and handled_by on an absence event** |
| **Called by** | **Coach (own tenant), Assistant (assigned clients)** |
| **Validation** | **Event must be in caller’s tenant. Assistant must be assigned to event’s client** |
| **Writes** | **UPDATE absence_events SET action_taken = action, handled_by = auth.uid()** |

**resolve_absence(event_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Mark absence event as resolved** |
| **Called by** | **Coach, Assistant (assigned)** |
| **Writes** | **SET action_taken = 'resolved', resolved_at = now()** |

## Client Status (3 RPCs)

**pause_client(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Set client status to paused, disable absence detection** |
| **Called by** | **Coach** |
| **Writes** | **UPDATE platform_users SET status = 'paused'. Flash card shows paused indicator** |

**unpause_client(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Set client status back to active** |
| **Called by** | **Coach** |
| **Writes** | **UPDATE platform_users SET status = 'active'** |

**deactivate_client(client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Deactivate client. Preserves all data. 7-day grace period starts (derived from client_subscriptions.end_date, not stored)** |
| **Called by** | **Coach** |
| **Writes** | **UPDATE platform_users SET status = 'deactivated'** |

## Payment Tracking (1 RPC)

**confirm_client_payment(subscription_id, notes)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Confirm client payment receipt. Sets payment_confirmed_by and normalizes status to active** |
| **Called by** | **Coach, Assistant with billing/operations role (has_permission('mark_payment'))** |
| **Validation** | **Subscription must be in caller’s tenant. Standard assistants cannot call this** |
| **Writes** | **UPDATE client_subscriptions SET status = 'active', payment_confirmed_by = auth.uid(), notes = p_notes, updated_at = now()** |

*This RPC is strictly for manual payment confirmation. Overdue/expired lifecycle transitions are handled by the cron job (/api/subscriptions/check-expiry). The RPC does not allow arbitrary status mutations — it only confirms payment (sets status to active).*

## Staff Management (3 RPCs)

**assign_staff_to_client(staff_id, client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Create client-staff assignment with tenant validation** |
| **Called by** | **Coach** |
| **Validation** | **Staff and client must be in same tenant. Staff must be active. UNIQUE(client_id, staff_id) prevents duplicates** |
| **Writes** | **INSERT INTO client_staff_assignments** |

**remove_staff_from_client(staff_id, client_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Remove client-staff assignment** |
| **Called by** | **Coach** |
| **Writes** | **DELETE FROM client_staff_assignments WHERE staff_id AND client_id** |

**update_staff_status(staff_assignment_id, status)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Enable or disable an assistant. Status change only — does NOT reassign clients** |
| **Called by** | **Coach** |
| **Validation** | **Must be in coach’s tenant. Status = active or disabled** |
| **Writes** | **UPDATE staff_assignments SET status** |

*Client reassignment is a separate operation. Use reassign_staff_clients() below. Disabling an assistant and reassigning their clients are distinct actions with different failure modes.*

**reassign_staff_clients(from_staff_id, to_staff_id)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Move all client assignments from one assistant to another (or back to coach if to_staff_id is null)** |
| **Called by** | **Coach** |
| **Validation** | **Both staff must be in same tenant. Target staff must be active (unless null = unassign)** |
| **Writes** | **UPDATE client_staff_assignments SET staff_id = to_staff_id WHERE staff_id = from_staff_id AND coach_id = auth.uid()** |

## Daily Logging (1 RPC)

**update_today_log(weight, steps, meal_description, meal_photo_key, questions)**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Upsert today’s daily log (insert if new, update if exists)** |
| **Called by** | **Client** |
| **Logic** | **log_date = CURRENT_DATE. client_id = auth.uid(). coach_id = get_my_coach_id(). INSERT ON CONFLICT (client_id, log_date) DO UPDATE** |
| **Validation** | **Client must be status=active (not paused/deactivated). Subscription must not be expired** |
| **Returns** | **Upserted daily_log row** |

## Client Profile (1 RPC)

**get_client_profile_summary()**

| **Attribute** | **Detail** |
| --- | --- |
| **Purpose** | **Return combined profile for the authenticated client** |
| **Called by** | **Client** |
| **Logic** | **Join clients + platform_users (self + coach name) + client_subscriptions (latest). Compute derived grace period (end_date + 7 days). Return status, subscription state, coach name, grace days remaining** |
| **Returns** | **Profile summary object** |

*Avoids exposing raw cross-table joins to the client. Derived grace-period logic computed server-side.*

# Layer 3 — Next.js API Routes

**Server-side routes using Supabase service role key. Never exposed to browser. Handles external integrations, auth identity creation, admin operations, background jobs, and compliance. Total: 16 routes.**

## Authentication (3 routes)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/auth/signup** | **POST** | **Coach signup: create Supabase Auth user + platform_users + coaches row + trigger trial. Returns auth session** |
| **/api/auth/invite-staff** | **POST** | **Send Supabase Auth email invite for assistant. On acceptance, staff_assignments row links to tenant** |
| **/api/client-activation/complete** | **POST** | **Client activation: validate token against DB → create Supabase Auth user via admin API → clear token fields → set status=active → return auth session. Public endpoint (token is the credential)** |

*All auth identity creation goes through Layer 3 server routes, never database RPCs. This keeps auth-layer concerns (user creation, session minting) out of the database.*

## Stripe Integration (3 routes)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/stripe/webhook** | **POST** | **Stripe webhook: subscription.created / updated / cancelled / deleted → update coach_subscriptions + coaches.trial_status. Verifies signature** |
| **/api/stripe/create-checkout** | **POST** | **Create Stripe Checkout session for coach subscription** |
| **/api/stripe/customer-portal** | **POST** | **Generate Stripe Customer Portal URL for billing management** |

## Storage (3 routes)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/storage/signed-upload-url** | **POST** | **Validate tenant + path + file type (JPEG/PNG) + size (max 5MB) → return signed upload URL. Path must match {coach_id}/{client_id}/{filename}** |
| **/api/storage/signed-download-url** | **POST** | **Validate tenant + path → return short-lived signed download URL** |
| **/api/storage/delete-object** | **POST** | **Validate tenant ownership → delete Storage object. Used for: coach moderation, erasure flows** |

*File type and size validation happens server-side before signed URL issuance, not via RLS. Storage RLS enforces tenant path scoping on the actual upload/download.*

## Background Jobs (5 routes, cron-triggered)

| **Route** | **Method** | **Schedule** | **Purpose** |
| --- | --- | --- | --- |
| **/api/flash-cards/compute** | **POST** | **Hourly** | **Recompute all flash cards from daily_logs + coaches.settings. Service role. Skips paused clients** |
| **/api/flash-cards/compute-all** | **POST** | **On demand** | **Coach-triggered bulk recompute for all their clients. Queued/throttled server-side. Not a direct RPC to prevent abuse** |
| **/api/absence/detect** | **POST** | **Every 6h** | **Scan daily_logs for missing check-ins. Create absence_events. Idempotent via UNIQUE(client_id, trigger_date, level). Skips paused clients** |
| **/api/absence/send-reminder** | **POST** | **Every 6h** | **Send absence reminders based on level + coaches.settings escalation toggles. Mark events as message_sent** |
| **/api/subscriptions/check-expiry** | **POST** | **Daily** | **Check client_subscriptions for upcoming/past expiry. Send renewal reminders (7 days before + on end_date). Transition expired statuses** |

*All cron jobs use service role key. They rely on DB constraints (composite FKs, UNIQUEs, CHECKs) for integrity since RLS is bypassed. Paused clients are skipped by absence detection.*

## Admin Operations (5 routes)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/admin/coaches/:id/suspend** | **POST** | **Set platform_users.status = suspended (temporary block, can restore). Log to audit_logs** |
| **/api/admin/coaches/:id/ban** | **POST** | **Set platform_users.status = banned (permanent block, requires Super Admin to reverse). Log to audit_logs** |
| **/api/admin/coaches/:id/restore** | **POST** | **Set platform_users.status = active. Log to audit_logs. Super Admin only** |
| **/api/admin/audit-logs** | **GET** | **Filtered, formatted audit log listing. Supports: action type, date range, actor, target type, coach_id filters** |
| **/api/admin/audit-logs/:id** | **GET** | **Single audit log detail with expanded metadata** |

## Support Access (1 route)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/admin/support-access** | **POST** | **Log support access request to audit_logs with actor, reason, target coach. MVP: audit logging + manual ops only** |

*MVP does not grant runtime elevated operational-data access through product UI. Support action is logged, and any deeper access is handled manually off-product (Supabase dashboard, DB inspection, logs). Post-MVP: request/approve/deny/revoke lifecycle with time-bounded sessions.*

## Erasure / Compliance (1 route, internal only)

| **Route** | **Method** | **Purpose** |
| --- | --- | --- |
| **/api/admin/erasure/client** | **POST** | **Execute full erasure runbook for one client: (1) delete Storage objects → (2) anonymize/delete app table rows per erasure matrix → (3) hard-delete auth.users. Service role only. Logged to audit_logs** |

*Post-pilot compliance operation. Erasure order: Storage objects first → app tables → auth.users last (cannot delete Auth user if they own Storage objects). Supabase Auth soft delete is NOT sufficient for GDPR Article 17; use hard delete. Erasure matrix defines per-table actions (see Schema document appendix).*

# Screen → Endpoint Mapping

## Coach Web App

| **Screen** | **Layer 1 (PostgREST)** | **Layer 2 (RPC)** | **Layer 3 (API Routes)** |
| --- | --- | --- | --- |
| **Dashboard** | **flash_cards, clients, absence_events, client_subscriptions, messages, platform_users** | **refresh_flash_card** | **compute-all (queued)** |
| **Client List** | **clients, flash_cards, client_subscriptions, platform_users, client_staff_assignments** |  |  |
| **Client Profile** | **daily_logs, flash_cards, plan_assignments, plans, messages, absence_events, client_subscriptions, client_staff_assignments, platform_users** | **update_flash_card_notes** | **signed-download-url** |
| **Invites** | **clients, platform_users** | **create_client_invite, regenerate_invite_token, revoke_invite** |  |
| **Plans** | **plans** |  |  |
| **Assign Plan** | **plan_assignments** | **assign_plan, replace_active_plan** |  |
| **Messages Inbox** |  | **list_conversations** |  |
| **Conversation** |  | **get_conversation, mark_message_read, send_message** |  |
| **Follow-up Queue** | **absence_events, clients, platform_users, client_staff_assignments** | **mark_absence_handled, resolve_absence** |  |
| **VIP Group** | **vip_groups, vip_group_members, vip_group_posts, vip_post_reactions** |  | **signed-download-url** |
| **Team** | **staff_assignments, client_staff_assignments, platform_users, roles, role_permissions** | **assign_staff_to_client, remove_staff_from_client, update_staff_status, reassign_staff_clients** | **invite-staff** |
| **Subscriptions** | **client_subscriptions, clients, platform_users** | **confirm_client_payment** |  |
| **Settings** | **coaches** |  |  |
| **Billing** | **coach_subscriptions, coaches** |  | **create-checkout, customer-portal** |

## Client Mobile App

| **Screen** | **Layer 1 (PostgREST)** | **Layer 2 (RPC)** | **Layer 3 (API Routes)** |
| --- | --- | --- | --- |
| **Activation** |  |  | **client-activation/complete** |
| **Home / Today** | **client_subscriptions** | **update_today_log** | **signed-upload-url** |
| **Log History** | **daily_logs** |  | **signed-download-url** |
| **My Plan** | **plan_assignments, plans** |  |  |
| **Messages** |  | **list_conversations, get_conversation, send_message, mark_message_read** |  |
| **VIP Group** | **vip_group_posts, vip_post_reactions, vip_group_members** |  | **signed-download-url** |
| **Profile** |  | **get_client_profile_summary** |  |

## Admin Panel

| **Screen** | **Layer 1 (PostgREST)** | **Layer 2 (RPC)** | **Layer 3 (API Routes)** |
| --- | --- | --- | --- |
| **Dashboard** | **coaches, coach_subscriptions** |  |  |
| **Coach List** | **coaches, platform_users, coach_subscriptions** |  |  |
| **Coach Detail** | **coaches, platform_users, coach_subscriptions** |  | **suspend, ban, restore** |
| **Roles** | **roles, role_permissions** |  |  |
| **Audit Log** |  |  | **audit-logs, audit-logs/:id** |
| **Support Access** |  |  | **support-access** |

# Cron Job Summary

| **Job** | **Schedule** | **Route** | **Dependencies** |
| --- | --- | --- | --- |
| **Flash card recompute** | **Hourly** | **/api/flash-cards/compute** | **daily_logs, coaches.settings, flash_cards** |
| **Absence detection** | **Every 6h** | **/api/absence/detect** | **daily_logs, absence_events, coaches.settings** |
| **Absence reminders** | **Every 6h** | **/api/absence/send-reminder** | **absence_events, coaches.settings** |
| **Subscription expiry** | **Daily** | **/api/subscriptions/check-expiry** | **client_subscriptions** |

*All cron jobs run via Vercel Cron or Supabase pg_cron. Service role key required. Idempotency enforced by DB constraints. Paused clients skipped.*

# Security Notes

**1. No additional row-authorization checks are required for Layer 1 reads, but application code may still need feature gating, status gating, and UX-level constraints.**

**2. Layer 2 RPCs use SECURITY DEFINER with SET search_path = '' to prevent search-path injection.**

**3. Layer 3 routes validate the authenticated user’s JWT before executing. Admin routes verify role_type = super_admin.**

**4. Stripe webhooks verify signature via Stripe SDK before processing.**

**5. Signed URL routes validate tenant ownership + file constraints before issuing URLs. URLs are short-lived (configurable TTL).**

**6. REVOKE UPDATE on messages and flash_cards for the authenticated role. All updates go through RPCs.**

**7. Client activation (/api/client-activation/complete) is the only public (unauthenticated) endpoint. Token is the credential. One-time use with expiry.**

**8. All admin state changes (suspend/ban/restore) are logged to audit_logs with actor, action, and metadata.**

**9. Auth identity creation (signup, activation, staff invite) always goes through server routes, never database RPCs.**

**10. Heavy batch operations (refresh all flash cards) go through queued server jobs, not direct RPCs, to prevent abuse and resource exhaustion.**

