-- ============================================================
-- Migration: 003_composite_constraints
-- Purpose:   Add tenant-integrity composite constraints.
--            Depends on: 002_create_tables
-- Order:     3 of 12 (Tier 0)
--
-- Pattern:
--   Parent tables that are tenant-scoped get UNIQUE(id, coach_id).
--   Child tables get a composite FK (parent_id, coach_id) →
--   parent(id, coach_id). This guarantees that a child row's
--   coach_id always matches its parent row's coach_id, so it is
--   physically impossible for tenant A to attach a child to a
--   parent owned by tenant B.
--
-- Notes:
--   - VIP tables excluded (DECISIONS.md P-01).
--   - Simple single-column FKs in 002 are kept; composite FKs
--     ADD an additional integrity check on top of them.
--   - Composite FKs that reference tenant-scoped parents use
--     ON DELETE NO ACTION (Postgres default — clause omitted).
--     CASCADE on these would violate Design Rule 4 (soft deletes
--     everywhere) and the GDPR Article 17 Erasure Matrix.
--     Erasure goes through the documented runbook, not through
--     automatic cascade.
--   - plan_assignments → plans uses ON DELETE RESTRICT to block
--     deleting a plan that still has assignments.
--   - No indexes here (see 004_indexes).
--   - No triggers here (see 005_triggers).
-- ============================================================


-- ── Parent: clients ────────────────────────────────────────
-- Allows composite FKs from any tenant-scoped child of clients.
ALTER TABLE public.clients
  ADD CONSTRAINT clients_id_coach_id_key UNIQUE (id, coach_id);


-- ── Parent: plans ──────────────────────────────────────────
-- Allows composite FK from plan_assignments.
ALTER TABLE public.plans
  ADD CONSTRAINT plans_id_coach_id_key UNIQUE (id, coach_id);


-- ── Child: client_subscriptions → clients ──────────────────
ALTER TABLE public.client_subscriptions
  ADD CONSTRAINT client_subscriptions_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Child: client_staff_assignments → clients ──────────────
ALTER TABLE public.client_staff_assignments
  ADD CONSTRAINT client_staff_assignments_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Child: daily_logs → clients ────────────────────────────
ALTER TABLE public.daily_logs
  ADD CONSTRAINT daily_logs_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Child: flash_cards → clients ───────────────────────────
ALTER TABLE public.flash_cards
  ADD CONSTRAINT flash_cards_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Child: plan_assignments → clients ──────────────────────
ALTER TABLE public.plan_assignments
  ADD CONSTRAINT plan_assignments_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Child: plan_assignments → plans ────────────────────────
ALTER TABLE public.plan_assignments
  ADD CONSTRAINT plan_assignments_plan_coach_fkey
    FOREIGN KEY (plan_id, coach_id)
    REFERENCES public.plans (id, coach_id)
    ON DELETE RESTRICT;


-- ── Child: absence_events → clients ────────────────────────
ALTER TABLE public.absence_events
  ADD CONSTRAINT absence_events_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── CHECK: client_subscriptions date range ─────────────────
-- end_date must be on or after start_date. Both columns are
-- NOT NULL per 002_create_tables.sql.
ALTER TABLE public.client_subscriptions
  ADD CONSTRAINT client_subscriptions_end_after_start_chk
    CHECK (end_date >= start_date);