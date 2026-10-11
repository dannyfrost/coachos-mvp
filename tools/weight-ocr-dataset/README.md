# Weight-OCR dataset & evaluation pipeline

Repeatable tooling to turn raw coach-client scale photos into a labeled,
leak-free dataset and to score any recognizer against the launch criteria.
Built because automatic weight-OCR is a launch blocker and cannot be
validated without a real dataset (see `docs/WEIGHT_OCR_LAUNCH_ASSESSMENT.md`).

**Status:** pipeline ready; dataset NOT yet collected. Seeded only with the
4 original failing photos as pinned regression cases. A launch decision
needs ≥ 500 labeled images per the assessment.

Deps: Python 3.10+, `opencv-python-headless`, `numpy` (see
`scratchpad/ocrvenv` or `pip install opencv-python-headless numpy`).

## Annotation record (one JSON object per image, in `manifest.jsonl`)

| field | meaning |
|-------|---------|
| `image_id` | stable unique id (`img_<sha256[:12]>`) |
| `src_path` | original filename as ingested |
| `sha256` | checksum of the original bytes (integrity + exact-dup detection) |
| `ahash` | 64-bit average-hash hex (near-duplicate detection) |
| `width`,`height` | original pixel dims |
| `ground_truth` | displayed weight, human-transcribed (e.g. `76.40`); `null` until labeled |
| `legible` | human can read it (`true`/`false`/`null`) — illegible excluded from exact-value scoring |
| `display_type` | e.g. `reflective_lcd`, `led`, `unknown` |
| `scale_model` | when known, else `null` |
| `session_id` | capture session / client grouping key — **split boundary** |
| `source` | `camera` or `screenshot` |
| `quality` | list from `{blur, glare, low_contrast, perspective, occlusion, ok}` |
| `display_bbox` | `[x,y,w,h]` or quad `[[x,y]*4]` of the display, or `null` |
| `annotation_status` | `pending` / `labeled` / `reviewed` |
| `reviewer` | who labeled/reviewed, or `null` |
| `split` | `train` / `val` / `test` / `regression` (set by `split.py`) |

Rules: retain originals in `dataset/originals/` unchanged; never fabricate
`ground_truth`; ambiguous readings must be human-reviewed; obtain client
consent before using any image for training; minimize personal data (crop
to display where possible for training copies).

## Steps

1. **Ingest** raw images → manifest with checksums, dims, near-dup flags, empty labels:
   ```
   python ingest.py --in <raw_folder> --out ../../dataset --regression <4 photo paths...>
   ```
2. **Label** `manifest.jsonl` (fill `ground_truth`, `legible`, `quality`,
   `session_id`, `display_bbox`, …). Use a human reviewer for ambiguous ones.
3. **Split** session-disjoint 70/15/15 with near-dup guard; the 4 regression
   photos are pinned to a separate `regression` partition (never in train):
   ```
   python split.py --dataset ../../dataset
   ```
4. **Score** a recognizer's predictions against held-out test / challenge set:
   ```
   python score.py --dataset ../../dataset --preds preds.jsonl
   ```
   `preds.jsonl`: `{"image_id":..., "pred":"76.40"|null, "accepted":true|false}`.

## Acceptance criteria (from the assessment, pending product-owner sign-off)
- ≥ 98% exact match among auto-accepted, in-scope, readable photos.
- ≥ 90% auto-acceptance coverage on the readable test set.
- 0 false acceptances on the challenge set (unrelated numbers, %, timestamps,
  screenshots, ambiguous) — reported with a Wilson upper bound, since 0/N ≠ 0 risk.
- Correct decimal placement; no silent accept on ambiguity.
- Latency/memory acceptable on supported Android devices.
`score.py` reports numerator/denominator, Wilson 95% CIs, abstention rate,
and a by-quality / by-source breakdown. Thresholds are NOT relaxed after
seeing results.
