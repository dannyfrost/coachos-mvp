-- ============================================================
-- 025_weight_requires_photo.sql
-- Enforces the coaching anti-cheat rule SERVER-SIDE: a weight
-- value can only be logged together with a scale photo as proof.
-- The UI enforces this too (lib/weightEvidence.ts), but a UI-only
-- gate is bypassable by a crafted client, so the RPC rejects a
-- p_weight that arrives with neither a new p_weight_photo_key nor
-- an already-stored weight_photo_key on today's row.
--
-- Recreates update_today_log unchanged except for the new guard
-- (same signature/body as 020_weight_photo.sql). Steps-only,
-- meal-only, and questions-only submissions are unaffected
-- (p_weight IS NULL skips the check). Editing a day whose weight
-- photo is already stored is allowed (COALESCE keeps that photo).
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

  -- Evidence policy: a weight reading requires a scale photo, supplied
  -- now (p_weight_photo_key) or already stored on today's log.
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
