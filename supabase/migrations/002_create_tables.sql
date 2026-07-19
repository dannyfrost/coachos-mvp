-- ============================================================
-- Migration: 002_create_tables
-- Purpose:   Create all 16 MVP-core tables.
--            Depends on: 001_create_enums
-- Order:     2 of 12 (Tier 0)
-- Source:    MVP_Database_Schema_Final + MVP_Task_Prompt_Guide T0-02
-- Notes:
--   - Tables are ordered by FK dependency (no forward references).
--   - No composite FK constraints (see 003_composite_constraints).
--   - No indexes (see 004_indexes).
--   - No triggers (see 005_triggers).
--   - No RLS policies (see 007_rls_enable + 008_rls_policies).
--   - Direct UPDATE on messages and flash_cards will be revoked
--     for the authenticated role in 010_revoke_grants.
--   - VIP tables excluded: VIP is OUT of MVP-core (DECISIONS.md P-01).
--   - coaches.id and clients.id share the same UUID as the
--     corresponding platform_users.id row (1:1 pattern).
--   - coach_id is the tenant identifier throughout the schema.
-- ============================================================


-- ── 1. platform_users ──────────────────────────────────────
-- Core identity record, linked 1:1 to Supabase Auth (auth.users).
-- Created for every user regardless of role. role_type drives
-- RLS policy branching across all tables.
CREATE TABLE public.platform_users (
  id             uuid               PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text               NOT NULL UNIQUE,
  full_name      text               NOT NULL,
  role_type      public.role_type   NOT NULL,
  status         public.user_status NOT NULL DEFAULT 'pending',
  email_verified boolean            NOT NULL DEFAULT false,
  created_at     timestamptz        NOT NULL DEFAULT now(),
  updated_at     timestamptz        NOT NULL DEFAULT now()
);


-- ── 2. roles ───────────────────────────────────────────────
-- Named permission roles. Seeded in 012_seed_data.
-- The name column is unique; locked rows must not be deleted.
CREATE TABLE public.roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  is_default  boolean     NOT NULL DEFAULT false,
  locked      boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ── 3. role_permissions ────────────────────────────────────
-- Permission strings granted to each named role.
-- granted = false records an explicit denial (for future use).
-- Seeded in 012_seed_data. See ROLE_SEED_MATRIX.md.
CREATE TABLE public.role_permissions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    uuid        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission text        NOT NULL,
  granted    boolean     NOT NULL DEFAULT true,
  UNIQUE (role_id, permission)
);


-- ── 4. coaches ─────────────────────────────────────────────
-- One row per coach. coach.id == platform_users.id (same UUID).
-- The coach entity represents the workspace/tenant.
-- All tables reference coach_id as the tenant FK.
CREATE TABLE public.coaches (
  id                 uuid                NOT NULL PRIMARY KEY REFERENCES public.platform_users(id) ON DELETE CASCADE,
  workspace_name     text                NOT NULL,
  timezone           text                NOT NULL,
  trial_status       public.trial_status NOT NULL DEFAULT 'trial_not_started',
  trial_started_at   timestamptz,
  trial_expires_at   timestamptz,
  stripe_customer_id text,
  settings           jsonb,
  created_at         timestamptz         NOT NULL DEFAULT now(),
  updated_at         timestamptz         NOT NULL DEFAULT now()
);


-- ── 5. coach_subscriptions ─────────────────────────────────
-- Stripe billing subscription record for a coach workspace.
-- Stripe columns are nullable; row can exist before Stripe is
-- wired up (Stripe is a parallel track from Tier 1B).
CREATE TABLE public.coach_subscriptions (
  id                     uuid                             PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id               uuid                             NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  plan_name              text,
  status                 public.coach_subscription_status NOT NULL DEFAULT 'active',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz                      NOT NULL DEFAULT now()
);


-- ── 6. clients ─────────────────────────────────────────────
-- One row per client. client.id == platform_users.id (same UUID).
-- activation_token_hash stores the hashed invite token; cleared
-- after activation. onboarding_completed gates the first daily log.
CREATE TABLE public.clients (
  id                    uuid        PRIMARY KEY REFERENCES public.platform_users(id) ON DELETE CASCADE,
  coach_id              uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  activation_token_hash text        UNIQUE,
  activation_expires_at timestamptz,
  onboarding_completed  boolean     NOT NULL DEFAULT false,
  age                   integer,
  condition_notes       text,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ── 7. client_subscriptions ────────────────────────────────
-- Access subscription for a client within a coach workspace.
-- start_date / end_date are calendar dates, not timestamps.
-- payment_confirmed_by records which platform user confirmed payment.
CREATE TABLE public.client_subscriptions (
  id                   uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid                              NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id             uuid                              NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  start_date           date                              NOT NULL,
  end_date             date                              NOT NULL,
  status               public.client_subscription_status NOT NULL DEFAULT 'active',
  payment_confirmed_by uuid                              REFERENCES public.platform_users(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz                       NOT NULL DEFAULT now(),
  updated_at           timestamptz                       NOT NULL DEFAULT now()
);


-- ── 8. staff_assignments ───────────────────────────────────
-- Assistant/staff members assigned to a coach workspace.
-- role_id references the named role row (e.g. senior_assistant).
-- assigned_timezones and assigned_regions scope the staff
-- member's coverage area within the workspace.
CREATE TABLE public.staff_assignments (
  id                 uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id           uuid               NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id            uuid               NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  role_id            uuid               NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  assigned_timezones text[],
  assigned_regions   text[],
  status             public.staff_status NOT NULL DEFAULT 'active',
  created_at         timestamptz        NOT NULL DEFAULT now(),
  updated_at         timestamptz        NOT NULL DEFAULT now()
);


-- ── 9. client_staff_assignments ────────────────────────────
-- Maps staff members to specific clients within a workspace.
-- staff_id references platform_users, not staff_assignments.
-- An assistant's RLS read scope is determined by rows in this
-- table where staff_id matches the authenticated user's id.
CREATE TABLE public.client_staff_assignments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_id   uuid        NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, staff_id)
);


-- ── 10. daily_logs ─────────────────────────────────────────
-- Client daily check-in. One log per client per day (enforced
-- by a composite unique constraint in 003_composite_constraints).
-- meal_photo_key is the Supabase Storage object key; signed URLs
-- are generated at read time. Storage paths are tenant-scoped
-- (/{coach_id}/...) per DECISIONS.md S-05.
CREATE TABLE public.daily_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id         uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  log_date         date        NOT NULL,
  weight           numeric,
  steps            integer,
  meal_description text,
  meal_photo_key   text,
  questions        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, log_date)
);


-- ── 11. flash_cards ────────────────────────────────────────
-- Computed coaching status card per client. Written only by
-- the compute_flash_card_status RPC or cron job. Direct UPDATE
-- is revoked for the authenticated role in 010_revoke_grants
-- (DECISIONS.md S-03). Computation rules are in FLASH_CARD_RULES.md.
CREATE TABLE public.flash_cards (
  id             uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid                NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id       uuid                NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  status         public.flash_status NOT NULL DEFAULT 'green',
  reason         text,
  food_summary   text,
  interpretation text,
  notes          text,
  last_log_at    timestamptz,
  computed_at    timestamptz         NOT NULL DEFAULT now()
);


-- ── 12. plans ──────────────────────────────────────────────
-- A coaching plan (meal or workout) authored by a coach.
-- is_template = true marks a plan as reusable across clients.
-- content stores the plan body as structured JSON.
CREATE TABLE public.plans (
  id          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid                  NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  title       text                  NOT NULL,
  type        public.plan_type_enum NOT NULL,
  status      public.plan_status    NOT NULL DEFAULT 'active',
  content     jsonb,
  is_template boolean               NOT NULL DEFAULT false,
  created_at  timestamptz           NOT NULL DEFAULT now(),
  updated_at  timestamptz           NOT NULL DEFAULT now()
);


-- ── 13. plan_assignments ───────────────────────────────────
-- Assignment of a plan to a specific client.
-- plan_type (text) denormalises the plan type for query
-- convenience; assigned_by records the staff or coach who
-- made the assignment.
CREATE TABLE public.plan_assignments (
  id          uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid                     NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  client_id   uuid                     NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id     uuid                     NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  plan_type   text                     NOT NULL,
  status      public.plan_assign_status NOT NULL DEFAULT 'active',
  assigned_at timestamptz              NOT NULL DEFAULT now(),
  assigned_by uuid                     REFERENCES public.platform_users(id) ON DELETE SET NULL
);


-- ── 14. messages ───────────────────────────────────────────
-- In-app messages between any two platform users within a
-- coach workspace (Tier 3). sender_id / recipient_id use the
-- platform_users FK. Direct UPDATE is revoked for the
-- authenticated role in 010_revoke_grants (DECISIONS.md S-03).
CREATE TABLE public.messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  sender_id    uuid        NOT NULL REFERENCES public.platform_users(id) ON DELETE RESTRICT,
  recipient_id uuid        NOT NULL REFERENCES public.platform_users(id) ON DELETE RESTRICT,
  content      text        NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ── 15. absence_events ─────────────────────────────────────
-- Detected client absence and the escalation workflow state.
-- trigger_date is the calendar date the absence was detected.
-- action_taken tracks the response state; handled_by records
-- which staff or coach took action.
CREATE TABLE public.absence_events (
  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid                  NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id     uuid                  NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  trigger_date date                  NOT NULL,
  level        public.absence_level  NOT NULL,
  action_taken public.absence_action NOT NULL DEFAULT 'pending',
  handled_by   uuid                  REFERENCES public.platform_users(id) ON DELETE SET NULL,
  created_at   timestamptz           NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);


-- ── 16. audit_logs ─────────────────────────────────────────
-- Append-only platform audit trail. actor_id is nullable to
-- allow system/cron-generated events. coach_id scopes the
-- event to a tenant where applicable. metadata stores a JSON
-- snapshot of the affected row or action context.
CREATE TABLE public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES public.platform_users(id) ON DELETE SET NULL,
  coach_id    uuid        REFERENCES public.coaches(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
