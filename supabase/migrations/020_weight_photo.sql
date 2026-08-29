-- ============================================================
-- 020_weight_photo.sql
-- Adds weight_photo_key to daily_logs (mirrors meal_photo_key)
-- and extends update_today_log with p_weight_photo_key, using
-- the same COALESCE-preserve-on-omit upsert behavior already
-- used for meal_photo_key. Backward compatible: existing callers
-- that don't pass p_weight_photo_key are unaffected.
-- ============================================================

ALTER TABLE public.daily_logs
  ADD COLUMN weight_photo_key text;

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

  v_coach_id := private.get_my_coach_id();

  INSERT INTO public.daily_logs
    (client_id, coach_id, log_date, weight, steps, meal_description, meal_photo_key, questions, weight_photo_key, created_at)
  VALUES
    (auth.uid(), v_coach_id, CURRENT_DATE, p_weight, p_steps, p_meal_description, p_meal_photo_key, p_questions, p_weight_photo_key, now())
  ON CONFLICT (client_id, log_date) DO UPDATE SET
    weight            = EXCLUDED.weight,
    steps             = EXCLUDED.steps,
    meal_description  = EXCLUDED.meal_description,
    meal_photo_key    = COALESCE(EXCLUDED.meal_photo_key, public.daily_logs.meal_photo_key),
    questions         = EXCLUDED.questions,
    weight_photo_key  = COALESCE(EXCLUDED.weight_photo_key, public.daily_logs.weight_photo_key);

  RETURN QUERY
  SELECT dl.*
    FROM public.daily_logs dl
   WHERE dl.client_id = auth.uid()
     AND dl.log_date  = CURRENT_DATE;
END;
$$;
