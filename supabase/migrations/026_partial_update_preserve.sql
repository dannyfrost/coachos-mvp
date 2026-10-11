-- ============================================================
-- 026_partial_update_preserve.sql
-- FIX (P1 data-loss): update_today_log is a PARTIAL update — callers
-- omit the fields they don't touch (every param DEFAULT NULL), e.g.
-- steps auto-sync calls it with only p_steps. But the ON CONFLICT clause
-- in 010/020 wrote `weight = EXCLUDED.weight`, `steps = EXCLUDED.steps`,
-- `meal_description`/`questions` the same way, so a steps-only update
-- overwrote a previously-logged weight (and questions) with NULL. Only
-- meal_photo_key/weight_photo_key were COALESCE-preserved.
--
-- Fix: COALESCE every content column so an omitted/NULL param leaves the
-- stored value unchanged (preserve-on-omit) — matching the real partial-
-- update contract and what the two photo-key columns already did.
--
-- NULL semantics: under this RPC's contract NULL means "leave unchanged",
-- not "clear". No current caller sends an explicit NULL to clear a field
-- (the app omits fields it isn't updating and has no clear-to-empty UI),
-- so no intentional-clear behavior is lost. A future explicit-clear
-- feature would need a separate sentinel/flag, not bare NULL.
--
-- Full CREATE OR REPLACE: carries forward the evidence guard added in
-- 025_weight_requires_photo.sql so the final function has both. Apply
-- order: 025 then 026 (026 supersedes 025's body).
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_today_log(
  p_weight             numeric  DEFAULT NULL,
  p_steps              integer  DEFAULT NULL,
  p_meal_description   text     DEFAULT NULL,
  p_meal_photo_key     text     DEFAULT NULL,
  p_questions          text     DEFAULT NULL,
  p_weight_photo_key   text     DEFAULT NULL
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

  -- Evidence policy (from 025): a weight reading requires a scale photo,
  -- supplied now (p_weight_photo_key) or already stored on today's log.
  IF p_weight IS NOT NULL
     AND p_weight_photo_key IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.daily_logs dl
        WHERE dl.client_id = auth.uid()
          AND dl.log_date  = CURRENT_DATE
          AND dl.weight_photo_key IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'weight requires a scale photo';
  END IF;

  v_coach_id := private.get_my_coach_id();

  INSERT INTO public.daily_logs
    (client_id, coach_id, log_date, weight, steps, meal_description, meal_photo_key, questions, weight_photo_key, created_at)
  VALUES
    (auth.uid(), v_coach_id, CURRENT_DATE, p_weight, p_steps, p_meal_description, p_meal_photo_key, p_questions, p_weight_photo_key, now())
  ON CONFLICT (client_id, log_date) DO UPDATE SET
    -- Preserve-on-omit: keep the stored value when the param is NULL.
    weight            = COALESCE(EXCLUDED.weight, public.daily_logs.weight),
    steps             = COALESCE(EXCLUDED.steps, public.daily_logs.steps),
    meal_description  = COALESCE(EXCLUDED.meal_description, public.daily_logs.meal_description),
    meal_photo_key    = COALESCE(EXCLUDED.meal_photo_key, public.daily_logs.meal_photo_key),
    questions         = COALESCE(EXCLUDED.questions, public.daily_logs.questions),
    weight_photo_key  = COALESCE(EXCLUDED.weight_photo_key, public.daily_logs.weight_photo_key);

  RETURN QUERY
  SELECT dl.*
    FROM public.daily_logs dl
   WHERE dl.client_id = auth.uid()
     AND dl.log_date  = CURRENT_DATE;
END;
$$;
