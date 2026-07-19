-- ============================================================
-- Migration: 008_rls_policies
-- Purpose:   Create all 82 RLS policies across 16 MVP-core
--            public schema tables.
-- Depends on: 007_rls_enable.sql, 006_private_schema.sql
-- Order:     8 of 12 (Tier 0)
--
-- Gate 0 reference:
--   G0-11 -- Default-deny plus explicit allow policies verified
--   G0-12 -- Private helpers exercised through policy evaluation
--
-- Total policies: 82
--   platform_users           5  (SELECT only -- S-08)
--   roles                    1
--   role_permissions         1
--   coaches                  3
--   coach_subscriptions      3
--   clients                  7
--   client_subscriptions     6
--   staff_assignments        7
--   client_staff_assignments 8
--   daily_logs               7
--   flash_cards              4  (SELECT only -- S-03)
--   plans                    8
--   plan_assignments         8
--   messages                 4  (SELECT only -- S-07, S-03)
--   absence_events           8
--   audit_logs               2
--
-- Security notes:
--   S-03 -- Direct UPDATE on flash_cards revoked in 010.
--            No UPDATE or INSERT policy here.
--   S-07 -- No INSERT on messages; message send is RPC-only
--            (009_rpc_functions).
--   S-08 -- No UPDATE on platform_users; client UPDATE on
--            clients deferred to RPC (009_rpc_functions).
--   S-04 -- All helper functions are in the private schema
--            and are not callable via PostgREST.
--   P-01 -- VIP feature tables excluded per DECISIONS.md P-01.
-- ============================================================


-- ============================================================
-- platform_users -- 5 SELECT (no UPDATE per S-08)
-- ============================================================

CREATE POLICY platform_users_super_admin_select ON public.platform_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY platform_users_self_select ON public.platform_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY platform_users_coach_select_workspace ON public.platform_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND (
      EXISTS (
        SELECT 1
          FROM public.clients cl
         WHERE cl.id = id
           AND cl.coach_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
          FROM public.staff_assignments sa
         WHERE sa.user_id = id
           AND sa.coach_id = auth.uid()
      )
    )
  );

CREATE POLICY platform_users_assistant_select ON public.platform_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND (
      id = private.get_my_coach_id()
      OR private.is_my_assigned_client(id)
    )
  );

-- senior_assistant sees all tenant members (coaches, clients, active
-- staff) via is_tenant_member -- covers team:read per N-09.
CREATE POLICY platform_users_senior_assistant_select_team ON public.platform_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND private.is_tenant_member(id)
  );


-- ============================================================
-- roles -- 1 SELECT
-- ============================================================

CREATE POLICY roles_authenticated_select ON public.roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- role_permissions -- 1 SELECT
-- ============================================================

CREATE POLICY role_permissions_authenticated_select ON public.role_permissions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- coaches -- 2 SELECT + 1 UPDATE
-- ============================================================

CREATE POLICY coaches_super_admin_select ON public.coaches
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY coaches_tenant_member_select ON public.coaches
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() IN ('coach', 'assistant', 'client')
    AND id = private.get_my_coach_id()
  );

CREATE POLICY coaches_coach_update_own ON public.coaches
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND id = auth.uid()
  );


-- ============================================================
-- coach_subscriptions -- 3 SELECT (no write; Stripe uses service role)
-- ============================================================

CREATE POLICY coach_subscriptions_super_admin_select ON public.coach_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY coach_subscriptions_coach_select_own ON public.coach_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY coach_subscriptions_billing_assistant_select ON public.coach_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('billing:manage')
    AND coach_id = private.get_my_coach_id()
  );


-- ============================================================
-- clients -- 5 SELECT + 1 INSERT + 1 UPDATE (no client UPDATE per S-08)
-- ============================================================

CREATE POLICY clients_super_admin_select ON public.clients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY clients_coach_select ON public.clients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY clients_assistant_select_assigned ON public.clients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(id)
  );

CREATE POLICY clients_senior_assistant_select_team ON public.clients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY clients_client_select_own ON public.clients
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND id = auth.uid()
  );

CREATE POLICY clients_coach_insert ON public.clients
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY clients_coach_update ON public.clients
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- client_subscriptions -- 4 SELECT + 1 INSERT + 1 UPDATE
-- ============================================================

CREATE POLICY client_subscriptions_super_admin_select ON public.client_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY client_subscriptions_coach_select ON public.client_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

-- Regular and senior assistant merged into one policy to hold total at 4 SELECT.
CREATE POLICY client_subscriptions_assistant_select ON public.client_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND (
      private.is_my_assigned_client(client_id)
      OR (
        private.has_permission('clients:read_team_scope')
        AND coach_id = private.get_my_coach_id()
      )
    )
  );

CREATE POLICY client_subscriptions_client_select_own ON public.client_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY client_subscriptions_coach_insert ON public.client_subscriptions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY client_subscriptions_coach_update ON public.client_subscriptions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- staff_assignments -- 4 SELECT + 1 INSERT + 1 UPDATE + 1 DELETE
-- ============================================================

CREATE POLICY staff_assignments_super_admin_select ON public.staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY staff_assignments_coach_select ON public.staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY staff_assignments_assistant_select_own ON public.staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND user_id = auth.uid()
  );

CREATE POLICY staff_assignments_senior_assistant_select_team ON public.staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY staff_assignments_coach_insert ON public.staff_assignments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY staff_assignments_coach_update ON public.staff_assignments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY staff_assignments_coach_delete ON public.staff_assignments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- client_staff_assignments -- 5 SELECT + 1 INSERT + 1 UPDATE + 1 DELETE
-- ============================================================

CREATE POLICY client_staff_assignments_super_admin_select ON public.client_staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY client_staff_assignments_coach_select ON public.client_staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY client_staff_assignments_assistant_select_own ON public.client_staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND staff_id = auth.uid()
  );

CREATE POLICY client_staff_assignments_senior_assistant_select_team ON public.client_staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY client_staff_assignments_client_select_own ON public.client_staff_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY client_staff_assignments_coach_insert ON public.client_staff_assignments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY client_staff_assignments_coach_update ON public.client_staff_assignments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY client_staff_assignments_coach_delete ON public.client_staff_assignments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- daily_logs -- 5 SELECT + 1 INSERT + 1 UPDATE
-- ============================================================

CREATE POLICY daily_logs_super_admin_select ON public.daily_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY daily_logs_coach_select ON public.daily_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY daily_logs_assistant_select_assigned ON public.daily_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );

CREATE POLICY daily_logs_senior_assistant_select_team ON public.daily_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY daily_logs_client_select_own ON public.daily_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY daily_logs_client_insert ON public.daily_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
    AND coach_id = private.get_my_coach_id()
  );

-- WITH CHECK adds coach_id guard to prevent cross-tenant row jumping.
CREATE POLICY daily_logs_client_update_own ON public.daily_logs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
    AND coach_id = private.get_my_coach_id()
  );


-- ============================================================
-- flash_cards -- 4 SELECT only
-- No INSERT, UPDATE, or DELETE (S-03). Direct UPDATE revoked in 010.
-- No client SELECT -- clients cannot see their own flash card.
-- ============================================================

CREATE POLICY flash_cards_super_admin_select ON public.flash_cards
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY flash_cards_coach_select ON public.flash_cards
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY flash_cards_senior_assistant_select ON public.flash_cards
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY flash_cards_assistant_select ON public.flash_cards
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );


-- ============================================================
-- plans -- 5 SELECT + 1 INSERT + 1 UPDATE + 1 DELETE
-- plans has no client_id column; client access gated via plan_assignments.
-- ============================================================

CREATE POLICY plans_super_admin_select ON public.plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY plans_coach_select ON public.plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plans_assistant_select_assigned ON public.plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND EXISTS (
      SELECT 1
        FROM public.plan_assignments pa
       WHERE pa.plan_id = id
         AND private.is_my_assigned_client(pa.client_id)
    )
  );

CREATE POLICY plans_senior_assistant_select_team ON public.plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

-- Client can SELECT a plan only if they have an active assignment.
CREATE POLICY plans_client_select_assigned ON public.plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND EXISTS (
      SELECT 1
        FROM public.plan_assignments pa
       WHERE pa.plan_id = id
         AND pa.client_id = auth.uid()
         AND pa.status = 'active'
    )
  );

CREATE POLICY plans_coach_insert ON public.plans
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plans_coach_update ON public.plans
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plans_coach_delete ON public.plans
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- plan_assignments -- 5 SELECT + 1 INSERT + 1 UPDATE + 1 DELETE
-- ============================================================

CREATE POLICY plan_assignments_super_admin_select ON public.plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY plan_assignments_coach_select ON public.plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plan_assignments_assistant_select_assigned ON public.plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );

CREATE POLICY plan_assignments_senior_assistant_select_team ON public.plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY plan_assignments_client_select_own ON public.plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY plan_assignments_coach_insert ON public.plan_assignments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plan_assignments_coach_update ON public.plan_assignments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY plan_assignments_coach_delete ON public.plan_assignments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );


-- ============================================================
-- messages -- 4 SELECT only
-- No INSERT per S-07 (message send is RPC-only).
-- No UPDATE per S-03 (direct UPDATE revoked in 010_revoke_grants).
-- No super_admin SELECT (founder decision 2026-05-15).
-- ============================================================

CREATE POLICY messages_coach_select ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY messages_sender_select ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY messages_recipient_select ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- Assistant reads messages for assigned clients; senior assistant
-- additionally granted by has_permission check (team scope).
CREATE POLICY messages_assistant_select ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND coach_id = private.get_my_coach_id()
    AND (
      private.is_my_assigned_client(sender_id)
      OR private.is_my_assigned_client(recipient_id)
      OR private.has_permission('clients:read_team_scope')
    )
  );


-- ============================================================
-- absence_events -- 5 SELECT + 3 UPDATE
-- ============================================================

CREATE POLICY absence_events_super_admin_select ON public.absence_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY absence_events_coach_select ON public.absence_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY absence_events_assistant_select_assigned ON public.absence_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );

CREATE POLICY absence_events_senior_assistant_select_team ON public.absence_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY absence_events_client_select_own ON public.absence_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY absence_events_coach_update ON public.absence_events
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  )
  WITH CHECK (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

CREATE POLICY absence_events_senior_assistant_update ON public.absence_events
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  )
  WITH CHECK (
    private.get_my_role() = 'assistant'
    AND private.has_permission('clients:read_team_scope')
    AND coach_id = private.get_my_coach_id()
  );

CREATE POLICY absence_events_assistant_update ON public.absence_events
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  )
  WITH CHECK (
    private.get_my_role() = 'assistant'
    AND private.is_my_assigned_client(client_id)
  );


-- ============================================================
-- audit_logs -- 2 SELECT
-- ============================================================

CREATE POLICY audit_logs_super_admin_select ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.get_my_role() = 'super_admin');

CREATE POLICY audit_logs_coach_select ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    private.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );
