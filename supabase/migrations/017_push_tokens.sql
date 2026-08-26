-- ============================================================
-- Migration: 017_push_tokens
-- Purpose:   Client-side Expo push token storage, for daily
--            "log today" reminder pushes. Coach-facing alerts use
--            email (Resend) instead — coach has no mobile app, so
--            there's nothing to register a push token against.
-- Order:     17 (post-Tier-1)
--
-- Notes:
--   - Not tenant-scoped like daily_logs/meal_entries (no
--     composite FK to clients) — this is a simple user-owned
--     row, same ownership shape as platform_users' own-row RLS
--     (008_rls_policies.sql line 51: `id = auth.uid()`).
--   - UNIQUE(user_id): one active device per client for MVP.
--     Re-registering (e.g. reinstall, new device) overwrites the
--     previous token via upsert — simplest correct behavior,
--     no multi-device fan-out needed yet.
--   - No SELECT policy for coach/assistant roles — tokens are
--     only ever read server-side by the reminder cron via the
--     service-role client, which bypasses RLS entirely.
-- ============================================================


CREATE TABLE public.push_tokens (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL UNIQUE REFERENCES public.platform_users(id) ON DELETE CASCADE,
  expo_push_token   text        NOT NULL,
  platform          text        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);


-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_self_select ON public.push_tokens
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_tokens_self_insert ON public.push_tokens
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_self_update ON public.push_tokens
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
