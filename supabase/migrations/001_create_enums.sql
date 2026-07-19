-- ============================================================
-- Migration: 001_create_enums
-- Purpose:   Define all custom enum types used across the schema.
--            Must run before any table migration.
-- Order:     1 of 12 (Tier 0)
-- Source:    Schema Doc Status Enums Reference + Task Prompt Guide
-- ============================================================

-- ── user_status ────────────────────────────────────────────
-- Lifecycle status for any user account (coach or client).
CREATE TYPE public.user_status AS ENUM (
  'pending',
  'active',
  'paused',
  'suspended',
  'banned',
  'deactivated'
);

-- ── role_type ──────────────────────────────────────────────
-- Role assigned to a user. Determines RLS policy path.
CREATE TYPE public.role_type AS ENUM (
  'super_admin',
  'coach',
  'assistant',
  'client'
);

-- ── trial_status ───────────────────────────────────────────
-- Trial and paid conversion state for a coach workspace.
CREATE TYPE public.trial_status AS ENUM (
  'trial_not_started',
  'trial_active',
  'trial_expired',
  'paid_active',
  'paid_skipped_trial'
);

-- ── coach_subscription_status ──────────────────────────────
-- Subscription billing status for a coach workspace.
CREATE TYPE public.coach_subscription_status AS ENUM (
  'active',
  'past_due',
  'cancelled',
  'expired'
);

-- ── client_subscription_status ─────────────────────────────
-- Subscription status for a client's access within a workspace.
CREATE TYPE public.client_subscription_status AS ENUM (
  'active',
  'expired',
  'overdue'
);

-- ── staff_status ───────────────────────────────────────────
-- Status for assistant/staff team members within a workspace.
CREATE TYPE public.staff_status AS ENUM (
  'active',
  'disabled'
);

-- ── flash_status ───────────────────────────────────────────
-- Computed flash card color stored on the flash_cards table.
-- Computation rules are defined in FLASH_CARD_RULES.md.
CREATE TYPE public.flash_status AS ENUM (
  'green',
  'yellow',
  'red'
);

-- ── plan_type_enum ─────────────────────────────────────────
-- Category of a coaching plan.
CREATE TYPE public.plan_type_enum AS ENUM (
  'meal',
  'workout'
);

-- ── plan_status ────────────────────────────────────────────
-- Lifecycle status of a coaching plan.
CREATE TYPE public.plan_status AS ENUM (
  'active',
  'archived'
);

-- ── plan_assign_status ─────────────────────────────────────
-- Status of a plan assignment to a specific client.
CREATE TYPE public.plan_assign_status AS ENUM (
  'active',
  'completed',
  'replaced'
);

-- ── absence_level ──────────────────────────────────────────
-- Escalation level of a client absence (missed check-ins).
CREATE TYPE public.absence_level AS ENUM (
  '24h',
  '48h',
  '72h'
);

-- ── absence_action ─────────────────────────────────────────
-- Action state taken in response to a detected absence.
CREATE TYPE public.absence_action AS ENUM (
  'pending',
  'message_sent',
  'escalated_to_coach',
  'resolved'
);
