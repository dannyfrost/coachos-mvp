-- ============================================================
-- 024_fix_custom_role_rpc_grants.sql
-- create_custom_role and update_custom_role_permissions (023)
-- were missing explicit grants. Supabase grants EXECUTE on every
-- new function to anon/authenticated/service_role automatically
-- at the project level — this is a SEPARATE grant from PUBLIC, so
-- the REVOKE ... FROM PUBLIC pattern used elsewhere in this project
-- (010_rpc_functions.sql) does not actually remove anon's access.
-- Revoking anon explicitly here (not just PUBLIC) actually closes
-- the gap for these two functions. A full audit of the existing
-- ~23 RPCs for the same gap is tracked as separate follow-up work,
-- not done in this migration.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.create_custom_role(text, text, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_custom_role_permissions(uuid, text, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_custom_role(text, text, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_custom_role_permissions(uuid, text, boolean, boolean, boolean, boolean) TO authenticated;
