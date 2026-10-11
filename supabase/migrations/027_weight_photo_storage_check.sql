-- ============================================================
-- 027_weight_photo_storage_check.sql
-- Hardens the weight-evidence rule (025/026). Previously the RPC only
-- checked that p_weight_photo_key was NON-NULL, so a crafted client could
-- pass any string and log a weight with no real photo. This requires a
-- NEW p_weight_photo_key to name an object that actually EXISTS in the
-- tenant-media bucket AND lives in the caller's own folder.
--
-- Path contract (see apps/web/app/api/storage/signed-upload-url): a weight
-- photo key is `{coach_id}/{client_id}/{file}`; the signed-upload route
-- already refuses to mint an upload URL unless segment 2 == the caller and
-- segment 1 == their coach, so an object under {x}/{auth.uid()}/... can
-- only have been uploaded by this client. We re-check segment 2 == auth.uid()
-- here and that the object is present.
--
-- storage.objects is readable in this SECURITY DEFINER function because the
-- owner (postgres) has rolbypassrls = true, so its RLS does not block the
-- lookup. search_path='' so storage.objects is schema-qualified.
--
-- NOT closed by this: a client can still upload a non-scale image to their
-- own folder and pass — coach review of the photo remains the real control.
-- This only removes the "no file at all, just a string" bypass.
--
-- Full CREATE OR REPLACE carrying forward 026's COALESCE partial-update
-- behavior. Apply after 026.
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

  SELECT cs.status, cs.end_date
    INTO v_sub_status, v_sub_end
    FROM public.client_subscriptions cs
   WHERE cs.client_id = auth.uid()
   ORDER BY cs.created_at DESC
   LIMIT 1;

  IF FOUND AND (v_sub_status = 'expired' OR v_sub_end < CURRENT_DATE) THEN
    RAISE EXCEPTION 'client subscription is expired';
  END IF;

  -- Evidence policy: a weight reading requires a scale photo.
  IF p_weight IS NOT NULL THEN
    IF p_weight_photo_key IS NOT NULL THEN
      -- New photo supplied: must be a real object in the caller's folder.
      IF split_part(p_weight_photo_key, '/', 2) <> auth.uid()::text
         OR NOT EXISTS (
           SELECT 1
             FROM storage.objects o
            WHERE o.bucket_id = 'tenant-media'
              AND o.name = p_weight_photo_key
         )
      THEN
        RAISE EXCEPTION 'invalid weight photo evidence';
      END IF;
    ELSIF NOT EXISTS (
      -- No new photo: today's log must already carry stored evidence.
      SELECT 1
        FROM public.daily_logs dl
       WHERE dl.client_id = auth.uid()
         AND dl.log_date  = CURRENT_DATE
         AND dl.weight_photo_key IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'weight requires a scale photo';
    END IF;
  END IF;

  v_coach_id := private.get_my_coach_id();

  INSERT INTO public.daily_logs
    (client_id, coach_id, log_date, weight, steps, meal_description, meal_photo_key, questions, weight_photo_key, created_at)
  VALUES
    (auth.uid(), v_coach_id, CURRENT_DATE, p_weight, p_steps, p_meal_description, p_meal_photo_key, p_questions, p_weight_photo_key, now())
  ON CONFLICT (client_id, log_date) DO UPDATE SET
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
