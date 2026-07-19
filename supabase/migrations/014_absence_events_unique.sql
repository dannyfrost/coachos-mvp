-- ============================================================
-- Migration: 014_absence_events_unique
-- Purpose:   Add the UNIQUE(client_id, trigger_date, level) constraint
--            required for idempotent absence-detection cron inserts
--            (per MVP_API_Endpoint_Spec.md /api/absence/detect).
--            This constraint was specified but never migrated —
--            without it, a detection cron running every 6h would
--            create duplicate absence_events rows on every run for
--            a client who remains absent.
-- Order:     14 (post-Tier-1)
-- ============================================================

ALTER TABLE public.absence_events
  ADD CONSTRAINT absence_events_client_trigger_level_key
    UNIQUE (client_id, trigger_date, level);
