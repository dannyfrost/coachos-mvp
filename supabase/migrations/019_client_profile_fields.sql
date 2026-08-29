-- ============================================================
-- 019_client_profile_fields.sql
-- Adds height_cm to clients, plus a client-only RPC to let the
-- client self-report age/height/condition_notes (mobile app
-- onboarding + Settings). No direct table UPDATE grant is given
-- to the client role; the RPC is the only write path, matching
-- the update_today_log pattern in 010_rpc_functions.sql.
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN height_cm smallint;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_age_range CHECK (age IS NULL OR (age BETWEEN 1 AND 120));

ALTER TABLE public.clients
  ADD CONSTRAINT clients_height_cm_range CHECK (height_cm IS NULL OR (height_cm BETWEEN 50 AND 250));

-- ── update_client_profile ──────────────────────────────────
-- Lets the authenticated client update their own age/height/
-- condition notes. Client-only; scoped strictly to auth.uid().
CREATE OR REPLACE FUNCTION public.update_client_profile(
  p_age             integer DEFAULT NULL,
  p_height_cm       integer DEFAULT NULL,
  p_condition_notes text    DEFAULT NULL
)
RETURNS SETOF public.clients
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_my_role() != 'client' THEN
    RAISE EXCEPTION 'permission denied: client only';
  END IF;

  IF p_age IS NOT NULL AND (p_age < 1 OR p_age > 120) THEN
    RAISE EXCEPTION 'age must be between 1 and 120';
  END IF;

  IF p_height_cm IS NOT NULL AND (p_height_cm < 50 OR p_height_cm > 250) THEN
    RAISE EXCEPTION 'height_cm must be between 50 and 250';
  END IF;

  UPDATE public.clients
     SET age             = p_age,
         height_cm       = p_height_cm,
         condition_notes = p_condition_notes
   WHERE id = auth.uid();

  RETURN QUERY
  SELECT c.*
    FROM public.clients c
   WHERE c.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_client_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_client_profile TO authenticated;
