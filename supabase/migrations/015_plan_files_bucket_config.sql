-- ============================================================
-- Migration: 015_plan_files_bucket_config
-- Purpose:   Allow PDF plan attachments (workout/diet plans) in
--            addition to the existing image/jpeg + image/png
--            (daily-log meal photos). Bumps the per-file size
--            limit from 5MB to 10MB to accommodate multi-page
--            scanned PDFs.
-- Order:     15 (post-Tier-1)
-- ============================================================

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'],
       file_size_limit    = 10485760
 WHERE id = 'tenant-media';
