-- ============================================================
-- Migration: 005_triggers
-- Purpose:   Integrity triggers for role-type consistency and
--            locked-role protection. These are the last line of
--            defence when RLS is bypassed (service role,
--            background jobs, admin scripts).
-- Depends on: 002_create_tables
-- Order:     5 of 12 (Tier 0)
--
-- Triggers (4):
--   1. enforce_coach_role_trg              ON public.coaches
--   2. enforce_client_role_trg             ON public.clients
--   3. enforce_roles_locked_trg            ON public.roles
--   4. enforce_role_permissions_locked_trg ON public.role_permissions
--
-- Trigger functions (4):
--   1. public.enforce_coach_role()
--   2. public.enforce_client_role()
--   3. public.enforce_roles_locked()
--   4. public.enforce_role_permissions_locked()
--
-- Notes:
--   - All four triggers are BEFORE / FOR EACH ROW.
--   - All four functions are LANGUAGE plpgsql, VOLATILE (default).
--   - No SECURITY DEFINER here — reserved for the T0-06a private
--     schema helpers.
--   - All function bodies schema-qualify table references
--     (public.platform_users, public.roles).
--   - VIP tables excluded (DECISIONS.md P-01).
--
-- Gate 0 tests:
--   The negative + positive tests for these triggers live in
--   tests/gate0/G0-10_trigger_correctness.sql (deferred until
--   local Supabase is bootstrapped — see TESTING_STRATEGY.md
--   and PROJECT_STATE.md Deferred verifications).
-- ============================================================


-- ── 1. enforce_coach_role ──────────────────────────────────
-- Ensures every row in public.coaches refers to a platform_users
-- row whose role_type = 'coach'. IS DISTINCT FROM also rejects
-- the missing-row case (lookup returns NULL).
CREATE OR REPLACE FUNCTION public.enforce_coach_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role_type public.role_type;
BEGIN
  SELECT role_type
    INTO v_role_type
    FROM public.platform_users
   WHERE id = NEW.id;

  IF v_role_type IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION
      'enforce_coach_role: platform_users.id % has role_type % (expected ''coach''); % on coaches is forbidden',
      NEW.id, v_role_type, TG_OP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_coach_role_trg
  BEFORE INSERT OR UPDATE ON public.coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_coach_role();


-- ── 2. enforce_client_role ─────────────────────────────────
-- Mirror of #1 for public.clients with role_type = 'client'.
CREATE OR REPLACE FUNCTION public.enforce_client_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role_type public.role_type;
BEGIN
  SELECT role_type
    INTO v_role_type
    FROM public.platform_users
   WHERE id = NEW.id;

  IF v_role_type IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION
      'enforce_client_role: platform_users.id % has role_type % (expected ''client''); % on clients is forbidden',
      NEW.id, v_role_type, TG_OP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_client_role_trg
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_role();


-- ── 3. enforce_roles_locked ────────────────────────────────
-- Checks OLD.locked (NOT NEW.locked) so that an UPDATE attempting
-- to set locked = false on a currently-locked row is also
-- rejected. Returns NEW on UPDATE, OLD on DELETE.
CREATE OR REPLACE FUNCTION public.enforce_roles_locked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.locked = true THEN
    RAISE EXCEPTION
      'enforce_roles_locked: role % is locked; % is forbidden',
      OLD.id, TG_OP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_roles_locked_trg
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_roles_locked();


-- ── 4. enforce_role_permissions_locked ─────────────────────
-- Integrity partner of enforce_roles_locked. Without this
-- trigger, an attacker who cannot modify a locked role itself
-- could still neutralise it by editing/moving/deleting its
-- permission rows.
--
-- INSERT: parent role at NEW.role_id must not be locked.
-- UPDATE: BOTH the OLD parent role and the NEW parent role
--         must not be locked. Checking only one side leaves a
--         permission-relocation attack open.
-- DELETE: parent role at OLD.role_id must not be locked.
CREATE OR REPLACE FUNCTION public.enforce_role_permissions_locked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_old_locked boolean;
  v_new_locked boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT locked
      INTO v_new_locked
      FROM public.roles
     WHERE id = NEW.role_id;

    IF v_new_locked = true THEN
      RAISE EXCEPTION
        'enforce_role_permissions_locked: parent role % is locked; % on role_permissions is forbidden',
        NEW.role_id, TG_OP;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT locked
      INTO v_old_locked
      FROM public.roles
     WHERE id = OLD.role_id;

    SELECT locked
      INTO v_new_locked
      FROM public.roles
     WHERE id = NEW.role_id;

    IF v_old_locked = true OR v_new_locked = true THEN
      RAISE EXCEPTION
        'enforce_role_permissions_locked: parent role % is locked; % on role_permissions is forbidden',
        COALESCE(OLD.role_id, NEW.role_id), TG_OP;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT locked
      INTO v_old_locked
      FROM public.roles
     WHERE id = OLD.role_id;

    IF v_old_locked = true THEN
      RAISE EXCEPTION
        'enforce_role_permissions_locked: parent role % is locked; % on role_permissions is forbidden',
        OLD.role_id, TG_OP;
    END IF;

    RETURN OLD;
  END IF;

  -- Unreachable in practice; defensive return.
  RETURN NULL;
END;
$$;

CREATE TRIGGER enforce_role_permissions_locked_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_permissions_locked();
