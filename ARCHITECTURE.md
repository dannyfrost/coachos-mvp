# Architecture — CoachOS (one-page index)

## Repo layout

```
apps/
  web/      Next.js 14 — Coach Web App + Super Admin Panel
  mobile/   React Native + Expo — Client Mobile App
packages/
  shared/   Shared types, utils, validation schemas
  supabase/ Generated database.types.ts + client wrappers
supabase/
  migrations/  001-012 + future
  tests/gate0/ G0-01 through G0-12
docs/      Specs, design briefs, this handoff
scripts/   Local dev utilities
```

## Multi-tenant model

- Single identity table: `platform_users` (coach / assistant / client / super_admin)
- Extension tables: `coaches`, `clients` (id = platform_users.id)
- Every tenant-scoped table has `coach_id` column
- Composite FKs ensure same-tenant references
- RLS scopes every query by `coach_id` matched against the authenticated user's tenant
- Helper functions in `private` schema resolve tenant once per request

## Security layers (in order)

1. Supabase Auth — JWT identity
2. RLS on every public table — default-deny, role-aware
3. Composite FKs — last-line tenant integrity (fires even when RLS is bypassed by service role)
4. Triggers — role-type consistency, locked-role protection
5. Server-side service-layer ownership checks — app-layer belt-and-suspenders

## Data flow — flash card

new daily_log → trigger or RPC → recompute flash_card row → coach dashboard reads via RLS-filtered SELECT → flash card grid renders.

Cron also runs flash card recomputation at scheduled intervals to catch absence cases (last_log_at older than threshold).

## See also

- MVP_Database_Schema_Final.docx — table definitions
- MVP_RLS_Policy_Definitions.docx — RLS policies
- MVP_API_Endpoint_Spec.docx — RPCs and HTTP routes
- MVP_Screen_Spec.docx — screen wireframes