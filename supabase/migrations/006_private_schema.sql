-- ============================================================
-- Migration: 006_private_schema
-- Purpose:   Create the private schema and five SECURITY DEFINER
--            helper functions used by RLS policies (008_rls_policies).
--            These functions execute as the function owner (bypassing
--            RLS) and are not exposed via the Supabase Data API.
--            Depends on: 002_create_tables, 004_indexes, 005_triggers
-- Order:     6 of 12 (Tier 0)
--
-- Functions (5):
--   1. private.get_my_role()                       → text
--   2. private.get_my_coach_id()                   → uuid
--   3. private.is_my_assigned_client(p_client_id)  → boolean
--   4. private.has_permission(p_permission)         → boolean
--   5. private.is_tenant_member(p_user_id)          → boolean
--
-- Notes:
--   - All five functions are LANGUAGE sql, STABLE, SECURITY DEFINER.
--   - SET search_path = '' (empty) on every function — prevents
--     search_path injection; all object references are fully
--     schema-qualified.
--   - No GRANT EXECUTE to anon or authenticated roles — these
--     functions are private infrastructure, not a public API.
--   - The private schema is not in the Supabase Data API search
--     path, so no explicit REVOKE is needed.
--   - private.get_my_coach_id() does NOT use LIMIT 1 in the
--     assistant branch — the staff_one_active_per_user partial
--     unique index (004_indexes) guarantees at most one active
--     staff_assignments row per user_id, making the subquery
--     deterministic without LIMIT.
--   - VIP tables excluded (DECISIONS.md P-01).
--
-- Gate 0 tests:
--   tests/gate0/G0-12_private_helpers.sql (deferred until
--   local Supabase is bootstrapped — see TESTING_STRATEGY.md
--   and PROJECT_STATE.md Deferred verifications).
-- ============================================================


-- ── Create private schema ──────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;


-- ── 1. get_my_role ─────────────────────────────────────────
-- Returns the authenticated user's role_type cast to text, or
-- NULL if no platform_users row exists for auth.uid().
CREATE OR REPLACE FUNCTION private.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role_type::text
    FROM public.platform_users
   WHERE id = auth.uid()
$$;


-- ── 2. get_my_coach_id ─────────────────────────────────────
-- Returns the coach_id (tenant FK) for the authenticated user:
--   coach     → their own id (they ARE the coach / tenant root)
--   assistant → coach_id from their active staff_assignments row
--               (no LIMIT 1; staff_one_active_per_user partial
--                unique index guarantees at most one active row
--                per user_id)
--   client    → coach_id from their clients row
--   else      → NULL (super_admin, unauthenticated, no row)
CREATE OR REPLACE FUNCTION private.get_my_coach_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE pu.role_type
      WHEN 'coach'     THEN pu.id
      WHEN 'assistant' THEN (
        SELECT sa.coach_id
          FROM public.staff_assignments sa
         WHERE sa.user_id = pu.id
           AND sa.status = 'active'
      )
      WHEN 'client'    THEN (
        SELECT cl.coach_id
          FROM public.clients cl
         WHERE cl.id = pu.id
      )
      ELSE NULL
    END
  FROM public.platform_users pu
  WHERE pu.id = auth.uid()
$$;


-- ── 3. is_my_assigned_client ───────────────────────────────
-- Returns true if p_client_id is within the authenticated
-- user's permitted client scope:
--   coach     → any client whose coach_id matches the caller's id
--   assistant → only clients explicitly mapped to the caller in
--               client_staff_assignments
--   client    → only themselves (self-view)
--   else      → false (super_admin; handled by role-type RLS)
CREATE OR REPLACE FUNCTION private.is_my_assigned_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE pu.role_type
      WHEN 'coach'     THEN EXISTS (
        SELECT 1
          FROM public.clients cl
         WHERE cl.id       = p_client_id
           AND cl.coach_id = pu.id
      )
      WHEN 'assistant' THEN EXISTS (
        SELECT 1
          FROM public.client_staff_assignments csa
         WHERE csa.client_id = p_client_id
           AND csa.staff_id  = pu.id
      )
      WHEN 'client'    THEN p_client_id = pu.id
      ELSE false
    END
  FROM public.platform_users pu
  WHERE pu.id = auth.uid()
$$;


-- ── 4. has_permission ──────────────────────────────────────
-- Returns true if the authenticated user's active staff role
-- grants p_permission (granted = true). Intended for
-- permission-gating assistant actions (e.g. 'can_assign_plan').
-- Returns false for users with no active staff_assignments row
-- (coaches and clients are governed by role-type checks in RLS,
-- not this function).
CREATE OR REPLACE FUNCTION private.has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.staff_assignments  sa
      JOIN public.role_permissions   rp ON rp.role_id = sa.role_id
     WHERE sa.user_id    = auth.uid()
       AND sa.status     = 'active'
       AND rp.permission = p_permission
       AND rp.granted    = true
  )
$$;


-- ── 5. is_tenant_member ────────────────────────────────────
-- Returns true if p_user_id belongs to the same coach workspace
-- as the authenticated user. Used by RLS policies that must
-- verify the remote party in a two-user operation (e.g. both
-- sender and recipient of a message are in the same workspace).
--
-- Checks three membership branches via UNION ALL:
--   1. p_user_id is the workspace coach
--   2. p_user_id is a client in the workspace
--   3. p_user_id is active staff in the workspace
--
-- private.get_my_coach_id() is evaluated once via a CTE to
-- avoid three separate function calls.
CREATE OR REPLACE FUNCTION private.is_tenant_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH my_tenant AS (
    SELECT private.get_my_coach_id() AS coach_id
  )
  SELECT EXISTS (
    -- Branch 1: p_user_id is the workspace coach
    SELECT 1
      FROM public.coaches c, my_tenant
     WHERE c.id = p_user_id
       AND c.id = my_tenant.coach_id
    UNION ALL
    -- Branch 2: p_user_id is a client in the workspace
    SELECT 1
      FROM public.clients cl, my_tenant
     WHERE cl.id       = p_user_id
       AND cl.coach_id = my_tenant.coach_id
    UNION ALL
    -- Branch 3: p_user_id is active staff in the workspace
    SELECT 1
      FROM public.staff_assignments sa, my_tenant
     WHERE sa.user_id  = p_user_id
       AND sa.coach_id = my_tenant.coach_id
       AND sa.status   = 'active'
  )
$$;
