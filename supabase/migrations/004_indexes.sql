-- ============================================================
-- Migration: 004_indexes
-- Purpose:   MVP-core indexes for tenant lookups, dashboard
--            performance, messaging, daily-log history, flash
--            card filtering, absence event timeline, plan
--            assignment integrity, and RLS prerequisites.
--            Depends on: 002_create_tables, 003_composite_constraints
-- Order:     4 of 12 (Tier 0)
--
-- Notes:
--   - VIP tables excluded (DECISIONS.md P-01).
--   - Index names follow DECISIONS.md N-07 (Postgres-default
--     style): <table>_<columns>_idx for non-unique,
--     <table>_<columns>_key for unique, plus one descriptive
--     name (staff_one_active_per_user) prescribed by the RLS doc.
--   - Indexes already provided by UNIQUE constraints in 002/003
--     are NOT re-created here, namely:
--       - flash_cards.client_id (UNIQUE in 002)
--       - daily_logs (client_id, log_date) (UNIQUE in 002)
--       - client_staff_assignments (client_id, staff_id) (UNIQUE in 002)
--       - clients (id, coach_id) and plans (id, coach_id) (UNIQUE in 003)
--   - Partial indexes (#6, #8, #9) MUST keep their WHERE clauses;
--     dropping the WHERE clause silently changes semantics.
-- ============================================================


-- 1. clients by tenant.
--    Supports the most common access pattern: list/lookup all
--    clients in a coach's workspace.
CREATE INDEX clients_coach_id_idx
  ON public.clients (coach_id);


-- 2. daily_logs dashboard / history lookup.
--    Supports per-client daily-log timelines on the coach
--    dashboard. log_date DESC sorts most-recent-first.
CREATE INDEX daily_logs_coach_client_log_date_idx
  ON public.daily_logs (coach_id, client_id, log_date DESC);


-- 3. flash_cards dashboard filtering.
--    Supports the "show all yellow/red flash cards in my
--    workspace" coach dashboard filter.
CREATE INDEX flash_cards_coach_status_idx
  ON public.flash_cards (coach_id, status);


-- 4. messages recipient inbox.
--    Supports loading the inbox for a specific recipient,
--    newest first.
CREATE INDEX messages_coach_recipient_created_at_idx
  ON public.messages (coach_id, recipient_id, created_at DESC);


-- 5. messages tenant-wide chronological.
--    Supports admin / coach-wide chronological message views.
CREATE INDEX messages_coach_created_at_idx
  ON public.messages (coach_id, created_at DESC);


-- 6. messages unread inbox (PARTIAL).
--    The WHERE clause is mandatory; without it this index would
--    be a duplicate of #4. Supports the "unread messages"
--    notification badge.
CREATE INDEX messages_unread_idx
  ON public.messages (coach_id, recipient_id, created_at DESC)
  WHERE read_at IS NULL;


-- 7. absence_events tenant timeline.
--    Supports the chronological absence-event feed on the coach
--    dashboard.
CREATE INDEX absence_events_coach_created_at_idx
  ON public.absence_events (coach_id, created_at DESC);


-- 8. plan_assignments — one active plan per type per client
--    (PARTIAL UNIQUE).
--    Enforces the product invariant that a client may have at
--    most one ACTIVE assignment per plan_type at a time.
--    Completed/replaced rows are not constrained.
CREATE UNIQUE INDEX plan_assignments_one_active_per_type_key
  ON public.plan_assignments (client_id, plan_type)
  WHERE status = 'active';


-- 9. staff_assignments — one active assignment per user
--    (PARTIAL UNIQUE).
--    RLS prerequisite: makes private.get_my_coach_id()
--    deterministic by guaranteeing at most one ACTIVE row per
--    user_id. Disabled rows are not constrained.
CREATE UNIQUE INDEX staff_one_active_per_user
  ON public.staff_assignments (user_id)
  WHERE status = 'active';
