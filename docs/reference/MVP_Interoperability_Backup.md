**Interoperability & Backup**

Coaching Platform — MVP Architecture Extension

Migration • Coexistence • Backup • Recovery • Media Retention

# Interoperability Strategy

## Purpose

**Define how the platform handles data coming from outside (migration) and data that must remain synchronized with external tools (coexistence). This strategy prevents premature integration complexity while ensuring coaches can adopt the platform without losing their existing data or workflows.**

## Interoperability Modes

| **Mode** | **Direction** | **Complexity** | **Priority** |
| --- | --- | --- | --- |
| **Migration In** | **External → Platform** | **Medium** | **High — coaches switching from other tools need this** |
| **Coexistence** | **External ↔ Platform (limited)** | **High** | **Medium — some coaches cannot fully leave existing tools** |
| **Migration Out** | **Platform → External** | **Low** | **Low — data export for leaving coaches (post-MVP)** |
| **Bidirectional Sync** | **External ↔ Platform (live)** | **Very High** | **Not recommended for MVP or near-term** |

## Strategic Recommendation

**Migration In is the highest-value interoperability investment. A coach who cannot bring their client list, plans, or history will hesitate to switch. Coexistence is secondary — useful for coaches who must keep WhatsApp groups or spreadsheets alongside the platform, but should not drive architecture decisions. Bidirectional live sync is explicitly out of scope: it creates data consistency nightmares, doubles the maintenance surface, and rarely works well in early-stage products.**

## Supported Data Modes

| **Mode** | **Definition** | **Source of Truth** | **Examples** |
| --- | --- | --- | --- |
| **Native** | **Created inside the platform** | **Platform (always)** | **Client created via invite, plan built in editor** |
| **Imported** | **Brought in from external source, now owned by platform** | **Platform (after import)** | **CSV client list, migrated meal plans** |
| **Linked External** | **Referenced but not owned by platform** | **External tool** | **Google Sheets weight log the coach updates outside the platform** |

*At MVP, only Native data exists. Imported data is the first interoperability milestone. Linked External data is post-MVP.*

## MVP Recommendation

**Do not build any interoperability features for MVP launch.**

**Reasoning: MVP launches with a small number of pilot coaches. Manual data entry is acceptable for 5–20 clients. Building import tooling before validating the core product loop is premature. Document the interoperability strategy now so the schema and API design do not block future implementation.**

## Post-MVP Roadmap

| **Phase** | **Feature** | **Trigger** |
| --- | --- | --- |
| **Phase 1** | **CSV import for clients (name, email, age, condition notes)** | **First coach requests migration from spreadsheet** |
| **Phase 2** | **CSV import for daily logs (historical weight/steps data)** | **Coaches want continuity of tracking data** |
| **Phase 3** | **Plan import (structured JSON or CSV templates)** | **Coaches have existing plan libraries** |
| **Phase 4** | **Read-only external data linking (Google Sheets, manual sync)** | **Coaches cannot abandon external tools entirely** |
| **Phase 5** | **API-based import from known competitors (Trainerize, TrueCoach)** | **Significant competitive migration demand** |

## Source of Truth

**Rule: once data enters the platform (whether native or imported), the platform is the source of truth.**

**Imported data is treated identically to native data after import. It is not kept in sync with the external source. If the coach updates data externally after import, those changes are not reflected in the platform. This is intentional — dual source-of-truth creates unsolvable conflict scenarios.**

**Exception: Linked External data (post-MVP) explicitly acknowledges the external tool as source of truth. The platform displays it as read-only and never modifies it.**

## Conflict Handling

**For imports: last-write-wins at import time. If a client email already exists in the platform, the import row is flagged as a duplicate and skipped (not merged). The coach resolves duplicates manually.**

**For linked external data: no conflicts possible because the platform never writes to external data. Display is read-only.**

**For bidirectional sync (if ever built): not recommended. If forced, use timestamp-based conflict resolution with manual override. But this should be avoided.**

## Risks and Trade-offs

**1. Building import too early wastes effort if the core product changes significantly during pilot.**

**2. Supporting too many import formats creates maintenance burden (every format needs validation, error handling, edge case coverage).**

**3. Linked external data creates user confusion about what is editable vs read-only.**

**4. Bidirectional sync is the single largest complexity risk in any SaaS product. Avoid it.**

**5. Competitor API imports depend on those competitors maintaining stable APIs, which is not guaranteed.**

# Feature Spec — Migration In

## Goal

**Allow coaches migrating from other tools to bring their existing client data into the platform without manual re-entry. Reduce adoption friction for coaches with established client bases.**

## Supported Import Methods

| **Method** | **Format** | **Priority** |
| --- | --- | --- |
| **CSV Upload** | **Standard CSV with defined column mapping** | **Phase 1 — first to build** |
| **JSON Import** | **Structured JSON matching platform schema** | **Phase 2 — for technical coaches or API-based migrations** |
| **Competitor Export** | **Direct import from exported files of known competitors** | **Phase 5 — only if demand justifies** |

## Initial Import Scope (Phase 1)

| **Entity** | **Importable Fields** | **Notes** |
| --- | --- | --- |
| **Clients** | **full_name, email, age, condition_notes** | **Creates pending client records. Does NOT send activation tokens automatically. Coach reviews and activates individually** |
| **Daily Logs (Phase 2)** | **log_date, weight, steps, meal_description** | **Linked to existing client by email match. Historical data backfill** |
| **Plans (Phase 3)** | **title, type (meal/workout), content (text or JSON)** | **Imported as templates (is_template=true). Coach assigns individually** |

## Import Workflow

**Step 1: Coach navigates to Import screen (post-MVP screen, not in current spec).**

**Step 2: Coach uploads CSV file.**

**Step 3: System parses CSV, displays preview with column mapping.**

**Step 4: System validates rows (email format, required fields, duplicate detection).**

**Step 5: Coach reviews validation results — valid rows shown green, invalid/duplicate rows shown red with reason.**

**Step 6: Coach confirms import of valid rows.**

**Step 7: System creates records. Import job logged to audit_logs with row count and error count.**

**Step 8: Coach can download error report (CSV of skipped rows with reasons).**

## Validation Rules

**Email: required, valid format, unique within coach tenant (duplicates skipped).**

**Name: required, non-empty.**

**Age: optional, integer, 1–120.**

**Condition notes: optional, max 500 characters.**

**Log date: valid date, not in the future.**

**Weight/steps: numeric, positive.**

**Row limit per import: 500 rows maximum per batch to prevent timeout/memory issues.**

## Import Job Architecture

**Import is a server-side operation (Layer 3). File uploaded to temporary Storage path. Parsed and validated server-side. Records inserted using service role (bypasses RLS). All inserts use the coach’s coach_id for tenant scoping. Composite FK constraints ensure tenant integrity even in bulk inserts.**

## Suggested Data Model Additions

| **Table** | **Fields** | **Purpose** |
| --- | --- | --- |
| **import_jobs** | **id, coach_id, type (clients/logs/plans), file_key, status (pending/processing/completed/failed), total_rows, imported_rows, error_rows, error_report_key, created_at** | **Track import history and provide error reports** |

*This table is post-MVP. Not part of the current locked schema. Added when import feature is built.*

## Permissions

**Only coaches can import. Assistants cannot. Super Admin cannot import into coach tenants.**

## MVP vs Later

| **Phase** | **What** |
| --- | --- |
| **MVP** | **No import feature. Manual client creation via invite flow. Document this strategy** |
| **Post-MVP Phase 1** | **CSV client import with validation, preview, and error reporting** |
| **Post-MVP Phase 2** | **CSV daily log import (historical data backfill)** |
| **Post-MVP Phase 3** | **Plan template import (JSON or CSV)** |
| **Post-MVP Phase 5** | **Competitor-specific import adapters (only if demand exists)** |

# Feature Spec — Coexistence / External Tool Compatibility

## Goal

**Allow coaches who cannot fully leave external tools (Google Sheets, WhatsApp, other platforms) to use the platform alongside those tools without data conflicts or confusion.**

## Recommended First Approach

**Manual sync with clear boundaries.**

**The platform does not attempt to connect to or pull from external tools at MVP or early post-MVP. Instead, the platform provides clear workflows for coaches to manually transfer relevant data (copy-paste, re-entry, or periodic CSV re-import).**

**This is not a limitation — it is a deliberate choice. Manual sync with clear source-of-truth rules is more reliable than fragile automated integrations that break when external tools change their APIs or formats.**

## Architecture Principle

**The platform treats itself as the primary workspace. External tools are acknowledged but not integrated.**

**Practical implications: the platform never reads from or writes to external tools. It never stores credentials for external services. It never maintains a live connection to any external system. If a coach uses Google Sheets alongside the platform, they maintain both manually.**

## Source of Truth

**For any data that exists in the platform: the platform is always the source of truth.**

**For any data that exists only in an external tool: the platform has no opinion. It does not display, reference, or depend on it.**

**If a coach needs to reflect external data in the platform, they import it (using Migration In features). After import, the platform owns that data.**

## Suggested Schema Additions

**None for MVP or early post-MVP.**

**If linked external data is ever supported (Phase 4+), the schema would need:**

| **Table** | **Fields** | **Purpose** |
| --- | --- | --- |
| **external_data_links** | **id, coach_id, source_type (google_sheets/csv_url), source_url, entity_type (daily_logs/clients), last_synced_at, sync_status, created_at** | **Track linked external data sources per coach** |

*This is explicitly post-MVP. Do not build this table or any sync infrastructure for MVP.*

## Sync Workflow (Post-MVP, If Built)

**Step 1: Coach provides a read-only link to external data (e.g., Google Sheets URL).**

**Step 2: Platform reads the data on a schedule or on-demand (pull, not push).**

**Step 3: Data is displayed as read-only in the coach dashboard, clearly labeled as 'External Data'.**

**Step 4: Coach can choose to import it (converts from linked to imported/native). After import, the link is severed.**

**The platform never writes back to the external source.**

## MVP Recommendation

**Do not build any coexistence features.**

**If a coach uses external tools alongside the platform, they manage both independently. The platform provides the WhatsApp one-click-open shortcut (already in spec) as the only external tool touchpoint.**

## Post-MVP Recommendation

**Phase 4: Read-only Google Sheets linking for coaches who track weight/steps externally. Display-only, clearly labeled, no write-back.**

**Phase 5+: Evaluate deeper integrations only if user research shows strong demand. Never build bidirectional sync.**

# Backup & Recovery

## Purpose

**Define how the platform protects against data loss from system crashes, accidental deletion, cyber attacks, or infrastructure failures. This section separates platform-level disaster recovery (backup) from coach-facing data export features (product feature, covered separately).**

## Recovery Objectives

| **Metric** | **MVP Target** | **Pre-Public-Launch Target** |
| --- | --- | --- |
| **RPO (Recovery Point Objective)** | **24 hours (daily backup)** | **4–6 hours (more frequent backups)** |
| **RTO (Recovery Time Objective)** | **4–8 hours (manual restore)** | **1–2 hours (documented + tested restore)** |
| **Backup Retention** | **30 days** | **90 days (matches coach data retention policy)** |

*RPO = maximum acceptable data loss. RTO = maximum acceptable downtime to restore.*

## Data Categories

| **Category** | **What** | **Backup Method** | **Risk If Lost** |
| --- | --- | --- | --- |
| **Database** | **All 20 tables, constraints, triggers, RLS policies, functions** | **pg_dump to external storage** | **Critical — total platform loss** |
| **Storage Objects** | **Meal photos, VIP group images, import files** | **File-level copy to external storage** | **High — photos are client-submitted, irreplaceable** |
| **Auth Identities** | **auth.users (Supabase managed)** | **Included in database backup (auth schema)** | **Critical — all users lose access** |
| **Secrets/Config** | **Stripe keys, service role key, env vars** | **Not in database. Stored in Vercel/deployment env** | **High — service downtime until reconfigured** |

## MVP Backup Strategy

**Minimal but real.**

**Database: daily pg_dump at midnight, compressed, uploaded to S3-compatible external storage (recommended: Cloudflare R2 for 10GB free tier, no egress fees, separate from Supabase). This is a cron job using the service role and Supabase’s PostgreSQL connection string.**

**Storage objects: NOT backed up automatically at MVP. Accepted risk for private pilot with limited media. Coaches are informed that photos are not independently backed up during pilot.**

**Secrets/config: stored in Vercel environment variables. Documented in a secure internal runbook (not in the database or repo).**

**Restore: manual process. Download latest backup, restore to a fresh Supabase project or directly to the existing one. Documented but not automated.**

## Pre-Public-Launch Backup Strategy

**Stronger posture before real users depend on the platform.**

**Database: increase frequency to every 6 hours. Same pg_dump approach.**

**Storage objects: nightly sync of all objects in tenant-media bucket to external storage. New/modified objects detected by listing + last-modified comparison. Copied to a backup path in external storage organized by date.**

**Automated cleanup: backups older than 90 days deleted automatically.**

**Restore testing: quarterly restore drill — restore database + verify data integrity + verify RLS policies still function. Document results.**

**Monitoring: backup job failures trigger an alert (email or Slack notification to the ops team).**

## Backup Scope

| **Component** | **MVP** | **Pre-Public-Launch** |
| --- | --- | --- |
| **Database (pg_dump)** | **Daily at midnight** | **Every 6 hours** |
| **Storage objects** | **Not backed up** | **Nightly sync to external storage** |
| **Auth identities** | **Covered by database backup** | **Same** |
| **Secrets/env vars** | **Manual documentation** | **Same + rotation schedule** |
| **Backup verification** | **Manual spot-check** | **Quarterly restore drill** |
| **Retention** | **30 days** | **90 days** |
| **External storage** | **Cloudflare R2 (recommended)** | **Same** |

## Retention Policy

**MVP: 30 days of daily database backups retained. Oldest backup deleted when new one is created beyond the window.**

**Pre-public-launch: 90 days. Matches the coach data retention policy (60–90 days after cancellation).**

**Backups are immutable once created. No in-place modification.**

## Restore Principles

**1. Database restore is always a full restore, not partial. Restore to a clean Supabase project, verify, then switch DNS/config.**

**2. Storage restore (when implemented) restores files to the same bucket paths. Signed URLs will work immediately after restore because paths are preserved.**

**3. Auth restore: since auth.users is in the database, restoring the database restores auth. Users may need to re-login but their accounts are intact.**

**4. RLS policies, triggers, and functions are included in pg_dump. A restored database has the same security posture as the original.**

**5. Never restore a backup over a live database without verifying it first in an isolated environment.**

## Ownership

**Platform backup is an internal/ops responsibility. Coaches do not see, manage, or trigger platform backups. Coach-facing data export is a separate product feature (see Media Retention & Export Center below).**

## Monitoring

**MVP: backup job logs success/failure to audit_logs. Manual check by ops team.**

**Pre-public-launch: backup failure triggers automated alert (email or Slack). Consecutive failures trigger escalation.**

## MVP Decision

**Build: daily database backup cron job (pg_dump → compress → upload to R2). One Layer 3 route + one cron schedule.**

**Skip: Storage object backup, automated restore, monitoring alerts. Accepted risk for pilot.**

**Document: restore procedure, secret/config inventory, backup verification checklist.**

## Pre-Public-Launch Requirement

**Must have before public launch:**

**1. Storage object nightly backup to external storage.**

**2. 90-day retention.**

**3. Tested restore procedure (at least one successful drill).**

**4. Backup failure alerting.**

# Backup API Additions

**These extend the existing API Endpoint Spec.**

## New Layer 3 Routes

| **Route** | **Method** | **Schedule** | **Purpose** |
| --- | --- | --- | --- |
| **/api/backup/database** | **POST** | **Daily midnight** | **pg_dump → gzip → upload to external storage (R2). Log result to audit_logs** |
| **/api/backup/storage** | **POST** | **Daily midnight (pre-launch)** | **List tenant-media objects → copy new/modified to backup bucket in external storage. MVP: not implemented** |
| **/api/backup/cleanup** | **POST** | **Daily** | **Delete backups older than retention window (30 days MVP, 90 days pre-launch)** |

## New Schema Additions

**No schema changes needed for MVP backup. Backup job results logged to existing audit_logs table (action = 'backup_completed' or 'backup_failed', metadata = {type, file_key, size, duration}).**

*If backup tracking needs its own table later, add backup_jobs (id, type, status, file_key, size_bytes, started_at, completed_at, error_message). Not needed for MVP.*

## New Design Rule

**Design Rule #12: Backup strategy — database backed up daily via pg_dump to S3-compatible external storage (recommended: Cloudflare R2). Storage objects require separate nightly backup (pre-public-launch). Auth identities are covered by database backup. Backups are immutable, retained for 30 days (MVP) or 90 days (pre-launch). Restore is manual, tested quarterly before public launch.**

# Feature Spec — Media Retention & Export Center

## Purpose

**This is a coach-facing product feature, NOT a substitute for platform backup. It gives coaches visibility into their media storage usage, control over retention policies, and tools to export or archive their data.**

## Product Goal

**Allow coaches to understand, manage, and export their data and media. Builds trust, supports compliance (GDPR data portability), and reduces storage costs by enabling coaches to clean up old media.**

## Core Principles

**1. Coach export is a product feature. Platform backup is an ops responsibility. They are separate.**

**2. Export gives the coach a copy. It does not delete data from the platform.**

**3. Media retention policies are coach-configurable within platform limits.**

**4. Deletion of media is permanent and cannot be undone (warn clearly).**

**5. Expired media follows defined behavior (see below).**

## Target Users

**Coaches only. Clients can view their own data but cannot export or manage retention. Super Admin can view aggregate storage metrics but cannot access individual coach media.**

## Feature Scope

| **Feature** | **Description** | **Phase** |
| --- | --- | --- |
| **Storage Usage Dashboard** | **Total media size, breakdown by type (meal photos, VIP images), trend over time** | **Post-MVP** |
| **Retention Policy View** | **Current retention settings, configurable per coach (e.g., keep meal photos for 180 days)** | **Post-MVP** |
| **Client Data Export** | **Download all data for one client (logs, plans, messages, photos) as ZIP** | **Post-MVP** |
| **Bulk Export** | **Download all coach data as ZIP (all clients, plans, templates)** | **Post-MVP** |
| **Archive Center** | **View archived/deactivated clients, their data, and export options** | **Post-MVP** |
| **Media Deletion** | **Delete specific photos or all photos older than X days** | **Post-MVP** |
| **Deletion Warnings** | **Confirm before permanent deletion, show what will be lost** | **Post-MVP** |

## Storage Usage Dashboard

**Shows: total storage used (MB/GB), breakdown by category (meal photos, VIP images), number of objects, storage trend (last 30/90 days). Helps coaches understand their storage footprint.**

## Retention Policy View

**Coach can set: meal photo retention (default 365 days), VIP image retention (default 365 days), deactivated client data retention (default 90 days). Platform enforces minimum retention (e.g., 30 days) to prevent accidental data loss.**

## Export Tools

**Per-client export: ZIP containing daily_logs (CSV), assigned plans (JSON), messages (CSV), photos (original files). Bulk export: same structure for all clients. Export is generated asynchronously (server-side job). Coach notified when ready. Download link valid for 24 hours.**

## Archive Center

**Lists deactivated/archived clients with: last active date, data size, export button, permanent delete button (with confirmation). Helps coaches manage storage by cleaning up old client data they no longer need.**

## Deletion Warnings

**Before any permanent deletion: show exactly what will be deleted (row counts, media file counts, storage size). Require explicit confirmation. Log deletion to audit_logs. Cannot be undone.**

## Expired Media Behavior

**When media exceeds retention policy: mark as expired in the database. Do not auto-delete immediately — show in Archive Center with warning. Coach can extend retention, export, or confirm deletion. Auto-delete only after grace period (30 days past expiry) if coach takes no action.**

## MVP Status

**Not built for MVP.**

**This entire feature is post-MVP. MVP coaches have no export tools, no storage dashboard, and no retention controls. This is acceptable for a private pilot with known coaches.**

## Recommended Phase

**Build after core platform is stable and before public launch. Storage visibility and export capability are table-stakes for a paid SaaS product with health-adjacent data.**

## Suggested Screens

| **Screen** | **Location** | **Content** |
| --- | --- | --- |
| **Storage Dashboard** | **/settings/storage** | **Usage metrics, retention settings, media breakdown** |
| **Client Export** | **/clients/:id/export** | **Per-client export (ZIP generation + download)** |
| **Bulk Export** | **/settings/export** | **Full coach data export** |
| **Archive Center** | **/clients/archived** | **Deactivated clients, export/delete options** |

## Suggested Navigation Placement

**Storage Dashboard and Bulk Export under Settings. Per-client Export as action button on Client Profile. Archive Center as tab/filter on Client List (status = deactivated).**

## Suggested Data Model Additions

| **Table** | **Fields** | **Purpose** |
| --- | --- | --- |
| **export_jobs** | **id, coach_id, type (client/bulk), status (pending/processing/completed/failed), file_key, expires_at, created_at** | **Track export requests and download links** |
| **media_retention_settings** | **id, coach_id, meal_photo_days (default 365), vip_image_days (default 365), deactivated_client_days (default 90)** | **Coach-configurable retention per media type** |

*These tables are post-MVP. Not part of the current locked schema.*

## Suggested Backend Capabilities

| **Capability** | **Route** | **Purpose** |
| --- | --- | --- |
| **Generate export** | **/api/export/client/:id** | **Async: collect data + media → ZIP → upload to temp storage → return download link** |
| **Generate bulk export** | **/api/export/bulk** | **Same but for all clients** |
| **Storage metrics** | **/api/storage/metrics** | **Calculate storage usage per coach** |
| **Apply retention** | **/api/storage/apply-retention** | **Cron: mark expired media, auto-delete after grace** |

## Permissions

**Only coaches can export data and manage retention. Assistants cannot. Clients cannot export (they can view their data in-app). Super Admin can view aggregate storage metrics but cannot access or export individual coach data.**

## Risks / Design Notes

**1. Large exports (100+ clients with photos) can be slow and storage-heavy. Use async generation with notification.**

**2. Export files contain PII. Download links must be short-lived (24h), authenticated, and logged.**

**3. Auto-deletion of expired media must have clear coach consent. Never delete without warning.**

**4. Storage metrics queries can be expensive. Pre-compute or cache.**

## Success Criteria

**Coach can export any client’s data as a ZIP in under 5 minutes. Coach can see their storage usage at a glance. Coach can configure retention policies without support help. No media is auto-deleted without explicit consent or past-grace-period expiry.**

## Short Product Summary

**The Media Retention & Export Center gives coaches control over their data: see what’s stored, set how long to keep it, export what they need, and clean up what they don’t. It is a trust-building feature, a compliance enabler (GDPR data portability), and a storage cost management tool. It is not a backup system — platform backup is a separate ops responsibility.**

# Consolidated Implementation Guidance

## Build Now (MVP)

| **Item** | **Effort** | **Justification** |
| --- | --- | --- |
| **Daily database backup cron (pg_dump → R2)** | **Small** | **One route + one cron. Prevents total data loss. Non-negotiable even for pilot** |
| **Backup cleanup cron (delete >30 days)** | **Tiny** | **Prevents unbounded storage growth** |
| **Design Rule #12 documented** | **None** | **Documentation only** |

## Document Now, Build Later (Post-MVP)

| **Item** | **When** | **Trigger** |
| --- | --- | --- |
| **CSV client import** | **Post-MVP Phase 1** | **First coach requests migration from another tool** |
| **CSV daily log import** | **Post-MVP Phase 2** | **Coaches want historical data continuity** |
| **Plan template import** | **Post-MVP Phase 3** | **Coaches have existing plan libraries** |
| **Storage Usage Dashboard** | **Pre-public-launch** | **Needed for paid SaaS trust** |
| **Client Data Export (ZIP)** | **Pre-public-launch** | **GDPR data portability + coach trust** |
| **Media retention controls** | **Pre-public-launch** | **Storage cost management** |
| **Archive Center** | **Pre-public-launch** | **Deactivated client management** |

## Build Before Public Launch

| **Item** | **Justification** |
| --- | --- |
| **Storage object nightly backup** | **Media is irreplaceable. Cannot launch publicly without media protection** |
| **90-day backup retention** | **Matches coach data retention policy** |
| **Restore procedure tested** | **At least one successful restore drill before real users depend on the platform** |
| **Backup failure alerting** | **Ops must know immediately if backups stop working** |
| **Basic client data export** | **GDPR data portability. Table-stakes for paid SaaS** |

## Explicitly Avoid in MVP

**1. Bidirectional sync with any external tool.**

**2. Live API integrations with competitors (Trainerize, TrueCoach).**

**3. Google Sheets or external data linking.**

**4. Automated restore (manual is fine for pilot).**

**5. Coach-facing storage dashboard or retention controls.**

**6. Bulk export feature.**

**7. Any import feature beyond what coaches can do manually (invite clients, enter data).**

## What Must Remain Internal/Platform Responsibility

**Platform backup and disaster recovery is always an internal ops concern. Coaches should never need to think about it. Coach-facing export is a product feature that gives coaches control over their own data — it does not replace or substitute for platform backup.**

## What Can Become a Coach-Facing Feature Later

**Data export (per-client and bulk), storage usage visibility, retention policy controls, archive management, and import tools are all coach-facing features that add product value. They should be built when the core platform is stable and the coach base is growing.**

# Cross-Reference with Existing Specifications

**Adjustments needed in existing spec documents to support these additions:**

## Schema Document

**Add Design Rule #12 (backup strategy). No table changes for MVP. Post-MVP tables (import_jobs, export_jobs, media_retention_settings, external_data_links) documented here but not added to schema until their features are built.**

## API Endpoint Spec

**Add 3 new Layer 3 routes: /api/backup/database, /api/backup/storage (pre-launch), /api/backup/cleanup. Add to cron job summary: database backup (daily midnight), storage backup (daily midnight, pre-launch), cleanup (daily). Post-MVP routes for import/export documented here but not added until features are built.**

## Screen Spec

**No changes for MVP. Post-MVP screens: Import (coach web), Storage Dashboard (under settings), Client Export (action on client profile), Bulk Export (under settings), Archive Center (client list filter/tab). These are documented here for planning but not added to the current screen spec.**

## RLS Policy Document

**No changes for MVP. Post-MVP: import_jobs and export_jobs tables would need coach-scoped RLS policies (coach_id = auth.uid()). Backup routes use service role only — no RLS implications.**

# Final Recommendations

**1. Build the daily database backup cron job now. It is one route, one cron schedule, and it prevents catastrophic data loss. This is the single most important operational safety net.**

**2. Do not build any interoperability features for MVP. Document the strategy (this document) so future development is aligned, but invest zero engineering effort in import/export/sync until the core product is validated.**

**3. Before public launch, add Storage object backup and basic client data export. These are trust and compliance requirements for a paid SaaS with health-adjacent data.**

**4. Never build bidirectional sync. The complexity-to-value ratio is catastrophic for an early-stage product.**

**5. Keep platform backup and coach export as separate concerns in your architecture, your documentation, and your team’s mental model. Conflating them leads to gaps in both.**

**6. The interoperability and backup strategies in this document are designed to be non-blocking. They do not require schema changes, API restructuring, or screen spec modifications for MVP. They extend the existing architecture naturally when the time comes.**

