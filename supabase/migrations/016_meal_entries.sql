-- ============================================================
-- Migration: 016_meal_entries
-- Purpose:   Detailed multi-meal logging (breakfast/lunch/dinner/
--            snack), one slot per day per type. Coexists with
--            daily_logs.meal_description/meal_photo_key (the
--            existing single quick-log field is unchanged) — this
--            is an additive detail view, not a replacement.
-- Order:     16 (post-Tier-1)
--
-- Notes:
--   - Same tenant-integrity pattern as daily_logs: composite FK
--     (client_id, coach_id) -> clients(id, coach_id), ON DELETE
--     NO ACTION (soft-delete convention, Design Rule 4).
--   - UNIQUE(client_id, log_date, meal_type) keeps this to four
--     clean slots/day rather than an open-ended list.
--   - RLS mirrors daily_logs' 7-policy shape exactly (008_rls_
--     policies.sql lines 399-449) — no new access pattern.
--   - No client DELETE policy (matches daily_logs). Photo
--     retention (delete-after-20-days) runs via service-role
--     cron, which bypasses RLS entirely.
-- ============================================================


-- ── Enum ──────────────────────────────────────────────────
CREATE TYPE public.meal_type_enum AS ENUM (
  'breakfast',
  'lunch',
  'dinner',
  'snack'
);


-- ── Table ─────────────────────────────────────────────────
CREATE TABLE public.meal_entries (
  id          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid                  NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id    uuid                  NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  log_date    date                  NOT NULL,
  meal_type   public.meal_type_enum NOT NULL,
  description text,
  photo_key   text,
  created_at  timestamptz           NOT NULL DEFAULT now(),
  UNIQUE (client_id, log_date, meal_type)
);


-- ── Composite FK (tenant integrity) ──────────────────────────
-- Depends on clients_id_coach_id_key UNIQUE constraint added in
-- 003_composite_constraints.sql.
ALTER TABLE public.meal_entries
  ADD CONSTRAINT meal_entries_client_coach_fkey
    FOREIGN KEY (client_id, coach_id)
    REFERENCES public.clients (id, coach_id);


-- ── Index ─────────────────────────────────────────────────
-- Mirrors daily_logs_coach_client_log_date_idx (004_indexes.sql)
-- — coach review lookups and the retention cron both filter by
-- (coach_id, client_id, log_date).
CREATE INDEX meal_entries_coach_client_log_date_idx
  ON public.meal_entries (coach_id, client_id, log_date DESC);


-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_entries_super_admin_select ON public.meal_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY meal_entries_coach_select ON public.meal_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY meal_entries_assistant_select_assigned ON public.meal_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );

CREATE POLICY meal_entries_senior_assistant_select_team ON public.meal_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY meal_entries_client_select_own ON public.meal_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY meal_entries_client_insert ON public.meal_entries
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
    AND coach_id = private.get_my_coach_id()
  );

-- WITH CHECK adds coach_id guard to prevent cross-tenant row jumping.
CREATE POLICY meal_entries_client_update_own ON public.meal_entries
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );
