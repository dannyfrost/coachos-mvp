-- ============================================================
-- Migration: 018_message_notify_webhook
-- Purpose:   Near-real-time notification on new chat messages.
--            Vercel Hobby plan only allows DAILY cron schedules
--            (confirmed limitation, see migration 014's notes on
--            /api/absence/detect) — a polling cron is unusable
--            for chat notifications, which need to fire within
--            seconds, not once a day. This uses an event-driven
--            Postgres trigger + pg_net async HTTP call instead,
--            which fires immediately on INSERT regardless of
--            Vercel plan tier.
--
-- Flow:      messages INSERT -> trigger -> pg_net.http_post ->
--            POST /api/messages/notify-new on the deployed web
--            app -> that route decides email (recipient is
--            coach) vs push (recipient is client) and sends it.
--
-- Notes:
--   - The webhook's shared-secret auth token is stored in
--     Supabase Vault (`message_webhook_secret`), NOT inlined in
--     this file — this file is committed to git, a plaintext
--     secret here would leak into version control. The trigger
--     function reads it at runtime from `vault.decrypted_secrets`.
--   - pg_net calls are async/fire-and-forget from Postgres' side
--     (queued, executed out-of-band) — a slow or failing webhook
--     call cannot block or fail the message INSERT itself.
--   - Target URL is the live production deployment
--     (coachos-mvp-web.vercel.app). If the custom domain changes
--     later, this trigger function needs updating too.
-- ============================================================


-- pg_net creates and manages its own `net` schema; don't redirect it.
CREATE EXTENSION IF NOT EXISTS pg_net;


CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'message_webhook_secret'
   LIMIT 1;

  IF v_secret IS NULL THEN
    -- Secret not configured — skip silently rather than blocking message inserts.
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://coachos-mvp-web.vercel.app/api/messages/notify-new',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;


CREATE TRIGGER messages_notify_new_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
