# ROLE_SEED_MATRIX.md

**Project:** Coaching Platform MVP  
**Purpose:** Canonical definition of every seeded role and its exact permission strings. Used to generate migration 013 (seed data).  
**Status:** FINAL — all items resolved. Ready for T0-11.  
**Last updated:** 2026-05-16 — Item 1 (suspend/ban/restore OUT of MVP), Item 6 (permission audit complete), billing_operations model confirmed, modify_plans and mark_payment added.

---

## Role Taxonomy

This project uses a two-layer role model:

### Layer 1 — Platform role type (`platform_users.role_type`)

Stored as the `public.role_type` enum. Drives `private.get_my_role()` in RLS policies.  
Only four values exist: `super_admin`, `coach`, `assistant`, `client`.

- All assistant-type users (standard assistant, senior assistant, billing operations) share `role_type = 'assistant'`.
- RLS policies gate on this value first (broad access class).

### Layer 2 — Staff role (`staff_assignments.role_id` → `roles.id`)

Assigned when a user is added as staff to a workspace. Drives `private.has_permission()`.  
Rows in the `roles` table include: `assistant`, `senior_assistant`, `billing_operations`.

- Standard assistant: `staff_assignments.role_id` → `roles.name = 'assistant'`
- Senior assistant: `staff_assignments.role_id` → `roles.name = 'senior_assistant'`
- Billing operations: `staff_assignments.role_id` → `roles.name = 'billing_operations'`
- `private.has_permission(p)` queries `staff_assignments.role_id → role_permissions` for the active assignment.

**Implication:** `billing_operations` is NOT a `platform_users.role_type` value. Do not add it to the `public.role_type` enum. Billing operations staff are stored as `role_type = 'assistant'` with a `staff_assignments` row pointing to the `billing_operations` role.

---

## Seeded Roles — `roles` table (6 rows)

These rows are inserted by migration 013 (`013_seed_data`). All are system roles (`locked = true`). Must not be created by users. Every role listed here must appear exactly as written.

| Role name | Platform role_type | Description |
|---|---|---|
| `super_admin` | `super_admin` | Platform owner. Moderation access. No message content. |
| `coach` | `coach` | Workspace owner. Full tenant access. |
| `assistant` | `assistant` | Standard coach team member. Assigned clients only. |
| `senior_assistant` | `assistant` | Elevated coach team member. Full tenant client scope. |
| `billing_operations` | `assistant` | Billing-focused staff. No client data access. |
| `client` | `client` | End user. Own data only. |

Note: The "Platform role_type" column documents what value these users carry in `platform_users.role_type`. `senior_assistant` and `billing_operations` are not enum values — they are role names only.

---

## Permission String Format

```
resource:action
```

Examples: `clients:read`, `flash_cards:read`, `messages:write`, `billing:manage`

All permission checks are enforced server-side via RLS policies and RPC guards. Permission strings in this file document the intended access, not the enforcement mechanism.

---

## Role Permission Matrix

### `super_admin`

| Permission | Granted | Notes |
|---|---|---|
| `tenants:read` | YES | Can view all tenants |
| `billing:read` | YES | Can view billing status of any tenant |
| `audit_log:read` | YES | Platform-wide audit log access |
| `clients:read` | YES | Can read any client record for moderation |
| `messages:read` | NO | Super_admin does not see message content — confirmed 2026-05-15 |
| `tenants:suspend` | OUT OF MVP | Blocked on MVP_SCOPE_LOCK.md P-03 — do not seed |
| `users:ban` | OUT OF MVP | Blocked on MVP_SCOPE_LOCK.md P-03 — do not seed |
| `users:restore` | OUT OF MVP | Blocked on MVP_SCOPE_LOCK.md P-03 — do not seed |

> **Seed only the YES rows.** Do not create role_permissions rows for OUT OF MVP entries.

---

### `coach`

| Permission | Granted | Notes |
|---|---|---|
| `clients:read` | YES | Own tenant only |
| `clients:write` | YES | Create and edit clients in own tenant |
| `clients:invite` | YES | Send client invites |
| `flash_cards:read` | YES | Own tenant clients only |
| `flash_cards:notes_write` | YES | Via `update_flash_card_notes` RPC |
| `daily_logs:read` | YES | Own tenant clients only |
| `messages:read` | YES | Own tenant clients only |
| `messages:write` | YES | Via RPC only (direct INSERT/UPDATE revoked) |
| `plans:read` | YES | Own tenant only |
| `plans:write` | YES | Own tenant only |
| `team:read` | YES | Own tenant team members |
| `team:invite` | YES | Invite assistants to own tenant |
| `billing:read` | YES | Own tenant subscription |
| `billing:manage` | YES | Own tenant subscription |
| `audit_log:read` | YES | Own tenant only |

Note: Coach bypasses `has_permission()` checks in RPC guards via direct role-type gating (`get_my_role() = 'coach'`). Permission rows are seeded for completeness and future use.

---

### `assistant`

Standard assistant. Assigned clients only.

| Permission | Granted | Notes |
|---|---|---|
| `clients:read` | YES | Assigned clients only |
| `flash_cards:read` | YES | Assigned clients only |
| `flash_cards:notes_write` | YES | Assigned clients only, via RPC |
| `daily_logs:read` | YES | Assigned clients only |
| `messages:read` | YES | Assigned clients only |
| `messages:write` | YES | Assigned clients only, via RPC |
| `plans:read` | YES | Assigned clients only |
| `clients:write` | NO | — |
| `clients:invite` | NO | — |
| `plans:write` | NO | — |
| `modify_plans` | NO | Plan assignment via RPC blocked for standard assistant |
| `team:read` | NO | Cannot see other team members |
| `billing:read` | NO | — |
| `billing:manage` | NO | — |
| `mark_payment` | NO | — |
| `audit_log:read` | NO | — |

> **Seed only the YES rows.**

---

### `senior_assistant`

Elevated assistant. Full tenant client scope.

| Permission | Granted | Notes |
|---|---|---|
| `clients:read` | YES | All clients in tenant |
| `flash_cards:read` | YES | All clients in tenant |
| `flash_cards:notes_write` | YES | All clients in tenant, via RPC |
| `daily_logs:read` | YES | All clients in tenant |
| `messages:read` | YES | All clients in tenant |
| `messages:write` | YES | All clients in tenant, via RPC |
| `plans:read` | YES | All clients in tenant |
| `clients:read_team_scope` | YES | Team-scope RLS differentiator — enforced via `private.has_permission('clients:read_team_scope')` in 008 |
| `team:read` | YES | Can see all team members in tenant — confirmed 2026-05-15 |
| `modify_plans` | YES | Can call `assign_plan` RPC — confirmed 2026-05-16 |
| `clients:write` | NO | Cannot create or edit client records |
| `clients:invite` | NO | — |
| `plans:write` | NO | Cannot create or archive plans |
| `billing:read` | NO | — |
| `billing:manage` | NO | — |
| `mark_payment` | NO | — |
| `audit_log:read` | NO | — |

> **Seed only the YES rows.**

---

### `billing_operations`

Billing-focused assistant profile. No client data access.  
`platform_users.role_type = 'assistant'`. Differentiated from standard assistant via `staff_assignments.role_id → billing_operations`.

| Permission | Granted | Notes |
|---|---|---|
| `billing:read` | YES | Own tenant subscription |
| `billing:manage` | YES | Upgrade / downgrade / cancel — gated via `has_permission('billing:manage')` in 008 |
| `mark_payment` | YES | Can call `confirm_client_payment` RPC — confirmed 2026-05-16 |
| `clients:read` | NO | No access to client data |
| `flash_cards:read` | NO | — |
| `flash_cards:notes_write` | NO | — |
| `daily_logs:read` | NO | — |
| `messages:read` | NO | — |
| `messages:write` | NO | — |
| `plans:read` | NO | — |
| `modify_plans` | NO | — |
| `team:read` | NO | — |
| `audit_log:read` | NO | — |

> **Seed only the YES rows.**

---

### `client`

| Permission | Granted | Notes |
|---|---|---|
| `own_profile:read` | YES | Own record only |
| `daily_logs:write` | YES | Own logs only, via RPC |
| `daily_logs:read` | YES | Own logs only |
| `messages:read` | YES | Own conversation only |
| `messages:write` | YES | Own conversation only, via RPC |
| `plans:read` | YES | Own assigned plan only |
| `meal_photos:upload` | YES | Own tenant-scoped storage path only |
| `own_profile:write` | NO | Deferred to RPC (S-08) |
| `flash_cards:read` | NO | Client cannot see their own flash card |

> **Seed only the YES rows.**

---

## Seed Summary — role_permissions rows to insert

| Role | Permissions (granted=true) | Count |
|---|---|---|
| super_admin | tenants:read, billing:read, audit_log:read, clients:read | 4 |
| coach | clients:read, clients:write, clients:invite, flash_cards:read, flash_cards:notes_write, daily_logs:read, messages:read, messages:write, plans:read, plans:write, team:read, team:invite, billing:read, billing:manage, audit_log:read | 15 |
| assistant | clients:read, flash_cards:read, flash_cards:notes_write, daily_logs:read, messages:read, messages:write, plans:read | 7 |
| senior_assistant | clients:read, flash_cards:read, flash_cards:notes_write, daily_logs:read, messages:read, messages:write, plans:read, clients:read_team_scope, team:read, modify_plans | 10 |
| billing_operations | billing:read, billing:manage, mark_payment | 3 |
| client | own_profile:read, daily_logs:write, daily_logs:read, messages:read, messages:write, plans:read, meal_photos:upload | 7 |
| **Total** | | **46** |

---

## Open Items Before Migration 013

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Super admin suspend/ban/restore permissions (IN or OUT) | Founder | RESOLVED — OUT of MVP (2026-05-16). Do not seed. |
| 2 | Super admin `messages:read` access | Founder | RESOLVED — NO (2026-05-15) |
| 3 | Senior assistant `team:read` access | Founder | RESOLVED — YES (2026-05-15) |
| 4 | Senior assistant `audit_log:read` access | Founder | RESOLVED — NO (2026-05-15) |
| 5 | Client `own_profile:write` access | Founder | RESOLVED — NO, deferred to RPC (S-08) (2026-05-15) |
| 6 | Confirm all permission strings match RLS/RPC checks | Tech review | RESOLVED — audit complete (2026-05-16). modify_plans added to senior_assistant; mark_payment added to billing_operations; billing_operations role model confirmed as staff role, not platform_users.role_type. |

> All items resolved. Migration 013 may proceed.
