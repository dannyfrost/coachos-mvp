# FLASH_CARD_RULES.md

**Project:** Coaching Platform MVP  
**Purpose:** Canonical definition of flash card color logic, threshold rules, override rules, and interpretation guidelines.  
**Status:** PARTIAL — threshold values and some override rules are PENDING founder decision.  
**Last updated:** 2026-05-09

---

## What is a flash card?

A flash card represents a single client's current status, visible on the coach dashboard as a colored tile. Its color (green / yellow / red) is computed from the client's recent compliance data. The flash card is the product's primary coaching signal.

---

## Color Definitions

| Color | Meaning | Coach action implied |
|---|---|---|
| **Green** | Client is on track. Compliance is within acceptable range. | No urgent action required |
| **Yellow** | Client is slipping. Compliance is below target but not critical. | Check in soon |
| **Red** | Client needs attention. Compliance is significantly below target or a critical condition is met. | Contact immediately |

---

## Threshold Rules

> **PENDING — founder must define exact threshold percentages before the flash card computation RPC (T2-03) is written.**

The thresholds below are placeholder values. Replace each PENDING value with a locked number before T2-03.

| Metric | Green | Yellow | Red |
|---|---|---|---|
| Daily log completion rate (rolling 7 days) | PENDING ≥ X% | PENDING X%–Y% | PENDING < Y% |
| Meal photo submission rate (rolling 7 days) | PENDING ≥ X% | PENDING X%–Y% | PENDING < Y% |
| Consecutive missed days | 0 | PENDING 1–N days | PENDING > N days |

> All threshold values must be locked in this file before T2-03 is started. T2-03 must not proceed with PENDING values.

---

## Override Rules

### Paused client override

| Condition | Effect |
|---|---|
| Client account status is `paused` | Flash card is shown as **grey / paused** regardless of compliance data |
| Paused state takes priority over all color thresholds | Green / yellow / red computation is suspended while paused |
| When client is unpaused | Flash card recomputes from current data on next cron run |

### Expired subscription override

| Condition | Effect |
|---|---|
| Coach workspace subscription is `expired` or `cancelled` | PENDING — decide: hide all flash cards, show as grey, or show with a warning banner? |

> **PENDING — founder must decide the expired subscription display behavior before Tier 4 (subscription) tasks.**

### No data override

| Condition | Effect |
|---|---|
| Client has never submitted a daily log | PENDING — decide: show as grey "no data", yellow, or red? |
| Client was invited but has not activated | Show as grey "pending activation" — not computed |

> **PENDING — founder must decide the "no data" color before T2-03.**

---

## Priority Order

When multiple override conditions are true simultaneously, apply in this order:

1. Account not activated → grey / pending (highest priority, always wins)
2. Client paused → grey / paused
3. Expired subscription override (PENDING behavior)
4. Red threshold met
5. Yellow threshold met
6. Green threshold met (lowest priority — default when no override or red/yellow condition is met)

---

## Computation Timing

| Item | Value / Status |
|---|---|
| Computation trigger | Cron job (frequency PENDING) + on-demand RPC call |
| Cron frequency | PENDING — founder decides: every hour, every 6 hours, daily at midnight? |
| RPC name | `compute_flash_card_status` (name locked, see DECISIONS.md N-04) |
| Data window | Rolling 7 days (PENDING confirmation) |
| Stored on | `flash_cards` table (computed, not live-calculated on read) |

---

## Interpretation Rules

These rules govern how thresholds and data are applied. They are locked unless explicitly revised here.

1. Compliance rates are calculated over a **rolling window**, not a calendar week.
2. Days where the client has a logged absence or coach-approved exception do **not** count as missed days.
3. Partial submissions (log started but not completed) count as **missed** unless the RPC is told otherwise.
4. The flash card color represents the **worst** of any single metric's color — a client who is green on meal photos but red on log completion shows **red**.
5. The flash card is **read-only** for clients — only coaches can see it.
6. Coaches can attach notes to a flash card (`update_flash_card_notes` RPC) without changing the computed color.
7. Color thresholds apply uniformly across all clients in a tenant — there are no per-client threshold overrides in MVP.

---

## Open Items Before T2-03

| # | Item | Owner |
|---|---|---|
| 1 | Lock daily log completion threshold percentages (green/yellow/red) | Founder |
| 2 | Lock meal photo submission threshold percentages | Founder |
| 3 | Lock consecutive missed days thresholds | Founder |
| 4 | Lock cron frequency | Founder |
| 5 | Decide "no data" flash card color | Founder |
| 6 | Decide expired subscription display behavior | Founder |
| 7 | Confirm rolling window length (7 days assumed) | Founder |
