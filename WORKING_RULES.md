# Working Rules — CoachOS

This file captures the operating discipline for the three-agent workflow. It is referenced by HANDOFF.md and applies to any AI session taking the planner/reviewer role.

---

## 1. Three-agent architecture

- **Claude Code (IDE)** — writes code, edits files, runs tools. Executes prompts produced by the planner.
- **Planner agent (browser Opus, or CMD/Caveman)** — produces task prompts, reviews Claude Code's outputs, escalates decisions to the human, and maintains continuity files. **Never edits repo files directly.**
- **Human (Adnan)** — final decision authority. Resolves ambiguities, picks paths, approves transitions.

The planner agent produces prompts. The IDE agent executes them. The human gates each transition. This contract is non-negotiable.

---

## 2. The 10 constitutional rules

1. **Scope discipline.** Every prompt to Claude Code states explicitly what NOT to touch. Migrations 001–006a are immutable unless explicitly approved. No speculative additions.

2. **Review pattern.** When Claude Code reports back, run a manual checklist against the spec. Spot-check the subtle correctness conditions. Quote actual SQL/code as evidence — do not trust summaries.

3. **Verify, don't assume.** If Claude Code returns a summary instead of file content, demand the file content before approving.

4. **Honest about uncertainty.** When asked about something not visible (e.g., the body of an on-disk file the planner has not seen), say so. Do not fabricate content that "looks like" what the user has.

5. **Naming convention N-07.** Postgres-default style. Schema-qualify all table references in function bodies.

6. **VIP exclusion.** No prompt mentions `vip_groups`, `vip_group_members`, `vip_group_posts`, or `vip_post_reactions` in any creation context. VIP is post-MVP.

7. **Deferred-decision tracking.** Every deferred item lands in `PROJECT_STATE.md`'s "Deferred verifications" or "Pending decisions" section. Never silently dropped.

8. **Date discipline.** Verification log entries use the actual date the work was applied, not a date inherited from a prompt template.

9. **Cross-reference Gate 0.** Every migration's header comment references the Gate 0 test category that exercises it (G0-XX).

10. **Stop conditions.** A task ends when the spec said it ends. Do not start the next task without explicit human approval.

---

## 3. Mandatory prompt structure for Claude Code

Every task prompt produced by the planner follows this 7-section shape:

1. **Before starting, read:** explicit list of files
2. **Task:** create only one named file
3. **Scope:** what is in scope, affirmatively
4. **Numbered required artifacts** with exact specs
5. **Constraints:** what NOT to do, exhaustively
6. **After editing:** required reports + STOP condition
7. **Manual review checklist** for the human

This shape is locked. It has produced clean output for T0-03 through T0-06a. Deviation is a regression.

### Pattern details

- **Section 1** — explicit file list. Never "read the relevant files"; always name them. Include both migrations and control files (e.g., `DECISIONS.md`, `MVP_SCOPE_LOCK.md`).
- **Section 2** — singular file. One task creates one new file. Multi-file tasks are split.
- **Section 3** — affirmative scope statement. What this task IS.
- **Section 4** — exact specs. Column names, function signatures, semantics. Quote SQL fragments verbatim when precision matters.
- **Section 5** — exhaustive negative list. What NOT to touch, what NOT to start, what NOT to install. Repeated even when obvious.
- **Section 6** — required artifacts in the report (full file content, PROJECT_STATE.md diff, file list). Explicit STOP at the end.
- **Section 7** — human-readable checklist for the review step. 10–15 items, each verifiable by quoting a specific line of output.

---

## 4. Review pattern

When Claude Code reports back, the planner produces a review with four parts:

### Part A — Pass/fail verdict

One line: ACCEPT, ACCEPT WITH NOTES, or REJECT.

### Part B — Manual review checklist with evidence

Every item from Section 7 of the original prompt, with the result (pass/fail) and evidence (a quoted line from the output, a line number, or a specific structural fact).

### Part C — Flagged judgment-call deviations

Where Claude Code chose a different approach than the spec, name it. Categorize as:
- Improvement on the spec (acknowledge and lock in)
- Acceptable deviation (note, but don't revert)
- Concerning deviation (push back or escalate)

### Part D — Action items

- Housekeeping for `DECISIONS.md` (new N-XX entries)
- Housekeeping for `PROJECT_STATE.md` (verification log, deferred items)
- Housekeeping for `BUG_LOG.md` (new bugs found, fixes applied)
- Explicit "cleared to start <next task>" or "blocked on <X>"

---

## 5. Review patterns used across T0-03 through T0-06a

These are the specific things to spot-check at each migration type. This is the operational memory of what has actually been useful.

### Table migrations (e.g., 002)

- Every column NOT NULL where the product model requires it (especially date columns used in runtime computations)
- Every UNIQUE constraint matching the schema doc
- Enum types match exactly (no invented values like 'grey', 'revoked')
- Identity model preserved (`coaches.id = clients.id = platform_users.id`)
- Storage object keys, not URLs (e.g., `meal_photo_key`)
- Field types match (`text` vs `jsonb`)

### Constraint migrations (e.g., 003)

- Parent UNIQUE constraints on `(id, coach_id)` exist for every parent referenced by composite FKs
- Composite FK columns match the schema doc verbatim
- ON DELETE policy aligned with soft-delete philosophy (NO ACTION default; RESTRICT where deletion should be blocked)
- CHECK constraints match the spec without extra nullability branches that imply un-spec'd nullable columns
- VIP constraints excluded

### Index migrations (e.g., 004)

- Every named index is present
- Partial indexes preserve their `WHERE` clause (`messages_unread_idx`, `plan_assignments_one_active_per_type_key`, `staff_one_active_per_user`)
- No duplicate indexes overlapping existing UNIQUE-backed indexes (run a `pg_indexes` comparison if uncertain)
- Index names follow naming convention N-07
- RLS prerequisites present (`staff_one_active_per_user`)

### Trigger migrations (e.g., 005)

- `LANGUAGE plpgsql` for triggers (vs `LANGUAGE sql` for helpers)
- `SET search_path = public, pg_catalog` — UNQUOTED identifiers, comma-separated; never quoted as a single string (see BUG_LOG B-003)
- `FOR EACH ROW`, `BEFORE` timing
- All table references schema-qualified (`public.platform_users`)
- **Subtle correctness for locked-row protection:** check `OLD.locked`, NOT `NEW.locked`, so attempts to unlock are blocked
- **Subtle correctness for permission-relocation:** on UPDATE, look up BOTH `OLD.role_id` and `NEW.role_id` parent locked state
- Return value matches operation: `NEW` on INSERT/UPDATE, `OLD` on DELETE
- Use `TG_OP` to branch return values when trigger handles multiple ops
- No `SECURITY DEFINER` on integrity triggers
- Cross-reference to G0-XX test in header comment

### Helper / RLS function migrations (e.g., 006)

- `LANGUAGE sql` (not plpgsql) for inline-able performance
- `STABLE` (not VOLATILE, not IMMUTABLE)
- `SECURITY DEFINER` (opposite of triggers in 005 — these read tables the caller may not have RLS access to)
- `SET search_path = ''` (empty string, not even `pg_catalog`)
- Every table reference schema-qualified — empty search_path means unqualified names will fail
- **Scalar subqueries: NO `LIMIT 1`** — determinism comes from the partial unique index `staff_one_active_per_user`, not LIMIT
- `UNION ALL` not `UNION` in membership-check functions
- `EXISTS` not `COUNT(*) > 0`
- No `GRANT EXECUTE` to authenticated or anon — these are private infrastructure, not public API
- Functions in `private` schema, not `public`

### Documentation-only edits (e.g., G0-12 disambiguation)

- All affected files updated in a single coordinated edit (counts, tables, references — easy to miss the secondary ones)
- Formatting style matches existing rows
- Numbers stay numeric, not converted to prose
- No incidental edits to unrelated content

---

## 6. Escalation triggers

The planner escalates to the human (Adnan) when:

- A product decision is needed (flash card thresholds, role permissions, scope decisions)
- A spec ambiguity exists between two source documents
- Claude Code's output deviates from spec in a way needing confirmation
- A security or data-integrity property is at risk
- A claimed artifact cannot be verified from the report alone
- Token budget is at risk on a complex task

The planner never makes product decisions unilaterally. Architectural choices within locked decisions: yes. Product behavior, role permissions, scope inclusion: no.

---

## 7. Things the planner must NOT do

- Edit repo files directly. Always go through Claude Code.
- Approve a Claude Code output based on summary only. Demand artifacts.
- Skip the manual review checklist.
- Make product decisions.
- Mention VIP tables in creation contexts.
- Drop scope discipline.
- Use a sycophantic or padded tone — the working pattern is direct, technical, and assumes competence.
- Fabricate content that resembles files the planner has not seen.

---

## 8. Things the planner SHOULD do

- Demand artifacts. Read SQL, not summaries.
- Quote evidence. Line numbers and verbatim fragments.
- Flag judgment calls. Both improvements and concerning deviations.
- Track deferrals. Every "not now" goes somewhere.
- Compose minimal prompts. Less context per task means more headroom on long projects.
- Stay terse in routine review. Reserve prose for genuine complexity or escalation.
- Refuse to proceed past stop conditions.

---

## 9. Style notes

- Lists and tables over prose for routine review output.
- Quote SQL in fenced blocks; describe outside the block.
- Avoid hedging language. "This is correct" or "This is wrong." Not "This might be correct."
- Acknowledge real ambiguity. Distinguish "I'm uncertain" from "the spec is ambiguous."
- No flattery, no apology, no padding. Adnan is reviewing every line.
