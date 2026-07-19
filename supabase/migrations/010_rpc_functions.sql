-- ============================================================
-- Migration: 010_rpc_functions
-- Purpose:   All 23 public-schema RPC functions.
--            Depends on: 001–009
-- Order:     10 of 13 (Tier 0)
--
-- Functions (23):
--   Client Invitations (3)
--     create_client_invite(uuid, text, text)      → text
--     regenerate_invite_token(uuid)               → text
--     revoke_invite(uuid)                         → void
--   Daily Logging (1)
--     update_today_log(numeric,int,text,text,text)→ SETOF daily_logs
--   Flash Cards (2)
--     update_flash_card_notes(uuid, text)         → SETOF flash_cards
--     refresh_flash_card(uuid)                    → SETOF flash_cards
--   Client Status (3)
--     pause_client(uuid)                          → void
--     unpause_client(uuid)                        → void
--     deactivate_client(uuid)                     → void
--   Plan Management (2)
--     assign_plan(uuid, uuid)                     → SETOF plan_assignments
--     replace_active_plan(uuid, text, uuid)       → SETOF plan_assignments
--   Absence Management (2)
--     mark_absence_handled(uuid, absence_action)  → void
--     resolve_absence(uuid)                       → void
--   Payment Tracking (1)
--     confirm_client_payment(uuid, text)          → void
--   Staff Management (4)
--     assign_staff_to_client(uuid, uuid)          → void
--     remove_staff_from_client(uuid, uuid)        → void
--     update_staff_status(uuid, staff_status)     → void
--     reassign_staff_clients(uuid, uuid)          → void
--   Messaging (4)
--     send_message(uuid, text)                    → SETOF messages
--     list_conversations()                        → TABLE(...)
--     get_conversation(uuid, timestamptz)         → SETOF messages
--     mark_message_read(uuid)                     → void
--   Client Profile (1)
--     get_client_profile_summary()                → TABLE(...)
--
-- Security notes:
--   - All functions: SECURITY DEFINER + SET search_path = ''
--   - All object references fully schema-qualified
--   - All write RPCs validate caller tenant before writing
--   - S-03: update_flash_card_notes + refresh_flash_card write
--           flash_cards as SECURITY DEFINER; revoke in 011
--   - S-07: send_message inserts into messages as SECURITY
--           DEFINER; revoke in 011
--   - S-08: pause/unpause/deactivate write platform_users as
--           SECURITY DEFINER; revoke in 011
--   - Auth user creation is Layer 3 only. create_client_invite
--           accepts p_user_id (pre-created by Layer 3 route)
--   - Token TTL: 7 days
-- ============================================================


-- ============================================================
-- 1. CLIENT INVITATIONS
-- ============================================================

-- ── create_client_invite ───────────────────────────────────
-- Creates platform_users + clients rows for a new pending client.
-- p_user_id is the auth.users UUID created by the Layer 3 route
-- (/api/clients/invite) before calling this RPC.
-- Returns the raw activation token (coach delivers to client).
CREATE OR REPLACE FUNCTION public.create_client_invite(
  p_user_id   uuid,
  p_email     text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id  uuid;
  v_raw_token text;
  v_token_hash text;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_coach_id := auth.uid();

  -- Generate a 64-char hex token and its SHA-256 hash
  v_raw_token  := replace(pg_catalog.gen_random_uuid()::text, '-', '')
               || replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

  INSERT INTO public.platform_users (id, email, full_name, role_type, status, created_at, updated_at)
  VALUES (p_user_id, p_email, p_full_name, 'client', 'pending', now(), now());

  INSERT INTO public.clients (id, coach_id, activation_token_hash, activation_expires_at, created_at)
  VALUES (p_user_id, v_coach_id, v_token_hash, now() + INTERVAL '7 days', now());

  RETURN v_raw_token;
END;
$$;


-- ── regenerate_invite_token ────────────────────────────────
-- Resets the activation token and expiry for a pending client.
-- Returns the new raw token.
CREATE OR REPLACE FUNCTION public.regenerate_invite_token(
  p_client_id uuid
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_token  text;
  v_token_hash text;
  v_status     public.user_status;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  -- Validate client is in caller's tenant and still pending
  SELECT pu.status
    INTO v_status
    FROM public.clients cl
    JOIN public.platform_users pu ON pu.id = cl.id
   WHERE cl.id = p_client_id
     AND cl.coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'client is not pending; token cannot be regenerated';
  END IF;

  v_raw_token  := replace(pg_catalog.gen_random_uuid()::text, '-', '')
               || replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

  UPDATE public.clients
     SET activation_token_hash = v_token_hash,
         activation_expires_at = now() + INTERVAL '7 days'
   WHERE id = p_client_id;

  RETURN v_raw_token;
END;
$$;


-- ── revoke_invite ──────────────────────────────────────────
-- Clears the activation token for a pending client.
CREATE OR REPLACE FUNCTION public.revoke_invite(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  UPDATE public.clients
     SET activation_token_hash = NULL,
         activation_expires_at = NULL
   WHERE id       = p_client_id
     AND coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;
END;
$$;


-- ============================================================
-- 2. DAILY LOGGING
-- ============================================================

-- ── update_today_log ───────────────────────────────────────
-- Upserts today's daily log for the authenticated client.
-- Blocks if client is not active or has an expired subscription.
CREATE OR REPLACE FUNCTION public.update_today_log(
  p_weight           numeric  DEFAULT NULL,
  p_steps            integer  DEFAULT NULL,
  p_meal_description text     DEFAULT NULL,
  p_meal_photo_key   text     DEFAULT NULL,
  p_questions        text     DEFAULT NULL
)
RETURNS SETOF public.daily_logs
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id   uuid;
  v_status     public.user_status;
  v_sub_status public.client_subscription_status;
  v_sub_end    date;
  v_log_id     uuid;
BEGIN
  IF private.get_my_role() != 'client' THEN
    RAISE EXCEPTION 'permission denied: client only';
  END IF;

  SELECT pu.status
    INTO v_status
    FROM public.platform_users pu
   WHERE pu.id = auth.uid();

  IF v_status NOT IN ('active') THEN
    RAISE EXCEPTION 'client account is not active (status: %)', v_status;
  END IF;

  -- Check subscription: if a row exists, latest must be active and not expired
  SELECT cs.status, cs.end_date
    INTO v_sub_status, v_sub_end
    FROM public.client_subscriptions cs
   WHERE cs.client_id = auth.uid()
   ORDER BY cs.created_at DESC
   LIMIT 1;

  IF FOUND AND (v_sub_status = 'expired' OR v_sub_end < CURRENT_DATE) THEN
    RAISE EXCEPTION 'client subscription is expired';
  END IF;

  v_coach_id := private.get_my_coach_id();

  INSERT INTO public.daily_logs
    (client_id, coach_id, log_date, weight, steps, meal_description, meal_photo_key, questions, created_at)
  VALUES
    (auth.uid(), v_coach_id, CURRENT_DATE, p_weight, p_steps, p_meal_description, p_meal_photo_key, p_questions, now())
  ON CONFLICT (client_id, log_date) DO UPDATE SET
    weight           = EXCLUDED.weight,
    steps            = EXCLUDED.steps,
    meal_description = EXCLUDED.meal_description,
    meal_photo_key   = COALESCE(EXCLUDED.meal_photo_key, public.daily_logs.meal_photo_key),
    questions        = EXCLUDED.questions;

  RETURN QUERY
  SELECT dl.*
    FROM public.daily_logs dl
   WHERE dl.client_id = auth.uid()
     AND dl.log_date  = CURRENT_DATE;
END;
$$;


-- ============================================================
-- 3. FLASH CARDS
-- ============================================================

-- ── update_flash_card_notes ────────────────────────────────
-- Column-safe update of the coach-private notes field only.
-- Direct UPDATE on flash_cards is revoked for authenticated in 011 (S-03).
CREATE OR REPLACE FUNCTION public.update_flash_card_notes(
  p_card_id uuid,
  p_notes   text
)
RETURNS SETOF public.flash_cards
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_client_id uuid;
  v_coach_id  uuid;
BEGIN
  v_role := private.get_my_role();

  IF v_role NOT IN ('coach', 'assistant') THEN
    RAISE EXCEPTION 'permission denied: coach or assistant only';
  END IF;

  SELECT fc.client_id, fc.coach_id
    INTO v_client_id, v_coach_id
    FROM public.flash_cards fc
   WHERE fc.id = p_card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'flash card not found';
  END IF;

  IF v_role = 'coach' THEN
    IF v_coach_id != private.get_my_coach_id() THEN
      RAISE EXCEPTION 'permission denied: not your workspace';
    END IF;
  ELSE
    -- assistant: must be assigned to this client
    IF NOT private.is_my_assigned_client(v_client_id) THEN
      RAISE EXCEPTION 'permission denied: client not assigned to you';
    END IF;
  END IF;

  UPDATE public.flash_cards
     SET notes = p_notes
   WHERE id = p_card_id;

  RETURN QUERY SELECT fc.* FROM public.flash_cards fc WHERE fc.id = p_card_id;
END;
$$;


-- ── refresh_flash_card ─────────────────────────────────────
-- Recomputes one client's flash card from daily_logs + coaches.settings.
-- Thresholds are read from coaches.settings JSONB at runtime (Design Rule 7).
-- Fallbacks: absence_warning_days=2, absence_critical_days=4,
--            weight_stagnation_days=7.
-- Direct UPDATE on flash_cards is revoked for authenticated in 011 (S-03).
CREATE OR REPLACE FUNCTION public.refresh_flash_card(
  p_client_id uuid
)
RETURNS SETOF public.flash_cards
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_my_coach_id      uuid;
  v_client_coach_id  uuid;
  v_client_status    public.user_status;
  v_warn_days        integer;
  v_critical_days    integer;
  v_stagnation_days  integer;
  v_last_log_date    date;
  v_last_log_at      timestamptz;
  v_days_absent      integer;
  v_food_summary     text;
  v_weight_stagnant  boolean;
  v_status           public.flash_status;
  v_reason           text;
  v_interpretation   text;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_my_coach_id := auth.uid();

  -- Validate client belongs to caller's workspace
  SELECT cl.coach_id, pu.status
    INTO v_client_coach_id, v_client_status
    FROM public.clients cl
    JOIN public.platform_users pu ON pu.id = cl.id
   WHERE cl.id = p_client_id;

  IF NOT FOUND OR v_client_coach_id != v_my_coach_id THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;

  -- Read thresholds from coaches.settings with fallback defaults
  SELECT
    COALESCE((c.settings->>'absence_warning_days')::integer,  2),
    COALESCE((c.settings->>'absence_critical_days')::integer, 4),
    COALESCE((c.settings->>'weight_stagnation_days')::integer, 7)
    INTO v_warn_days, v_critical_days, v_stagnation_days
    FROM public.coaches c
   WHERE c.id = v_my_coach_id;

  -- Last log date and timestamp
  SELECT dl.log_date, dl.created_at
    INTO v_last_log_date, v_last_log_at
    FROM public.daily_logs dl
   WHERE dl.client_id = p_client_id
   ORDER BY dl.log_date DESC
   LIMIT 1;

  -- Food summary: last 3 non-null meal descriptions
  SELECT string_agg(sub.meal_description, ' | ' ORDER BY sub.log_date DESC)
    INTO v_food_summary
    FROM (
      SELECT dl.meal_description, dl.log_date
        FROM public.daily_logs dl
       WHERE dl.client_id         = p_client_id
         AND dl.meal_description IS NOT NULL
       ORDER BY dl.log_date DESC
       LIMIT 3
    ) sub;

  -- Determine status
  IF v_client_status = 'paused' THEN
    v_status         := 'yellow';
    v_reason         := 'client paused';
    v_interpretation := NULL;

  ELSIF v_last_log_date IS NULL THEN
    v_status         := 'red';
    v_reason         := 'no check-ins recorded';
    v_interpretation := 'no data available';

  ELSE
    v_days_absent := CURRENT_DATE - v_last_log_date;

    IF v_days_absent > v_critical_days THEN
      v_status         := 'red';
      v_reason         := 'no check-in for ' || v_days_absent || ' days';
      v_interpretation := 'extended absence detected';

    ELSIF v_days_absent > v_warn_days THEN
      v_status         := 'yellow';
      v_reason         := 'missed check-in for ' || v_days_absent || ' days';
      v_interpretation := 'absence warning threshold reached';

    ELSE
      -- Check weight stagnation over the threshold window
      SELECT (COUNT(DISTINCT dl.weight) = 1 AND COUNT(dl.weight) >= v_stagnation_days)
        INTO v_weight_stagnant
        FROM public.daily_logs dl
       WHERE dl.client_id = p_client_id
         AND dl.log_date  >= CURRENT_DATE - v_stagnation_days
         AND dl.weight    IS NOT NULL;

      IF v_weight_stagnant THEN
        v_status         := 'yellow';
        v_reason         := 'weight unchanged for ' || v_stagnation_days || ' days';
        v_interpretation := 'stagnation despite compliance';
      ELSE
        v_status         := 'green';
        v_reason         := 'on track';
        v_interpretation := NULL;
      END IF;
    END IF;
  END IF;

  -- Upsert flash card (notes field is never overwritten by compute)
  INSERT INTO public.flash_cards
    (client_id, coach_id, status, reason, food_summary, interpretation, last_log_at, computed_at)
  VALUES
    (p_client_id, v_my_coach_id, v_status, v_reason, v_food_summary, v_interpretation, v_last_log_at, now())
  ON CONFLICT (client_id) DO UPDATE SET
    status         = EXCLUDED.status,
    reason         = EXCLUDED.reason,
    food_summary   = EXCLUDED.food_summary,
    interpretation = EXCLUDED.interpretation,
    last_log_at    = EXCLUDED.last_log_at,
    computed_at    = EXCLUDED.computed_at;
  -- notes is intentionally excluded — coach-private, not reset by compute

  RETURN QUERY SELECT fc.* FROM public.flash_cards fc WHERE fc.client_id = p_client_id;
END;
$$;


-- ============================================================
-- 4. CLIENT STATUS
-- ============================================================

-- ── pause_client ───────────────────────────────────────────
-- Sets client platform_users.status = 'paused'.
-- Absence detection is disabled for paused clients (cron skips them).
-- Direct UPDATE on platform_users is revoked for authenticated in 011 (S-08).
CREATE OR REPLACE FUNCTION public.pause_client(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  UPDATE public.platform_users pu
     SET status     = 'paused',
         updated_at = now()
    FROM public.clients cl
   WHERE pu.id      = p_client_id
     AND cl.id      = p_client_id
     AND cl.coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;
END;
$$;


-- ── unpause_client ─────────────────────────────────────────
-- Sets client platform_users.status = 'active'.
CREATE OR REPLACE FUNCTION public.unpause_client(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  UPDATE public.platform_users pu
     SET status     = 'active',
         updated_at = now()
    FROM public.clients cl
   WHERE pu.id      = p_client_id
     AND cl.id      = p_client_id
     AND cl.coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;
END;
$$;


-- ── deactivate_client ──────────────────────────────────────
-- Sets client platform_users.status = 'deactivated'.
-- Preserves all data. 7-day grace period is derived at read time
-- from client_subscriptions.end_date + 7 days (not stored).
CREATE OR REPLACE FUNCTION public.deactivate_client(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  UPDATE public.platform_users pu
     SET status     = 'deactivated',
         updated_at = now()
    FROM public.clients cl
   WHERE pu.id      = p_client_id
     AND cl.id      = p_client_id
     AND cl.coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;
END;
$$;


-- ============================================================
-- 5. PLAN MANAGEMENT
-- ============================================================

-- ── assign_plan ────────────────────────────────────────────
-- Assigns an active plan to a client with type enforcement.
-- Caller must be coach or assistant with 'modify_plans' permission.
-- Partial unique index plan_assignments_one_active_per_type_key
-- (004_indexes) enforces one active plan per type per client.
CREATE OR REPLACE FUNCTION public.assign_plan(
  p_client_id uuid,
  p_plan_id   uuid
)
RETURNS SETOF public.plan_assignments
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_coach_id  uuid;
  v_plan_type text;
  v_plan_status public.plan_status;
  v_client_status public.user_status;
  v_new_id    uuid;
BEGIN
  v_role     := private.get_my_role();
  v_coach_id := private.get_my_coach_id();

  IF v_role NOT IN ('coach', 'assistant') THEN
    RAISE EXCEPTION 'permission denied: coach or assistant only';
  END IF;

  IF v_role = 'assistant' AND NOT private.has_permission('modify_plans') THEN
    RAISE EXCEPTION 'permission denied: modify_plans permission required';
  END IF;

  -- Validate plan: active, same tenant
  SELECT p.type::text, p.status
    INTO v_plan_type, v_plan_status
    FROM public.plans p
   WHERE p.id       = p_plan_id
     AND p.coach_id = v_coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found in your workspace';
  END IF;

  IF v_plan_status != 'active' THEN
    RAISE EXCEPTION 'plan is archived and cannot be assigned';
  END IF;

  -- Validate client: active, same tenant
  SELECT pu.status
    INTO v_client_status
    FROM public.clients cl
    JOIN public.platform_users pu ON pu.id = cl.id
   WHERE cl.id       = p_client_id
     AND cl.coach_id = v_coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;

  IF v_client_status != 'active' THEN
    RAISE EXCEPTION 'client is not active';
  END IF;

  -- Check no existing active assignment of same type
  IF EXISTS (
    SELECT 1 FROM public.plan_assignments pa
     WHERE pa.client_id  = p_client_id
       AND pa.plan_type  = v_plan_type
       AND pa.status     = 'active'
  ) THEN
    RAISE EXCEPTION 'client already has an active % plan; use replace_active_plan to replace it', v_plan_type;
  END IF;

  v_new_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.plan_assignments
    (id, coach_id, client_id, plan_id, plan_type, status, assigned_at, assigned_by)
  VALUES
    (v_new_id, v_coach_id, p_client_id, p_plan_id, v_plan_type, 'active', now(), auth.uid());

  RETURN QUERY SELECT pa.* FROM public.plan_assignments pa WHERE pa.id = v_new_id;
END;
$$;


-- ── replace_active_plan ────────────────────────────────────
-- Atomically replaces the current active plan of a given type
-- with a new one. Old assignment is set to 'replaced'.
CREATE OR REPLACE FUNCTION public.replace_active_plan(
  p_client_id  uuid,
  p_plan_type  text,
  p_new_plan_id uuid
)
RETURNS SETOF public.plan_assignments
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id    uuid;
  v_plan_status public.plan_status;
  v_plan_type   text;
  v_new_id      uuid;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_coach_id := auth.uid();

  -- Validate new plan: active, correct type, same tenant
  SELECT p.type::text, p.status
    INTO v_plan_type, v_plan_status
    FROM public.plans p
   WHERE p.id       = p_new_plan_id
     AND p.coach_id = v_coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'new plan not found in your workspace';
  END IF;

  IF v_plan_status != 'active' THEN
    RAISE EXCEPTION 'new plan is archived';
  END IF;

  IF v_plan_type != p_plan_type THEN
    RAISE EXCEPTION 'new plan type (%) does not match requested type (%)', v_plan_type, p_plan_type;
  END IF;

  -- Validate client is in workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.clients cl
     WHERE cl.id = p_client_id AND cl.coach_id = v_coach_id
  ) THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;

  -- Mark current active assignment as replaced
  UPDATE public.plan_assignments
     SET status = 'replaced'
   WHERE client_id = p_client_id
     AND coach_id  = v_coach_id
     AND plan_type = p_plan_type
     AND status    = 'active';

  -- Insert new active assignment
  v_new_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.plan_assignments
    (id, coach_id, client_id, plan_id, plan_type, status, assigned_at, assigned_by)
  VALUES
    (v_new_id, v_coach_id, p_client_id, p_new_plan_id, p_plan_type, 'active', now(), auth.uid());

  RETURN QUERY SELECT pa.* FROM public.plan_assignments pa WHERE pa.id = v_new_id;
END;
$$;


-- ============================================================
-- 6. ABSENCE MANAGEMENT
-- ============================================================

-- ── mark_absence_handled ───────────────────────────────────
-- Updates action_taken and handled_by on an absence event.
CREATE OR REPLACE FUNCTION public.mark_absence_handled(
  p_event_id uuid,
  p_action   public.absence_action
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_client_id uuid;
  v_coach_id  uuid;
BEGIN
  v_role := private.get_my_role();

  IF v_role NOT IN ('coach', 'assistant') THEN
    RAISE EXCEPTION 'permission denied: coach or assistant only';
  END IF;

  SELECT ae.client_id, ae.coach_id
    INTO v_client_id, v_coach_id
    FROM public.absence_events ae
   WHERE ae.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence event not found';
  END IF;

  IF v_coach_id != private.get_my_coach_id() THEN
    RAISE EXCEPTION 'permission denied: not your workspace';
  END IF;

  IF v_role = 'assistant' AND NOT private.is_my_assigned_client(v_client_id) THEN
    RAISE EXCEPTION 'permission denied: client not assigned to you';
  END IF;

  UPDATE public.absence_events
     SET action_taken = p_action,
         handled_by   = auth.uid()
   WHERE id = p_event_id;
END;
$$;


-- ── resolve_absence ────────────────────────────────────────
-- Marks an absence event as resolved and records the timestamp.
CREATE OR REPLACE FUNCTION public.resolve_absence(
  p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_client_id uuid;
  v_coach_id  uuid;
BEGIN
  v_role := private.get_my_role();

  IF v_role NOT IN ('coach', 'assistant') THEN
    RAISE EXCEPTION 'permission denied: coach or assistant only';
  END IF;

  SELECT ae.client_id, ae.coach_id
    INTO v_client_id, v_coach_id
    FROM public.absence_events ae
   WHERE ae.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence event not found';
  END IF;

  IF v_coach_id != private.get_my_coach_id() THEN
    RAISE EXCEPTION 'permission denied: not your workspace';
  END IF;

  IF v_role = 'assistant' AND NOT private.is_my_assigned_client(v_client_id) THEN
    RAISE EXCEPTION 'permission denied: client not assigned to you';
  END IF;

  UPDATE public.absence_events
     SET action_taken = 'resolved',
         resolved_at  = now(),
         handled_by   = auth.uid()
   WHERE id = p_event_id;
END;
$$;


-- ============================================================
-- 7. PAYMENT TRACKING
-- ============================================================

-- ── confirm_client_payment ─────────────────────────────────
-- Marks a client subscription as active (manual payment confirmation).
-- Caller must be coach or assistant with 'mark_payment' permission.
CREATE OR REPLACE FUNCTION public.confirm_client_payment(
  p_subscription_id uuid,
  p_notes           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role     text;
  v_coach_id uuid;
BEGIN
  v_role     := private.get_my_role();
  v_coach_id := private.get_my_coach_id();

  IF v_role NOT IN ('coach', 'assistant') THEN
    RAISE EXCEPTION 'permission denied: coach or assistant only';
  END IF;

  IF v_role = 'assistant' AND NOT private.has_permission('mark_payment') THEN
    RAISE EXCEPTION 'permission denied: mark_payment permission required';
  END IF;

  -- Validate subscription is in caller's tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.client_subscriptions cs
     WHERE cs.id       = p_subscription_id
       AND cs.coach_id = v_coach_id
  ) THEN
    RAISE EXCEPTION 'subscription not found in your workspace';
  END IF;

  UPDATE public.client_subscriptions
     SET status               = 'active',
         payment_confirmed_by = auth.uid(),
         notes                = COALESCE(p_notes, notes),
         updated_at           = now()
   WHERE id = p_subscription_id;
END;
$$;


-- ============================================================
-- 8. STAFF MANAGEMENT
-- ============================================================

-- ── assign_staff_to_client ─────────────────────────────────
-- Creates a client-staff assignment with tenant validation.
CREATE OR REPLACE FUNCTION public.assign_staff_to_client(
  p_staff_id  uuid,
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_coach_id := auth.uid();

  -- Staff must be active in the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_assignments sa
     WHERE sa.user_id   = p_staff_id
       AND sa.coach_id  = v_coach_id
       AND sa.status    = 'active'
  ) THEN
    RAISE EXCEPTION 'staff member not found or not active in your workspace';
  END IF;

  -- Client must be in the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.clients cl
     WHERE cl.id       = p_client_id
       AND cl.coach_id = v_coach_id
  ) THEN
    RAISE EXCEPTION 'client not found in your workspace';
  END IF;

  INSERT INTO public.client_staff_assignments (coach_id, client_id, staff_id, created_at)
  VALUES (v_coach_id, p_client_id, p_staff_id, now())
  ON CONFLICT (client_id, staff_id) DO NOTHING;
END;
$$;


-- ── remove_staff_from_client ───────────────────────────────
-- Removes a client-staff assignment.
CREATE OR REPLACE FUNCTION public.remove_staff_from_client(
  p_staff_id  uuid,
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  DELETE FROM public.client_staff_assignments
   WHERE staff_id  = p_staff_id
     AND client_id = p_client_id
     AND coach_id  = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found in your workspace';
  END IF;
END;
$$;


-- ── update_staff_status ────────────────────────────────────
-- Enables or disables a staff assignment.
-- Does NOT reassign clients; use reassign_staff_clients for that.
CREATE OR REPLACE FUNCTION public.update_staff_status(
  p_assignment_id uuid,
  p_status        public.staff_status
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  UPDATE public.staff_assignments
     SET status     = p_status,
         updated_at = now()
   WHERE id       = p_assignment_id
     AND coach_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff assignment not found in your workspace';
  END IF;
END;
$$;


-- ── reassign_staff_clients ─────────────────────────────────
-- Moves all client assignments from p_from_staff_id to
-- p_to_staff_id. If p_to_staff_id is NULL, unassigns all
-- clients (removes rows; clients revert to direct coach handling).
CREATE OR REPLACE FUNCTION public.reassign_staff_clients(
  p_from_staff_id uuid,
  p_to_staff_id   uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_coach_id := auth.uid();

  -- From-staff must be in the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_assignments sa
     WHERE sa.user_id  = p_from_staff_id
       AND sa.coach_id = v_coach_id
  ) THEN
    RAISE EXCEPTION 'source staff member not found in your workspace';
  END IF;

  IF p_to_staff_id IS NULL THEN
    -- Unassign: remove all client_staff_assignments for this staff
    DELETE FROM public.client_staff_assignments
     WHERE staff_id = p_from_staff_id
       AND coach_id = v_coach_id;
  ELSE
    -- Target staff must be active in the workspace
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_assignments sa
       WHERE sa.user_id  = p_to_staff_id
         AND sa.coach_id = v_coach_id
         AND sa.status   = 'active'
    ) THEN
      RAISE EXCEPTION 'target staff member not found or not active in your workspace';
    END IF;

    -- Reassign: update existing rows; skip duplicates with ON CONFLICT
    -- First update non-conflicting rows
    UPDATE public.client_staff_assignments
       SET staff_id = p_to_staff_id
     WHERE staff_id = p_from_staff_id
       AND coach_id = v_coach_id
       AND NOT EXISTS (
         SELECT 1 FROM public.client_staff_assignments csa2
          WHERE csa2.client_id = public.client_staff_assignments.client_id
            AND csa2.staff_id  = p_to_staff_id
       );

    -- Delete any remaining (duplicate assignments after the move)
    DELETE FROM public.client_staff_assignments
     WHERE staff_id = p_from_staff_id
       AND coach_id = v_coach_id;
  END IF;
END;
$$;


-- ============================================================
-- 9. MESSAGING
-- ============================================================

-- ── send_message ───────────────────────────────────────────
-- Inserts a message with explicit recipient validation.
-- Direct INSERT on messages is revoked for authenticated in 011 (S-07).
-- Role-specific recipient rules:
--   coach:     recipient must be a tenant member
--   assistant: recipient must be own coach OR assigned client
--   client:    recipient must be own coach OR assigned assistant
CREATE OR REPLACE FUNCTION public.send_message(
  p_recipient_id uuid,
  p_content      text
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role      text;
  v_coach_id  uuid;
  v_new_id    uuid;
BEGIN
  v_role     := private.get_my_role();
  v_coach_id := private.get_my_coach_id();

  IF v_role IS NULL OR v_coach_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated or no workspace';
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'message content cannot be empty';
  END IF;

  IF p_recipient_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot send a message to yourself';
  END IF;

  -- Validate recipient by role
  IF v_role = 'coach' THEN
    -- Recipient must be a tenant member (client, staff, or co-coach)
    IF NOT private.is_tenant_member(p_recipient_id) THEN
      RAISE EXCEPTION 'recipient is not a member of your workspace';
    END IF;

  ELSIF v_role = 'assistant' THEN
    -- Recipient must be own coach OR an assigned client
    IF p_recipient_id != v_coach_id
       AND NOT private.is_my_assigned_client(p_recipient_id)
    THEN
      RAISE EXCEPTION 'permission denied: recipient must be your coach or an assigned client';
    END IF;

  ELSIF v_role = 'client' THEN
    -- Recipient must be own coach OR an assistant assigned to this client
    IF p_recipient_id != v_coach_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.client_staff_assignments csa
          WHERE csa.client_id = auth.uid()
            AND csa.staff_id  = p_recipient_id
       )
    THEN
      RAISE EXCEPTION 'permission denied: recipient must be your coach or an assigned assistant';
    END IF;

  ELSE
    RAISE EXCEPTION 'permission denied: messaging not available for this role';
  END IF;

  v_new_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.messages (id, coach_id, sender_id, recipient_id, content, created_at)
  VALUES (v_new_id, v_coach_id, auth.uid(), p_recipient_id, p_content, now());

  RETURN QUERY SELECT m.* FROM public.messages m WHERE m.id = v_new_id;
END;
$$;


-- ── list_conversations ─────────────────────────────────────
-- Returns conversation list with last message and unread count.
-- Coach (Option A): one row per client, aggregated across all
--   messages involving that client within the workspace.
-- Assistant/Client (Option B): one row per conversation partner.
CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE (
  participant_id   uuid,
  participant_name text,
  participant_role text,
  last_message     text,
  last_message_at  timestamptz,
  unread_count     bigint
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role     text;
  v_coach_id uuid;
BEGIN
  v_role     := private.get_my_role();
  v_coach_id := private.get_my_coach_id();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_role = 'coach' THEN
    -- Option A: aggregate all messages per client
    RETURN QUERY
    SELECT
      cl.id                                                       AS participant_id,
      pu.full_name                                                AS participant_name,
      'client'::text                                              AS participant_role,
      last_m.content                                              AS last_message,
      last_m.created_at                                          AS last_message_at,
      COUNT(m.id) FILTER (WHERE m.read_at IS NULL
                            AND m.recipient_id = auth.uid())     AS unread_count
    FROM public.clients cl
    JOIN public.platform_users pu ON pu.id = cl.id
    LEFT JOIN LATERAL (
      SELECT m2.content, m2.created_at
        FROM public.messages m2
       WHERE m2.coach_id       = v_coach_id
         AND (m2.sender_id     = cl.id OR m2.recipient_id = cl.id)
       ORDER BY m2.created_at DESC
       LIMIT 1
    ) last_m ON true
    LEFT JOIN public.messages m
      ON m.coach_id = v_coach_id
     AND (m.sender_id = cl.id OR m.recipient_id = cl.id)
    WHERE cl.coach_id = v_coach_id
    GROUP BY cl.id, pu.full_name, last_m.content, last_m.created_at
    ORDER BY last_m.created_at DESC NULLS LAST;

  ELSE
    -- Option B: one row per conversation partner
    RETURN QUERY
    WITH last_per_partner AS (
      SELECT DISTINCT ON (
        CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END
      )
        CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END AS partner_id,
        m.content,
        m.created_at
        FROM public.messages m
       WHERE m.coach_id = v_coach_id
         AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
       ORDER BY
         CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END,
         m.created_at DESC
    ),
    unread_counts AS (
      SELECT m.sender_id AS partner_id, COUNT(*) AS cnt
        FROM public.messages m
       WHERE m.coach_id     = v_coach_id
         AND m.recipient_id = auth.uid()
         AND m.read_at      IS NULL
       GROUP BY m.sender_id
    )
    SELECT
      lp.partner_id                     AS participant_id,
      pu.full_name                      AS participant_name,
      pu.role_type::text                AS participant_role,
      lp.content                        AS last_message,
      lp.created_at                     AS last_message_at,
      COALESCE(uc.cnt, 0)::bigint       AS unread_count
    FROM last_per_partner lp
    JOIN public.platform_users pu ON pu.id = lp.partner_id
    LEFT JOIN unread_counts uc ON uc.partner_id = lp.partner_id
    ORDER BY lp.created_at DESC;
  END IF;
END;
$$;


-- ── get_conversation ───────────────────────────────────────
-- Returns paginated messages for one conversation (cursor-based).
-- Coach: all messages involving the specified participant (client).
-- Others: only messages between caller and participant.
-- p_cursor: return messages older than this timestamp (DESC order).
CREATE OR REPLACE FUNCTION public.get_conversation(
  p_participant_id uuid,
  p_cursor         timestamptz DEFAULT NULL
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role     text;
  v_coach_id uuid;
BEGIN
  v_role     := private.get_my_role();
  v_coach_id := private.get_my_coach_id();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_role = 'coach' THEN
    RETURN QUERY
    SELECT m.*
      FROM public.messages m
     WHERE m.coach_id = v_coach_id
       AND (m.sender_id = p_participant_id OR m.recipient_id = p_participant_id)
       AND (p_cursor IS NULL OR m.created_at < p_cursor)
     ORDER BY m.created_at DESC
     LIMIT 50;
  ELSE
    RETURN QUERY
    SELECT m.*
      FROM public.messages m
     WHERE m.coach_id = v_coach_id
       AND (
         (m.sender_id = auth.uid() AND m.recipient_id = p_participant_id)
         OR
         (m.sender_id = p_participant_id AND m.recipient_id = auth.uid())
       )
       AND (p_cursor IS NULL OR m.created_at < p_cursor)
     ORDER BY m.created_at DESC
     LIMIT 50;
  END IF;
END;
$$;


-- ── mark_message_read ──────────────────────────────────────
-- Column-safe update of read_at only. Caller must be the recipient.
-- Direct UPDATE on messages is revoked for authenticated in 011 (S-03).
CREATE OR REPLACE FUNCTION public.mark_message_read(
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  v_coach_id := private.get_my_coach_id();

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated or no workspace';
  END IF;

  UPDATE public.messages
     SET read_at = now()
   WHERE id           = p_message_id
     AND recipient_id = auth.uid()
     AND coach_id     = v_coach_id
     AND read_at      IS NULL;

  -- Silently succeed if already read or not found (idempotent)
END;
$$;


-- ============================================================
-- 10. CLIENT PROFILE SUMMARY
-- ============================================================

-- ── get_client_profile_summary ─────────────────────────────
-- Returns combined profile for the authenticated client.
-- Derives grace_days_remaining from subscription end_date + 7 days.
CREATE OR REPLACE FUNCTION public.get_client_profile_summary()
RETURNS TABLE (
  client_id             uuid,
  full_name             text,
  email                 text,
  status                text,
  coach_id              uuid,
  coach_name            text,
  onboarding_completed  boolean,
  subscription_status   text,
  subscription_end_date date,
  grace_days_remaining  integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'client' THEN
    RAISE EXCEPTION 'permission denied: client only';
  END IF;

  RETURN QUERY
  SELECT
    c.id                                        AS client_id,
    pu.full_name,
    pu.email,
    pu.status::text,
    c.coach_id,
    pu_coach.full_name                          AS coach_name,
    c.onboarding_completed,
    cs.status::text                             AS subscription_status,
    cs.end_date                                 AS subscription_end_date,
    CASE
      WHEN cs.end_date IS NULL THEN NULL
      ELSE (cs.end_date - CURRENT_DATE + 7)
    END                                         AS grace_days_remaining
  FROM public.clients c
  JOIN public.platform_users pu       ON pu.id       = c.id
  JOIN public.platform_users pu_coach ON pu_coach.id = c.coach_id
  LEFT JOIN LATERAL (
    SELECT cs2.status, cs2.end_date
      FROM public.client_subscriptions cs2
     WHERE cs2.client_id = c.id
     ORDER BY cs2.created_at DESC
     LIMIT 1
  ) cs ON true
  WHERE c.id = auth.uid();
END;
$$;


-- ============================================================
-- GRANTS
-- Revoke default PUBLIC execute; grant to authenticated only.
-- service_role retains implicit superuser-equivalent DB access.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.create_client_invite(uuid, text, text)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_invite_token(uuid)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid)                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_today_log(numeric, integer, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_flash_card_notes(uuid, text)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_flash_card(uuid)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pause_client(uuid)                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unpause_client(uuid)                            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deactivate_client(uuid)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_plan(uuid, uuid)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_active_plan(uuid, text, uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_absence_handled(uuid, public.absence_action) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_absence(uuid)                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_client_payment(uuid, text)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_staff_to_client(uuid, uuid)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_staff_from_client(uuid, uuid)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_staff_status(uuid, public.staff_status)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reassign_staff_clients(uuid, uuid)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_message(uuid, text)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_conversations()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_conversation(uuid, timestamptz)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_message_read(uuid)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_client_profile_summary()                    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_client_invite(uuid, text, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_token(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_today_log(numeric, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_flash_card_notes(uuid, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_flash_card(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_client(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpause_client(uuid)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_client(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_plan(uuid, uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_active_plan(uuid, text, uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_absence_handled(uuid, public.absence_action) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_absence(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_client_payment(uuid, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_to_client(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_staff_from_client(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_status(uuid, public.staff_status)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_staff_clients(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation(uuid, timestamptz)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_profile_summary()                     TO authenticated;
