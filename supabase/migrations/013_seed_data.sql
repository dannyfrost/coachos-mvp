-- ============================================================
-- Migration: 013_seed_data
-- Purpose:   Seed locked roles and role_permissions for MVP permission model.
--            Depends on: 001-012
-- Order:     13 of 13 (Tier 0)
--
-- Roles seeded (6): super_admin, coach, assistant, senior_assistant,
--   billing_operations, client
-- Permissions seeded (46): see INSERT block below
--
-- All roles: is_default = false, locked = true (set in step 3)
-- All permissions: granted = true
-- Idempotent: 3 sequential statements; each is safe to re-run.
--
-- Trigger interaction (005_triggers.sql):
--   enforce_role_permissions_locked: blocks INSERT on role_permissions
--     when parent role.locked = true. Fix: step 1 inserts roles with
--     locked = false. Step 2 inserts permissions (trigger allows because
--     locked = false). Step 3 locks roles (enforce_roles_locked allows
--     because OLD.locked = false).
--
--   PostgreSQL CTE snapshot isolation note: a single CTE statement
--     cannot UPDATE rows that were INSERT-ed in the same statement
--     (same snapshot). Three sequential statements are required so
--     each statement sees the committed effects of the previous one.
--
-- NOT seeded (P-03 / S-08):
--   tenants:suspend, users:ban, users:restore — OUT of MVP
--   own_profile:write — deferred to RPC (S-08)
--   flash_cards:read for client — client cannot see own flash card
-- ============================================================

-- Step 1: Insert roles with locked = false so step 2 can insert permissions.
INSERT INTO public.roles (name, description, is_default, locked)
VALUES
  ('super_admin',        'Platform owner. Platform-wide moderation access. No message content.', false, false),
  ('coach',              'Workspace owner. Full tenant access.',                                  false, false),
  ('assistant',          'Standard coach team member. Assigned clients only.',                   false, false),
  ('senior_assistant',   'Elevated coach team member. Full tenant client scope.',                false, false),
  ('billing_operations', 'Billing-focused staff. No client data access.',                        false, false),
  ('client',             'End user. Own data only.',                                             false, false)
ON CONFLICT (name) DO NOTHING;

-- Step 2: Insert permissions only for roles currently locked = false.
-- On re-run all roles are locked = true so this inserts 0 rows (safe).
INSERT INTO public.role_permissions (role_id, permission, granted)
SELECT r.id, p.permission, true
FROM public.roles r
JOIN (VALUES
  ('super_admin',        'tenants:read'),
  ('super_admin',        'billing:read'),
  ('super_admin',        'audit_log:read'),
  ('super_admin',        'clients:read'),
  ('coach',              'clients:read'),
  ('coach',              'clients:write'),
  ('coach',              'clients:invite'),
  ('coach',              'flash_cards:read'),
  ('coach',              'flash_cards:notes_write'),
  ('coach',              'daily_logs:read'),
  ('coach',              'messages:read'),
  ('coach',              'messages:write'),
  ('coach',              'plans:read'),
  ('coach',              'plans:write'),
  ('coach',              'team:read'),
  ('coach',              'team:invite'),
  ('coach',              'billing:read'),
  ('coach',              'billing:manage'),
  ('coach',              'audit_log:read'),
  ('assistant',          'clients:read'),
  ('assistant',          'flash_cards:read'),
  ('assistant',          'flash_cards:notes_write'),
  ('assistant',          'daily_logs:read'),
  ('assistant',          'messages:read'),
  ('assistant',          'messages:write'),
  ('assistant',          'plans:read'),
  ('senior_assistant',   'clients:read'),
  ('senior_assistant',   'flash_cards:read'),
  ('senior_assistant',   'flash_cards:notes_write'),
  ('senior_assistant',   'daily_logs:read'),
  ('senior_assistant',   'messages:read'),
  ('senior_assistant',   'messages:write'),
  ('senior_assistant',   'plans:read'),
  ('senior_assistant',   'clients:read_team_scope'),
  ('senior_assistant',   'team:read'),
  ('senior_assistant',   'modify_plans'),
  ('billing_operations', 'billing:read'),
  ('billing_operations', 'billing:manage'),
  ('billing_operations', 'mark_payment'),
  ('client',             'own_profile:read'),
  ('client',             'daily_logs:write'),
  ('client',             'daily_logs:read'),
  ('client',             'messages:read'),
  ('client',             'messages:write'),
  ('client',             'plans:read'),
  ('client',             'meal_photos:upload')
) AS p(role_name, permission) ON p.role_name = r.name
WHERE r.locked = false
ON CONFLICT (role_id, permission) DO NOTHING;

-- Step 3: Lock all 6 seed roles. Only updates rows where locked = false
-- so enforce_roles_locked (OLD.locked = false) does not block this.
-- On re-run locked = true rows are excluded by WHERE; 0 rows updated.
UPDATE public.roles
SET    locked = true
WHERE  name IN (
  'super_admin',
  'coach',
  'assistant',
  'senior_assistant',
  'billing_operations',
  'client'
)
AND locked = false;
