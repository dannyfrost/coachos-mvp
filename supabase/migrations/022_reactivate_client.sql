-- ============================================================
-- 022_reactivate_client.sql
-- Mirrors deactivate_client exactly, in reverse: sets a client's
-- platform_users.status back to 'active'. deactivate_client had no
-- way back until now.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reactivate_client(
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
