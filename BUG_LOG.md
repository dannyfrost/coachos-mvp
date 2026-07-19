# Bug Log — CoachOS

Bugs found during review, testing, or remediation. This file is append-only. Resolved bugs stay in the log as a historical record; do not delete rows.

Each entry captures:
- **ID** — sequential `B-NNN`
- **Date** — ISO `YYYY-MM-DD` when the bug was identified
- **Where** — file or task ID where it surfaced
- **Severity** — `Critical` (data loss / security), `Major` (correctness), `Minor` (cosmetic / non-blocking)
- **What** — one-line description of the symptom
- **Root cause** — why it happened (spec gap, AI hallucination, design drift)
- **Fix** — what was actually changed and where
- **Status** — `Open`, `Fixed`, `Won't fix`, `Deferred`
- **Follow-up** — anything that still needs to happen elsewhere as a result

---

## Active bugs

_None._

---

## Resolved bugs

### B-001 — ON DELETE CASCADE on composite FKs

| Field | Value |
|---|---|
| **Date** | 2026-05-10 |
| **Where** | `supabase/migrations/003_composite_constraints.sql` |
| **Severity** | Major |
| **What** | Six composite foreign keys used `ON DELETE CASCADE`, which conflicts with the project's soft-delete philosophy (Design Rule 4) and the per-table Erasure Matrix. A single accidental `DELETE FROM clients WHERE id = ?` would silently destroy child rows that the Erasure Matrix says to retain (e.g., `client_subscriptions: retain minimal`, `absence_events: retain minimal`). |
| **Root cause** | The T0-03 task spec did not pin an ON DELETE policy. Claude Code defaulted to CASCADE for cleanup convenience. The browser-side spec author also did not catch the omission before producing the prompt. |
| **Fix** | Modified six composite FKs to `ON DELETE NO ACTION` (the PostgreSQL default — clause removed). Kept `plan_assignments → plans` as `ON DELETE RESTRICT` because it correctly prevents deleting a plan that still has active assignments. Applied in T0-03 remediation pass on 2026-05-10. |
| **Status** | Fixed |
| **Follow-up** | None. Erasure must now go through the documented runbook, which is the intended behavior. |

### B-002 — client_subscriptions.end_date nullable

| Field | Value |
|---|---|
| **Date** | 2026-05-10 |
| **Where** | `supabase/migrations/002_create_tables.sql` line 125 |
| **Severity** | Major |
| **What** | `client_subscriptions.end_date` was declared nullable. This contradicts the product model: every paid subscription period has an explicit start and end, and the 7-day grace period is computed at runtime against `end_date`. A nullable end_date would have made the grace-period check undefined and would have forced every consumer (flash card computation, absence detection, renewal reminders) to special-case NULL. |
| **Root cause** | The schema doc was ambiguous on this column's nullability. 002 inherited the ambiguity. The browser-side T0-03 prompt assumed NOT NULL and only caught the discrepancy when Claude Code wrote a `CHECK (end_date IS NULL OR end_date >= start_date)` constraint — which surfaced the underlying issue. |
| **Fix** | Changed `client_subscriptions.end_date` to NOT NULL in 002_create_tables.sql (one-line edit, edit-in-place because 002 had not been pushed to any shared environment). Simplified the corresponding CHECK in 003_composite_constraints.sql to `CHECK (end_date >= start_date)`. Applied in T0-03 remediation pass on 2026-05-11. |
| **Status** | Fixed |
| **Follow-up** | Skim MVP_API_Endpoint_Spec.docx for the subscription-creation/renewal endpoints. Confirm the request schema requires end_date and rejects null. Five-minute check; do before Tier 4 subscription work. |

### B-003 — SET search_path quoting in trigger functions

| Field | Value |
|---|---|
| **Date** | 2026-05-11 |
| **Where** | T0-05 spec (browser-side prompt to Claude Code) |
| **Severity** | Critical (would have caused silent failure of the search_path defense) |
| **What** | The browser-side T0-05 prompt specified `SET search_path = 'public, pg_catalog'` (quoted string). PostgreSQL would interpret this as a single schema name literally containing a comma — which does not exist — and the function would fall back to the default search_path. The whole point of setting it (preventing search_path injection) would be silently defeated. |
| **Root cause** | Browser-side spec authoring error. Quoted string was used instead of the correct unquoted comma-separated identifier list. |
| **Fix** | Claude Code spotted the issue during T0-05 implementation and used the correct form: `SET search_path = public, pg_catalog`. Self-flagged in its report. Verified valid by review. |
| **Status** | Fixed |
| **Follow-up** | All future prompts that include SET search_path use the unquoted form. Pattern captured in WORKING_RULES.md section 5. |

---

## How to add a new entry

1. Find the next sequential B-NNN after the highest existing ID.
2. Add a new section under "Active bugs" while the bug is open.
3. Fill in all fields. Use "TBD" only for "Fix" and "Follow-up" if still open.
4. When the bug is resolved, move the section to "Resolved bugs". Keep the original discovery date in the Date field; add the resolution date in the Fix field.
5. Never delete rows. Won't-fix and deferred bugs stay in the log with status updated.
