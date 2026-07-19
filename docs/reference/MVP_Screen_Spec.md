**Screen-by-Screen Spec**

Coaching Platform — MVP

3 Interfaces • Coach Web • Client Mobile • Admin Panel

# Navigation Overview

## Coach Web App (Next.js)

| **Screen** | **Route** |
| --- | --- |
| **Login / Signup** | **/login, /signup** |
| **Dashboard** | **/dashboard** |
| **Client List** | **/clients** |
| **Client Profile** | **/clients/:id** |
| **Invites / Activations** | **/invites** |
| **Plans & Templates** | **/plans** |
| **Messages Inbox** | **/messages** |
| **Conversation View** | **/messages/:participant_id** |
| **Absence / Follow-up Queue** | **/follow-ups** |
| **VIP Group** | **/vip-group** |
| **Team** | **/team** |
| **Client Subscription Tracker** | **/subscriptions** |
| **Workspace Settings** | **/settings** |
| **Billing** | **/billing** |

## Client Mobile App (React Native)

| **Screen** | **Route/Tab** |
| --- | --- |
| **Activation** | **Shown once, pre-auth** |
| **Home / Today** | **Tab: Home** |
| **Log History / Progress** | **Tab: History** |
| **My Plan** | **Tab: Plan** |
| **Messages** | **Tab: Messages** |
| **VIP Group** | **Tab: VIP (if member)** |
| **Profile** | **Tab: Profile** |

## Admin Panel (Next.js)

| **Screen** | **Route** |
| --- | --- |
| **Dashboard** | **/admin/dashboard** |
| **Coach List** | **/admin/coaches** |
| **Coach Detail** | **/admin/coaches/:id** |
| **Role Management** | **/admin/roles** |
| **Audit Log** | **/admin/audit** |
| **Support Access Requests** | **/admin/support** |

# COACH WEB APP

## 1. Login / Signup

**Purpose: Coach authentication, account creation, and trial/subscription activation.**

| **Element** | **Detail** |
| --- | --- |
| **Auth method** | **Supabase Auth (email + password)** |
| **Signup flow** | **Email → verification → workspace creation → trial starts** |
| **Paid-first path** | **Select paid tier → Stripe checkout → trial skipped** |
| **Post-login routing** | **If trial_expired + no subscription → /billing. Otherwise → /dashboard** |
| **Expired state** | **Read-only dashboard, billing banner, cannot add/edit clients** |

*Tables: coaches (trial_status, workspace_name), coach_subscriptions, platform_users*

## 2. Dashboard

**Purpose: At-a-glance operational overview. Flash cards are the centerpiece.**

**Layout**

| **Section** | **Content** | **Data Source** |
| --- | --- | --- |
| **Flash Card Grid** | **One card per client: status color, name, weight, steps, food summary, reason, notes, action buttons** | **flash_cards, clients, platform_users** |
| **Alerts Bar** | **Counts: absence 24h/48h/72h pending, subscriptions expiring in 7 days, unread messages** | **absence_events, client_subscriptions, messages** |
| **Summary Stats** | **Active clients, expired clients, pending activations, missing check-ins today** | **clients, client_subscriptions, daily_logs** |
| **Renewal Banner** | **Shown if coach subscription is past_due or expiring** | **coach_subscriptions** |

**Flash Card Anatomy**

| **Field** | **Source** | **Behavior** |
| --- | --- | --- |
| **Client name** | **platform_users.full_name** | **Display only** |
| **Status color** | **flash_cards.status** | **Green / Yellow / Red badge** |
| **Reason** | **flash_cards.reason** | **Auto-generated text** |
| **Weight + Steps** | **flash_cards (cached from daily_logs)** | **Latest values** |
| **Food summary** | **flash_cards.food_summary** | **Text summary of latest meals** |
| **Interpretation** | **flash_cards.interpretation** | **Nullable. Rule-based. System-generated** |
| **Notes** | **flash_cards.notes** | **Coach-editable via RPC (update_flash_card_notes)** |
| **Last update** | **flash_cards.last_log_at** | **Timestamp of most recent daily_log** |
| **Refresh button** | **Triggers recomputation** | **Calls service-role endpoint to recompute card** |
| **Action: Open Profile** | **Navigate to /clients/:id** |  |
| **Action: Message** | **Navigate to /messages/:client_id** |  |
| **Action: Review Diet** | **Navigate to /clients/:id#plans** |  |

**Filters**

**Status filter: All / Green / Yellow / Red. Search by client name. Sort by: status severity, last update, name.**

*Paused clients show a distinct 'paused' indicator and are excluded from absence alerts.*

## 3. Client List

**Purpose: Manage all clients with filtering and quick actions.**

| **Element** | **Detail** |
| --- | --- |
| **Table columns** | **Name, status (active/paused/pending/deactivated), flash card status (G/Y/R), subscription end date, last check-in, assigned assistant** |
| **Filters** | **Status: active / paused / pending / expired / deactivated. Flash card: green / yellow / red. Subscription: active / expiring soon / expired** |
| **Search** | **By client name or email** |
| **Actions per row** | **Open Profile, Message, Pause/Unpause, Archive** |
| **Bulk actions** | **None at MVP** |
| **Add Client button** | **Navigates to /invites with pre-filled create flow** |

*Tables: clients, platform_users, flash_cards, client_subscriptions, client_staff_assignments*

## 4. Client Profile

**Purpose: Full client detail view. The coach’s primary workspace for individual client management.**

**Sections**

| **Section** | **Content** | **Data Source** |
| --- | --- | --- |
| **Identity** | **Name, age, condition notes, status, onboarding state** | **clients, platform_users** |
| **Flash Card** | **Full flash card (same as dashboard but expanded)** | **flash_cards** |
| **Daily Log Timeline** | **Scrollable day-by-day: weight, steps, meal text, meal photo, questions. Each entry shows date + values. Photo displayed inline** | **daily_logs** |
| **Current Plan** | **Active meal plan + active workout plan. Title, type, content preview** | **plan_assignments, plans** |
| **Subscription** | **Start date, end date, status, payment confirmed by, notes** | **client_subscriptions** |
| **Messages** | **Recent messages with this client (last 10). Link to full conversation** | **messages** |
| **Absence History** | **Timeline of absence events: trigger date, level, action taken, handled by, resolved date** | **absence_events** |
| **Assigned Staff** | **Which assistant(s) are assigned to this client** | **client_staff_assignments, platform_users** |
| **Notes** | **Flash card notes (editable via RPC)** | **flash_cards.notes** |

**Actions**

**Message client, Assign plan, Edit condition notes, Pause/Unpause, Change subscription status, Reassign staff, Deactivate client (sets platform_users.status = deactivated).**

## 5. Invites / Activations

**Purpose: Create pending clients, manage activation tokens, track onboarding.**

| **Element** | **Detail** |
| --- | --- |
| **Create Invite** | **Enter client email → system creates pending record + hashed token with expiry → displays raw token for coach to send** |
| **Invite List** | **Table: client email, status (pending/active), token expiry, onboarding completed** |
| **Actions** | **Resend token (regenerate + new expiry), Revoke (clear token), View activation status** |
| **Auto-cleanup** | **Expired tokens shown with warning. Option to regenerate** |

*Tables: clients (activation_token_hash, activation_expires_at, onboarding_completed), platform_users*

## 6. Plans & Templates

**Purpose: Create, edit, and manage meal and workout plan templates.**

| **Element** | **Detail** |
| --- | --- |
| **Plan List** | **Table: title, type (meal/workout), status (active/archived), is_template, created date, last updated. Filter: active only by default** |
| **Create Plan** | **Title, type selector (meal/workout), content editor (JSONB — flexible structure), mark as template** |
| **Edit Plan** | **Same as create, pre-filled. Only active plans can be edited** |
| **Archive Plan** | **Sets plans.status = archived. Archived plans are hidden from lists but preserved if referenced by existing plan_assignments. Cannot archive a plan with active assignments** |
| **Assign from here** | **Button to assign plan to a client (navigates with plan pre-selected)** |

*Tables: plans (status: active/archived), plan_assignments*

## 7. Messages Inbox

**Purpose: View all conversations. Coach sees all tenant messages.**

| **Element** | **Detail** |
| --- | --- |
| **Conversation List** | **One row per client: client name, last message preview, timestamp, unread badge** |
| **Sort** | **By last message timestamp (newest first). Unread at top** |
| **Filter** | **All / Unread only** |
| **Click row** | **Navigate to /messages/:participant_id** |

*Tables: messages, platform_users, clients. Conversation grouping computed in query via (coach_id, LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)).*

## 8. Conversation View

**Purpose: Full chat between coach and one client. Flat message list, no threading.**

| **Element** | **Detail** |
| --- | --- |
| **Message list** | **Chronological. Sender name + timestamp + content. Read receipts (read_at)** |
| **Compose** | **Text input + send button. sender_id = auth.uid(). Recipient validated via RLS** |
| **Scroll** | **Load older messages on scroll up (paginated by created_at DESC)** |
| **Mark as read** | **Auto-triggered when conversation is opened. Uses mark_message_read() RPC** |

*Tables: messages. No threading at MVP. Coach can also see assistant ↔ client messages in this view.*

## 9. Absence / Follow-up Queue

**Purpose: Dedicated operational screen for managing client absence events and escalation workflow.**

| **Element** | **Detail** |
| --- | --- |
| **Queue List** | **Table: client name, trigger date, level (24h/48h/72h), action taken, handled by, resolved date** |
| **Filters** | **Level: 24h / 48h / 72h. Status: pending / message_sent / escalated / resolved. Date range** |
| **Actions per row** | **Mark as message_sent, Escalate to coach, Mark resolved, Open client profile, Message client** |
| **Escalation indicator** | **72h events with action_taken = pending are highlighted as urgent** |
| **Auto-refresh** | **Queue refreshes periodically or on manual trigger** |

*Tables: absence_events, clients, platform_users, client_staff_assignments. Assistants see only their assigned clients' events. Cron job creates events; this screen manages them.*

*Thresholds for detection come from coaches.settings (configurable per coach).*

## 10. VIP Group

**Purpose: Coach-led community space for selected VIP clients. One group per coach at MVP.**

| **Element** | **Detail** |
| --- | --- |
| **Feed** | **Chronological posts: author name, content, image (signed URL), timestamp, reactions count, replies** |
| **Compose** | **Text + optional image upload. Coach can post. Pinning available** |
| **Members panel** | **List of members: name, status (active/muted/removed). Add/remove/mute actions** |
| **Moderation** | **Delete any post, mute member, remove member** |
| **Replies** | **Threaded via parent_post_id. Displayed nested under parent** |
| **Reactions** | **Tap to add/remove reactions (like, fire, strong)** |
| **Create group** | **Shown if no group exists. Name + add first members** |

*Tables: vip_groups, vip_group_members, vip_group_posts, vip_post_reactions. No leaderboard in first release.*

*IMPLEMENTATION GATE: VIP Group is the heaviest non-core feature in MVP. Two build tracks: MVP-core (ships without VIP Group) and MVP+community (includes it). Gate decision must be made before development starts. This feature can consume significant frontend, storage, moderation, and RLS testing effort.*

## 11. Team

**Purpose: Manage assistants, their roles, assigned regions/timezones, and client assignments.**

| **Element** | **Detail** |
| --- | --- |
| **Staff List** | **Table: name, email, role name, assigned timezones, assigned regions, status (active/disabled), number of assigned clients** |
| **Add Staff** | **Enter email + select role + select timezone(s) + select region(s). System sends Supabase Auth email invite. On acceptance, assistant sets password and staff_assignments row links them to tenant. No custom activation token — Supabase Auth handles invite natively** |
| **Edit Staff** | **Change role assignment, update timezones/regions, disable/enable** |
| **Client Assignments** | **Per assistant: list of assigned clients. Add/remove assignments** |
| **Role Info** | **Display role name + permissions (read-only, from role_permissions). Coach cannot edit role definitions** |
| **Remove Staff** | **Disable access immediately (staff_assignments.status = disabled). Historical actions preserved. Clients reassigned** |

*Tables: staff_assignments, client_staff_assignments, platform_users, roles, role_permissions*

## 12. Client Subscription Tracker

**Purpose: Track client payment status, renewals, and overdue accounts.**

| **Element** | **Detail** |
| --- | --- |
| **Table columns** | **Client name, start date, end date, status (active/expired/overdue), payment confirmed by, notes** |
| **Filters** | **Status: active / expired / overdue. Expiring within 7 days** |
| **Actions** | **Mark as paid (coach + billing role only), Add notes, View client profile** |
| **Alerts** | **Highlight overdue. Show count of expiring-soon subscriptions** |
| **Renewal reminders** | **System sends reminders 7 days before + on end date. Shown in this view** |

*Tables: client_subscriptions, clients, platform_users. Access blocking on expiry enforced at platform level (status change or RLS).*

## 13. Workspace Settings

**Purpose: Configure workspace name, timezone, and flash card / absence detection thresholds.**

| **Element** | **Detail** |
| --- | --- |
| **Workspace name** | **Editable text field** |
| **Timezone** | **Dropdown selector** |
| **Absence thresholds** | **absence_warning_days (default 2), absence_critical_days (default 4)** |
| **Weight stagnation** | **weight_stagnation_days (default 7)** |
| **Escalation toggles** | **escalation_24h, escalation_48h, escalation_72h (on/off)** |
| **Save** | **Updates coaches.settings JSONB** |

*Tables: coaches (workspace_name, timezone, settings)*

## 14. Billing

**Purpose: Manage coach’s own platform subscription via Stripe.**

| **Element** | **Detail** |
| --- | --- |
| **Current plan** | **Plan name, status, current period start/end** |
| **Subscription actions** | **Upgrade (post-MVP), Cancel, Reactivate** |
| **Payment method** | **Managed via Stripe Customer Portal (redirect)** |
| **Trial info** | **If in trial: days remaining, trial expiry date** |
| **Expired state** | **If expired: prominent banner, subscribe button, read-only dashboard below** |

*Tables: coach_subscriptions, coaches.trial_status. Stripe Customer Portal handles payment method changes.*

# CLIENT MOBILE APP

**Technology: React Native (iOS + Android). Clients access their own data only. All writes scoped to auth.uid().**

## 1. Activation

**Purpose: First-time account setup. Shown once before auth.**

| **Step** | **Detail** |
| --- | --- |
| **Enter token** | **Client enters activation code received from coach** |
| **Validate** | **System checks activation_token_hash + expiry. If expired, show error + contact coach** |
| **Set password** | **Client creates password (Supabase Auth)** |
| **Onboarding** | **Optional questionnaire: age, conditions, goals. Updates clients table** |
| **Complete** | **onboarding_completed = true. Navigate to Home** |

*Tables: clients (activation_token_hash, activation_expires_at, onboarding_completed), platform_users*

## 2. Home / Today

**Purpose: Daily logging. Must be completable in under 60 seconds.**

| **Element** | **Detail** |
| --- | --- |
| **Weight input** | **Number field. Optional. Shows previous value for reference** |
| **Steps input** | **Number field. Optional. Manual entry at MVP** |
| **Meal description** | **Free text field. Describe what you ate today** |
| **Meal photo** | **Camera/gallery picker. Optional. Uploaded to Storage as {coach_id}/{client_id}/{filename}** |
| **Questions** | **Free text. Optional. Questions for coach/assistant** |
| **Submit** | **Creates daily_log row. UNIQUE(client_id, log_date) prevents duplicates. If already submitted today, show edit mode** |
| **Renewal banner** | **If client_subscriptions.end_date is within 7 days or expired, show warning banner at top** |
| **Paused banner** | **If status = paused, show info banner and disable submit** |

*Tables: daily_logs, client_subscriptions. One log per day enforced by UNIQUE constraint.*

## 3. Log History / Progress

**Purpose: Client can review their submission history and track trends.**

| **Element** | **Detail** |
| --- | --- |
| **Timeline** | **Scrollable list of past daily logs: date, weight, steps, meal summary, photo thumbnail** |
| **Tap to expand** | **Full detail: meal description, photo full-size, questions asked** |
| **Streak indicator** | **Consecutive days logged. Reinforces habit** |
| **Summary cards** | **Optional: weight trend (last 7/30 days), average steps. Simple calculations, no AI** |
| **Pull to refresh** | **Reload latest data** |

*Tables: daily_logs. Read-only view. Client cannot edit past logs (only today’s log is editable via Home).*

## 4. My Plan

**Purpose: View currently assigned meal and workout plans.**

| **Element** | **Detail** |
| --- | --- |
| **Active meal plan** | **Title + content (rendered from JSONB). Shows assigned date** |
| **Active workout plan** | **Title + content. Shows assigned date** |
| **No plan state** | **If no active assignment, show placeholder: 'No plan assigned yet. Contact your coach.'** |
| **Read-only** | **Client cannot modify plans. View only** |

*Tables: plan_assignments (status = active), plans. Partial unique index enforces one active plan per type.*

## 5. Messages

**Purpose: Chat with coach and/or assigned assistant.**

| **Element** | **Detail** |
| --- | --- |
| **Conversation list** | **Shows conversations with coach and assigned assistant(s). Name + last message + unread badge** |
| **Tap conversation** | **Open chat view: chronological messages, compose at bottom** |
| **Compose** | **Text input + send. sender_id = auth.uid(). recipient restricted to coach or assigned assistant (RLS enforced)** |
| **Mark as read** | **Auto-triggered on open via mark_message_read() RPC** |
| **Push notification** | **Triggered on new incoming message (Expo Push Notifications)** |

*Tables: messages. Client can only send to own coach or assigned assistant (enforced by RLS WITH CHECK).*

## 6. VIP Group

**Purpose: Participate in coach-led VIP community (if member).**

| **Element** | **Detail** |
| --- | --- |
| **Visibility** | **Tab shown only if client is active VIP group member** |
| **Feed** | **Chronological posts: author name, text, image, reactions, replies** |
| **Compose** | **Text + optional image. Only if status = active (not muted/removed)** |
| **Reactions** | **Tap to add/remove (like, fire, strong). One per type per post** |
| **Replies** | **View replies nested under parent post. Reply to any post** |
| **Pinned posts** | **Coach-pinned posts shown at top** |
| **No group state** | **If not a member, tab is hidden** |

*Tables: vip_group_posts, vip_post_reactions, vip_group_members. Membership-scoped RLS ensures client only sees groups they belong to.*

*Subject to VIP Group implementation gate decision (see Coach Web App section 10).*

## 7. Profile

**Purpose: View personal info, subscription status, and coach details.**

| **Element** | **Detail** |
| --- | --- |
| **Personal info** | **Name, email, age, condition notes (read-only at MVP)** |
| **Coach info** | **Coach name (from platform_users via coach_id)** |
| **Subscription status** | **Start date, end date, status. Warning if expiring/expired** |
| **Grace period info** | **If deactivated: show remaining grace days + export option. Grace period = client_subscriptions.end_date + 7 days (derived, not stored as a field)** |
| **App version** | **Display current version** |
| **Logout** | **Sign out of Supabase Auth** |

*Tables: clients, platform_users, client_subscriptions.*

*IMPLEMENTATION NOTE: Grace period, export availability, and frozen access are derived from client_subscriptions.end_date via application/service logic. No dedicated schema fields (grace_period_end, frozen_at, export_status) exist. The 7-day window is computed at runtime.*

# ADMIN PANEL

**Technology: Next.js (separate routes or standalone app). Super Admin role only. Read-only access to coach data by default. No access to messages, daily logs, or flash cards.**

## 1. Dashboard

**Purpose: Platform-level KPIs and health indicators.**

| **Metric** | **Source** |
| --- | --- |
| **Total coaches** | **COUNT(coaches)** |
| **Active trials** | **coaches WHERE trial_status = trial_active** |
| **Paid subscriptions** | **coach_subscriptions WHERE status = active** |
| **Expired/churned** | **coaches WHERE trial_status = trial_expired AND no active subscription** |
| **Total clients (platform-wide)** | **COUNT(clients) — anonymized aggregate only** |
| **Revenue (if tracked)** | **Stripe Dashboard or aggregate from coach_subscriptions** |

*Tables: coaches, coach_subscriptions. Client-level data is aggregated/anonymized only. Super Admin does not access individual client records.*

## 2. Coach List

| **Element** | **Detail** |
| --- | --- |
| **Table columns** | **Name, email, workspace name, trial status, subscription status, client count, created date** |
| **Filters** | **Trial status, subscription status, date range** |
| **Search** | **By name or email** |
| **Actions** | **View detail, Suspend (sets status = suspended, temporary), Ban (sets status = banned, permanent), Restore (sets status = active)** |

*Tables: coaches, platform_users, coach_subscriptions*

## 3. Coach Detail

**Purpose: View coach workspace metadata. Read-only by default.**

| **Element** | **Detail** |
| --- | --- |
| **Coach info** | **Name, email, workspace name, timezone, trial status, created date** |
| **Subscription** | **Plan name, status, current period, cancelled date** |
| **Client count** | **Number of active/pending/deactivated clients (counts only, no individual data)** |
| **Staff count** | **Number of active assistants** |
| **Settings preview** | **Flash card thresholds (read-only)** |
| **Actions** | **Suspend (status = suspended, temporary block, can restore), Ban (status = banned, permanent block, requires Super Admin to reverse), Restore (status = active). All actions logged to audit_logs** |

*Tables: coaches, platform_users, coach_subscriptions. No access to client-level data, messages, or flash cards from this view.*

## 4. Role Management

**Purpose: View and (post-MVP) manage global role definitions and permissions.**

| **Element** | **Detail** |
| --- | --- |
| **Role list** | **Table: name, description, locked status, number of assignees** |
| **Permissions view** | **Per role: list of permissions with granted status** |
| **MVP behavior** | **Roles are seeded and locked. Display only. No edit UI at MVP** |
| **Post-MVP** | **Checkbox-based permission editor. Add/remove permissions. Create new roles** |
| **Locked indicator** | **Locked roles show lock icon. Cannot be edited (trigger enforced)** |

*Tables: roles, role_permissions. At MVP: read-only display of seeded roles.*

## 5. Audit Log

**Purpose: Platform-wide activity trail for compliance and operations.**

| **Element** | **Detail** |
| --- | --- |
| **Log list** | **Table: timestamp, actor name, action, target type, target ID** |
| **Filters** | **Action type, date range, actor, target type. Optional: coach_id filter** |
| **Detail view** | **Expand row: metadata (sanitized — no raw PII). Before/after field names** |
| **Export** | **CSV export for compliance reporting (post-MVP)** |

*Tables: audit_logs. Metadata never contains raw PII. Immutable — no edit/delete.*

## 6. Support Access Requests

**Purpose: Controlled, audited support access to coach workspaces.**

| **Element** | **Detail** |
| --- | --- |
| **Default access** | **Read-only. Super Admin can view coach metadata but not operational data** |
| **Request elevated access** | **Super Admin enters reason + target coach. Request logged to audit_logs** |
| **Coach approval** | **Coach receives notification and approves/denies (post-MVP: in-app. MVP: manual confirmation)** |
| **Time-bounded session** | **Elevated access expires after defined window (e.g., 1 hour)** |
| **Audit trail** | **Every support access action logged: who, when, what was accessed, duration** |
| **Revocation** | **Coach or admin can revoke access early** |

*Tables: audit_logs, coaches, platform_users. Primary support mechanism remains logs + DB inspection. Elevated access is exception-only.*

# CROSS-CUTTING CONCERNS

## Loading States

**Every screen must handle: loading (skeleton/spinner), empty state (no data yet), error state (API failure or RLS denial). Flash cards show computed_at timestamp so coach knows freshness.**

## Expired/Frozen Access

**Coach trial expired + no subscription: read-only dashboard, billing banner on every page, cannot add/edit clients or send assignments. Client subscription expired: renewal banner on Home, access blocked after 7-day grace period. Grace period is computed from client_subscriptions.end_date + 7 days (application logic, not persisted state).**

## Push Notifications (Client App)

**Triggers: new message from coach/assistant, absence reminder (system), subscription renewal reminder. Technology: Expo Push Notifications wrapping FCM (Android) and APNs (iOS).**

## File Uploads

**Meal photos and VIP group images: client uploads via signed upload URL (server-side issuance). Path: {coach_id}/{client_id}/{filename}. Private bucket only. Max file size (e.g., 5MB) and accepted types (JPEG, PNG) enforced at the upload flow (server-side validation before signed URL issuance) and Supabase Storage bucket configuration — not via RLS policies. RLS enforces tenant-scoped path access only.**

## Responsive Design (Coach Web)

**Coach web app is responsive for tablet/mobile access but optimized for desktop. Not a replacement for a native coach app. Coaches checking dashboard on phone should get a usable (not degraded) experience.**

