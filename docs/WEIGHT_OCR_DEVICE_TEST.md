# Weight OCR — on-device test procedure (P4)

The jest tests verify **candidate selection** against synthetic `OcrResult`
objects. They do NOT exercise native ML Kit recognition. OCR accuracy on real
seven-segment scales is **unverified until this procedure is run on a device**.

## Test photos (client-supplied, `Downloads/weight log/`)

| # | File | True reading | Notes |
|---|------|--------------|-------|
| 1 | `WhatsApp Image 2026-10-07 at 19.01.44.jpeg`     | **81.70 kg** | dark 7-seg on pale LCD, leading 7 |
| 2 | `WhatsApp Image 2026-10-07 at 19.01.44 (1).jpeg` | **79.75 kg** | 7-seg, two decimals, leading 7 |
| 3 | `WhatsApp Image 2026-10-07 at 19.01.44 (2).jpeg` | **76.40 kg** | **WhatsApp screenshot** — `55%` battery + `23:45`/`15:13` chrome in frame |
| 4 | `WhatsApp Image 2026-10-07 at 19.01.45.jpeg`     | **74.60 kg** | 7-seg, leading 7, battery glyph |

## Environment

- **BlueStacks** (x86_64) runs the EAS **preview** APK natively incl.
  `libmlkit_google_ocr_pipeline.so` and Skia — OCR is testable here by feeding
  photos through the gallery picker. (Steps/Health-Connect are NOT testable on
  BlueStacks — no HC, no step sensor.)
- Or a real Android device via `adb install`.
- Build: `cd apps/mobile && NODE_OPTIONS=--use-system-ca npx eas-cli build:list`
  → download latest `preview` APK → install.
- Push the 4 photos into the device gallery (BlueStacks: Media Manager import;
  adb: `adb push "<file>" /sdcard/Pictures/`).

## Steps per photo

1. Open the client app → Today's Log → Weight → camera icon → **Choose from Library** → pick the photo.
2. Capture logcat during the read:
   `adb logcat -s ReactNativeJS:V | grep -E "weight-ocr"`
   - `[weight-ocr] ... last raw OCR text` line = the raw ML Kit output (on failure).
3. Record: raw OCR text, the extracted candidate (`extractWeightCandidate`), the
   value written to the field (final selection), and whether it matched the true
   reading. For a failure, note which retry/attempt state showed.

## Results — RUN 2026-10-10, BlueStacks (Android 9 / SDK 28, x86_64), build 60f50e9e

Device run via adb UI driving + logcat (`ReactNativeJS`). ML Kit gocr tflite
models loaded on first call (~40s first run, faster after).

| Photo | Expected | Raw ML Kit text | Extracted candidate | Final field state | Pass? |
|-------|----------|-----------------|---------------------|-------------------|-------|
| 74.60 | 74.60 | `"K3"` (only the KG label; zero digits) | **null** | locked, "Couldn't read (attempt 1 of 3) · Retake" | ✅ no false value |
| 76.40 (WhatsApp screenshot) | 76.40 | `"23:45 O\nSabrines ...\n13 septembre, 15:13\nRépondre\n55%\nKe"` | **null** (`55` rejected: bare integer, no kg/decimal) | locked, retry | ✅ **55% NOT logged** |
| 79.75 | 79.75 | `"SI6"` (garbled, no valid digits) | **null** | 3rd fail → **manual unlocked**, "type your weight above. Your photo is still saved as proof." | ✅ ladder end-state |
| 81.70 | 81.70 | not tested (ladder spent) — same low-contrast 7-seg as 74.60, expected identical null | — | — | — (assumed fail) |

### Findings
- **ML Kit cannot read these low-contrast seven-segment scale digits** — it returns only the "KG" label or garbage, never the number. Skia preprocessing did not rescue any of the 3 tested. Confirms the known model limitation; **OCR accuracy on these scales is NOT improved and is not relied upon.** The photo-mandatory + manual-after-3 flow is the working mitigation.
- **False-positive guard verified on the real screenshot**: the `55%` battery was read by ML Kit but correctly **rejected** by `extractWeightCandidate` (null), so no wrong weight was logged.
- **Retry ladder + manual unlock verified end-to-end**: attempt 1/3 → 2/3 → 3rd fail unlocks typing with the photo retained.
- Manual entry (`79.8`) accepted, stat card updated. **Submit not completed on-device** — a BlueStacks affiliate ad overlay intercepted the Submit tap (no row written, verified in prod). The submit→upload→RPC evidence path is verified server-side (025/026/027 dry-runs + applied); on-device submit remains to be re-run.
- No seven-segment digit was recovered, so decimal-precision and 7-drop behaviour couldn't be observed on a successful read (there were no successful reads).

## What to watch for

- **Dropped leading 7** (known ML Kit 7-seg weakness): e.g. `81.70`→`1.70`
  (fails 30–300 range → retake prompt) or `76.40`→`6.40`. All 4 photos start
  with a 7, so this is the primary risk. Expected behaviour if it drops: no
  false value is logged; after 3 failed photos, manual entry unlocks with the
  photo still attached.
- **Photo 3 false-accept guard**: the `55%` battery must NOT be logged as
  weight. With the display undetected, `extractWeightCandidate` must return
  null (the `55` is a bare integer, no kg, no decimal → rejected). If `76.40`
  is detected it wins (decimal + near `KG`). Confirm 55 is never written.
- **Decimal precision**: `79.75` must read as `79.75`, not `79.7`.
- **MIN_OCR_DIMENSION = 500**: a photo under 500px on either side is rejected
  before OCR with the "too small" message. The 4 files are 922×2048 → fine.

## Pass criteria

- No photo logs a wrong value silently (correctness > convenience).
- Where OCR can't read, the retake→manual ladder behaves (3 tries, then type;
  photo retained & uploaded).
- Photo 3 never logs `55`.
- OCR accuracy claims may only be made from a completed table above.
