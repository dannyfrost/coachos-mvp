-- ============================================================
-- Migration: 012_storage_policies
-- Purpose:   Create tenant-media storage bucket and 6 RLS
--            policies on storage.objects.
--            Depends on: 001–011
-- Order:     12 of 13 (Tier 0)
--
-- Gate 0 test: G0-10 (storage bucket isolation)
--
-- Bucket: tenant-media
--   Path convention: {coach_id}/{client_id}/{filename}
--   Path helpers used:
--     storage.foldername(name)  → text[]
--     storage.filename(name)    → text
--
-- Policies (6):
--   tenant_media_coach_insert     INSERT coach uploads any client folder in own tenant
--   tenant_media_client_insert    INSERT client uploads own folder under own coach
--   tenant_media_coach_select     SELECT coach reads all media in own tenant
--   tenant_media_assistant_select SELECT assistant reads assigned-client media only
--   tenant_media_client_select    SELECT client reads own media only
--   tenant_media_coach_delete     DELETE coach deletes any media in own tenant
--
-- No UPDATE policies: files are immutable (upload new, delete old).
-- No assistant INSERT in MVP.
-- ============================================================

-- ─────────────────────────────────────────
-- BUCKET
-- ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-media',
  'tenant-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- POLICIES
-- ─────────────────────────────────────────

-- Policy 1: coach INSERT
CREATE POLICY tenant_media_coach_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = auth.uid()
    AND private.get_my_role() = 'coach'
  );

-- Policy 2: client INSERT
CREATE POLICY tenant_media_client_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = private.get_my_coach_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
    AND private.get_my_role() = 'client'
  );

-- Policy 3: coach SELECT
CREATE POLICY tenant_media_coach_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = auth.uid()
    AND private.get_my_role() = 'coach'
  );

-- Policy 4: assistant SELECT (assigned clients only)
CREATE POLICY tenant_media_assistant_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = private.get_my_coach_id()
    AND private.is_my_assigned_client(
          (storage.foldername(name))[2]::uuid
        )
    AND private.get_my_role() = 'assistant'
  );

-- Policy 5: client SELECT (own media only)
CREATE POLICY tenant_media_client_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = private.get_my_coach_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
    AND private.get_my_role() = 'client'
  );

-- Policy 6: coach DELETE
CREATE POLICY tenant_media_coach_delete
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tenant-media'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1]::uuid = auth.uid()
    AND private.get_my_role() = 'coach'
  );
