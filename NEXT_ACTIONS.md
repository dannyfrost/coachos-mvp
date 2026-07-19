# Next Actions — CoachOS

**As of:** 2026-05-11

## The single next thing

Decide: bootstrap local Supabase NOW, or defer to T0-13?
Recommendation: NOW. Cost ~30-60 min. Verifies migrations 001-006a actually work before layering 5 more on top.

## After that decision

Path A (bootstrap now):
1. Install Supabase CLI + Docker Desktop
2. supabase init + supabase start
3. supabase db reset (applies 001-006a)
4. Verify all objects in psql / Studio
5. Then write T0-06b (007_rls_enable.sql)

Path B (defer):
1. Write T0-06b on paper
2. Continue through T0-12
3. Then bootstrap and resolve all errors as a batch

## Open product decisions ranked by urgency

1. Flash card thresholds — needed before Tier 2
2. Senior Assistant permission profile — needed before T0-12 (seed)
3. Mobile pilot platform — needed before Tier 5
4. Admin scope decisions — needed before admin tier