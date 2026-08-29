# Weight OCR — Design Spec

**Date:** 2026-08-29
**Status:** Approved by user, pending implementation plan

## Purpose

Let a client photograph a bathroom scale and have the weight value read
automatically into the Daily Log form's Weight field, instead of typing
it by hand every day. Recognition runs entirely on-device (no cloud
vision API, no per-scan cost, works offline). The photo itself is kept
as proof for the coach, with automatic retention cleanup.

This is one of two features from a larger "make logging smarter"
request; step-count auto-sync (native pedometer) is a separate,
independently-designed feature and is out of scope for this spec.

## Non-goals

- No cloud OCR / vision API call of any kind.
- No auto-submit of a recognized number — the client always sees and
  can edit the value before saving, every time, including a
  high-confidence OCR read.
- No retroactive OCR on previously-logged weights.
- No steps-related work (separate spec).

## User-facing flow

1. On the Daily Log form (mobile home screen), a camera icon sits next
   to the existing Weight input.
2. Tapping it opens the camera (via `expo-image-picker`'s
   `launchCameraAsync`, already a dependency — no new capture library).
3. After capture, the photo is run through an on-device text-recognition
   model. The app searches the recognized text blocks for a plausible
   weight reading: a numeric token, 1-3 digits before an optional
   decimal point and up to 1 digit after, whose parsed value falls in
   30-300 (kg). Additional non-numeric text on the scale's screen
   (brand name, "kg" unit label, low-battery icon glyphs some OCR
   engines misread as digits, etc.) is discarded by this filter.
4. **Match found:** the Weight field is pre-filled with the recognized
   number (still a normal editable `TextInput` — nothing is locked).
   A small "from photo" indicator/thumbnail shows next to the field.
   The user reviews, edits if needed, and saves the log as normal.
5. **No match found (attempt 1):** show "Couldn't read the number —
   try again?" with a retake button. The first photo is discarded (not
   uploaded, not kept).
6. **No match found (attempt 2):** stop retrying. Unlock the Weight
   field for normal manual numeric entry (it was already a normal
   input; this step just means no more automatic retake prompts).
   Critically, the **attempt-2 photo is retained** — it gets uploaded
   at save time alongside whatever weight value the user manually
   types, so the coach has visual proof even when OCR never succeeded.
7. **Camera permission denied:** skip straight to manual entry. No
   dead-end screen, no repeated permission nagging — this must never
   block logging a weight.
8. Whenever a photo exists at save time (from either a successful OCR
   read the user kept, or the attempt-2 fallback), it uploads through
   the existing signed-upload-url flow and its storage key is saved
   alongside the weight.

## Architecture

### Database (`daily_logs`)

Add one column, mirroring the existing `meal_photo_key` column already
on this same table:

```sql
ALTER TABLE public.daily_logs ADD COLUMN weight_photo_key text;
```

### RPC (`update_today_log`)

Add one new optional parameter, `p_weight_photo_key text DEFAULT NULL`,
alongside the existing `p_meal_photo_key` parameter. Same
`COALESCE(EXCLUDED.weight_photo_key, public.daily_logs.weight_photo_key)`
upsert behavior as the existing photo column, so re-saving the log
without a new photo doesn't wipe out a previously-uploaded one.

### Upload path

No new backend route. Reuses `apps/web/app/api/storage/signed-upload-url`
unchanged — it already validates `{coachId}/{clientId}/{filename}` path
shape and enforces ownership. Filename convention mirrors meal photos:
`${Date.now()}_weight.jpg`.

### On-device OCR (mobile, new native dependency)

Needs an Expo-compatible on-device text-recognition package (Google ML
Kit-backed). This is the one piece of the design that needs a concrete
package chosen and verified for Expo SDK 54 config-plugin compatibility
during implementation — flagged explicitly rather than assumed, since
the OCR-adjacent package landscape is more churny than most Expo modules.
If no well-maintained SDK-54-compatible package exists at implementation
time, this is a **stop-and-report** situation, not a "pick something
half-working" situation.

This is a **new native module**: it requires a rebuild via `eas build`
before it can be used (OTA update alone cannot deliver it). Per the
earlier steps-auto-sync brainstorm, that feature also needs a new native
module (`expo-sensors` Pedometer) — both should land in the **same**
rebuild rather than two separate manual-install cycles for the tester.

### Purge cron

New route `apps/web/app/api/weight/purge-photos/route.ts`, a close copy
of the existing `apps/web/app/api/meals/purge-photos/route.ts`:
- Same `CRON_SECRET` Bearer-auth pattern.
- Cutoff: 14 days (vs. 20 for meal photos — user's explicit choice).
- Query `daily_logs` where `log_date < cutoff` and `weight_photo_key is
  not null`, limit 500 per run (matches existing safety limit).
- Remove the exact storage key, then null the column on success.
- Add a matching cron entry to `apps/web/vercel.json` (new schedule
  slot, following the existing four).

### Coach-side display

`apps/web/app/(coach)/clients/[id]/page.tsx`: add `weight_photo_key` to
the `daily_logs` select, add its keys to the existing `photoKeys`/
`photoUrlMap` signed-URL batch (already collects meal photo keys the
same way). `ClientProfileClient.tsx`: show a thumbnail next to the
weight value on each Daily Log Timeline card (Overview tab) when
present, same visual treatment as the existing meal-photo thumbnail on
that same card.

## Error handling

| Case | Behavior |
|---|---|
| Camera permission denied | Skip to manual entry immediately, no dead end |
| OCR finds no plausible number, attempt 1 | Offer retake |
| OCR finds no plausible number, attempt 2 | Manual entry, keep the photo |
| Photo upload fails at save time | Block save with a clear retry-able error (same pattern as existing meal-photo upload failure handling in `home.tsx`) — never silently drop the photo or silently save without it |
| OCR finds a number outside 30-300 range | Treated as no match (same as not finding a number at all) |

## Testing

On-device ML accuracy itself isn't something to unit-test. What *is*
testable and should be:
- The retry/fallback state machine (attempt 1 fail → retake offered →
  attempt 2 fail → manual entry unlocked, photo retained) — pure JS
  logic, testable independent of the actual OCR call.
- The numeric-token filter (30-300 range, digit/decimal shape) against
  a table of realistic OCR output strings (including known-messy cases:
  extra brand text, unit labels, stray icon misreads).
- Upload + RPC wiring — same shape as the already-working meal-photo
  path, smoke-test by reproduction.
- The purge cron — mirror however the existing meal-photo purge cron
  was verified (this spec doesn't invent a new verification method).

## Open item carried into implementation

The specific on-device OCR package name/version is intentionally not
pinned in this spec — it must be verified against Expo SDK 54
compatibility at implementation time, and reported back before writing
any code that depends on its exact API shape.
