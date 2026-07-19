-- ============================================================
-- Migration: 009_csa_staff_id_idx
-- Purpose:   Add staff_id-leading index on client_staff_assignments.
--            Required by client_staff_assignments_assistant_select_own
--            RLS policy (008_rls_policies) which filters by
--            staff_id = auth.uid() without binding client_id.
--            The existing UNIQUE(client_id, staff_id) from 002 has
--            client_id as the leading column and cannot serve this
--            predicate efficiently.
-- Depends on: 002_create_tables
-- Order:     9 of 13 (Tier 0 -- slots between 008 and 010)
-- Decision:  T0-04 deferred item resolved 2026-05-15
-- ============================================================

CREATE INDEX client_staff_assignments_staff_id_idx
  ON public.client_staff_assignments (staff_id);
