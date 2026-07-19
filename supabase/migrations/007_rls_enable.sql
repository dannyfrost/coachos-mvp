-- ============================================================
-- Migration: 007_rls_enable
-- Purpose:   Enable Row Level Security on all 16 MVP-core
--            tables in the public schema.
-- Depends on: 006_private_schema.sql
-- Order:     7 of 12 (Tier 0)
--
-- Gate 0 reference:
--   G0-11 — Default-deny: tables with no policies return zero
--   rows to non-service roles. Verified in the Gate 0 suite
--   after all Tier 0 migrations are deployed.
--
-- Notes:
--   - No RLS policies are created here. Policies live in
--     008_rls_policies.sql.
--   - No FORCE ROW LEVEL SECURITY. The postgres / service_role
--     superuser bypasses RLS by Supabase design. FORCE is not
--     used here.
--   - VIP tables excluded (vip_groups, vip_group_members,
--     vip_group_posts, vip_post_reactions) — VIP is OUT of
--     MVP-core per DECISIONS.md P-01.
-- ============================================================


-- Table order matches creation order in 002_create_tables.sql.

ALTER TABLE public.platform_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
