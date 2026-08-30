-- ============================================================
-- 023_custom_team_roles.sql
-- Lets a coach create/edit custom staff roles with a checklist of
-- the permission strings that are actually enforced anywhere in
-- this codebase (verified against every has_permission() call in
-- 008_rls_policies.sql and 010_rpc_functions.sql): clients:read_
-- team_scope, billing:manage, modify_plans, mark_payment. Every
-- other permission string in ROLE_SEED_MATRIX.md is seeded but
-- unenforced, so it is deliberately NOT exposed here.
--
-- roles had no coach_id (fully global table) — fine for the 6
-- shared system roles, wrong for per-coach custom ones: it would
-- force role names to be unique across the whole platform and let
-- every coach see every other coach's custom role names. Adding a
-- nullable coach_id (NULL = system/global role) and re-scoping the
-- SELECT policy fixes both. Uniqueness moves from a bare UNIQUE(name)
-- to UNIQUE(coach_id, name) — the RPC below always sets coach_id to
-- the calling coach, so end users can never create another
-- coach_id=NULL row and hit Postgres's per-NULL-not-equal-NULL
-- uniqueness quirk; only the 6 pre-seeded system rows have NULL.
-- ============================================================

ALTER TABLE public.roles
  ADD COLUMN coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE;

ALTER TABLE public.roles
  DROP CONSTRAINT roles_name_key;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_coach_id_name_key UNIQUE (coach_id, name);

DROP POLICY IF EXISTS roles_authenticated_select ON public.roles;

CREATE POLICY roles_select_global_or_own_tenant ON public.roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    coach_id IS NULL
    OR coach_id = private.get_my_coach_id()
  );

-- ── create_custom_role ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_name              text,
  p_description       text    DEFAULT NULL,
  p_read_team_scope   boolean DEFAULT false,
  p_billing_manage    boolean DEFAULT false,
  p_modify_plans      boolean DEFAULT false,
  p_mark_payment      boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role_id uuid;
  v_name    text;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  v_name := trim(p_name);
  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'role name must be 1-100 characters';
  END IF;

  BEGIN
    INSERT INTO public.roles (coach_id, name, description, is_default, locked)
    VALUES (auth.uid(), v_name, nullif(trim(coalesce(p_description, '')), ''), false, false)
    RETURNING id INTO v_role_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'you already have a role named "%"', v_name;
  END;

  IF p_read_team_scope THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (v_role_id, 'clients:read_team_scope', true);
  END IF;
  IF p_billing_manage THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (v_role_id, 'billing:manage', true);
  END IF;
  IF p_modify_plans THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (v_role_id, 'modify_plans', true);
  END IF;
  IF p_mark_payment THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (v_role_id, 'mark_payment', true);
  END IF;

  RETURN v_role_id;
END;
$$;

-- ── update_custom_role_permissions ──────────────────────────
-- Edits an existing custom role's description + permission set.
-- Refuses to touch locked (system) roles or another coach's role.
CREATE OR REPLACE FUNCTION public.update_custom_role_permissions(
  p_role_id           uuid,
  p_description       text    DEFAULT NULL,
  p_read_team_scope   boolean DEFAULT false,
  p_billing_manage    boolean DEFAULT false,
  p_modify_plans      boolean DEFAULT false,
  p_mark_payment      boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_locked   boolean;
  v_coach_id uuid;
BEGIN
  IF private.get_my_role() != 'coach' THEN
    RAISE EXCEPTION 'permission denied: coach only';
  END IF;

  SELECT locked, coach_id INTO v_locked, v_coach_id
    FROM public.roles
   WHERE id = p_role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role not found';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION 'system roles cannot be edited';
  END IF;
  IF v_coach_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'role not found in your workspace';
  END IF;

  UPDATE public.roles
     SET description = nullif(trim(coalesce(p_description, '')), ''),
         updated_at  = now()
   WHERE id = p_role_id;

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  IF p_read_team_scope THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (p_role_id, 'clients:read_team_scope', true);
  END IF;
  IF p_billing_manage THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (p_role_id, 'billing:manage', true);
  END IF;
  IF p_modify_plans THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (p_role_id, 'modify_plans', true);
  END IF;
  IF p_mark_payment THEN
    INSERT INTO public.role_permissions (role_id, permission, granted) VALUES (p_role_id, 'mark_payment', true);
  END IF;
END;
$$;
