# Weight-OCR dataset: collection, privacy & benchmark protocol

Companion to `README.md`. Covers how to collect the ≥ 500-photo dataset,
privacy/consent/storage, annotation validation, and the localization +
recognition benchmark protocol. Nothing here changes production OCR.

## 1. Collection workflow (coach-client)

Coaches already receive scale photos from clients (WhatsApp / in-app weight
logs). To build the dataset:

1. **Consent first.** Add a short opt-in: "May we use your scale photos to
   improve automatic weight reading? Images are stored securely and never
   shared." Record consent per client (date, scope). No consent → exclude.
2. **Source the images** from two channels, keep both represented:
   - direct in-app weight photos (already uploaded to `tenant-media`),
   - coach-forwarded WhatsApp photos/screenshots.
3. **Export to a staging folder** off-repo (see §3). Keep originals byte-exact.
4. **Ingest**: `python ingest.py --in <staging> --out <dataset>` → records
   checksum, dims, near/exact-dup flags, pending labels.
5. **Label** (§2) then **split** then **audit** (`dataset_audit.py`).

Target ≥ 500 total, aiming for: ≥ 50 images per distinct scale model actually
used by clients; both camera photos and screenshots; a realistic spread of
quality (good, blur, glare, low-contrast, perspective). Collect to the audit's
readiness check, not to a flat count.

## 2. Annotation & validation

Fill every field in the `README.md` schema. Rules:
- **Ground truth** = the weight a human reads off the display, digit-for-digit
  including decimals (e.g. `76.40`). Never inferred from the app value.
- **Legible**: can a careful human read it? Illegible images stay in the set
  (for abstention/robustness eval) but are excluded from exact-value scoring.
- **Ambiguous readings** (glare hides a segment, cropped digit) → second human
  reviewer; `annotation_status=reviewed` only after agreement. Disagreements
  logged, image marked `legible=false` if unresolved.
- **session_id** groups images from the same capture session / same client /
  same sitting. This is the split boundary — label it carefully; mislabeling
  causes leakage. When unsure, give each its own session (conservative).
- **display_bbox**: the display region (for the localization benchmark, §4).
- Validate with `dataset_audit.py` — it reports completeness and readiness.

Label-alignment guarantee: `image_id = img_<sha256[:12]>` is derived from the
original bytes, and the original is copied to `originals/<image_id>.<ext>`, so a
record and its image can never drift apart across ingest/split/re-ingest
(re-ingest is idempotent by content hash).

## 3. Privacy & secure storage

- Scale photos are **personal data** (may show faces/feet/surroundings;
  body weight is sensitive). Treat accordingly.
- **Never commit images or a manifest that embeds them.** `dataset/.gitignore`
  blocks the whole dataset dir; only tools + labels-without-pixels are tracked.
- Store the dataset in access-controlled storage (encrypted at rest; restricted
  to the people doing labeling/training). Prefer keeping it inside the existing
  Supabase `tenant-media` access model or an equivalent controlled bucket, not
  on personal laptops.
- **Data minimization**: for training copies, crop to the display region once
  `display_bbox` is set, dropping faces/background. Keep full originals only in
  the restricted store for re-annotation.
- Honor deletion: a client withdrawing consent → remove their `session_id`
  images from the dataset and any derived crops/models.
- Do not send images to third-party/cloud OCR during dataset work (keeps
  body-weight data on controlled infrastructure).

## 4. Localization benchmark protocol

Localization is the unsolved bottleneck (3 prototypes failed — see assessment).
Benchmark it **independently of recognition**:

1. **Annotations**: `display_bbox` per image — axis-aligned box, or a 4-corner
   quad when the display is clearly angled (preferred for perspective cases).
2. **Metric**: IoU (box) or mean corner-error normalized by display diagonal
   (quad). Report **detection success rate** at IoU ≥ 0.5 and ≥ 0.7, and the
   mean/median IoU, on the **held-out test split only**.
3. **Breakdown** by `source` (camera/screenshot), `display_type`, and each
   `quality` tag — localization failure clusters by quality.
4. **Failure analysis**: save overlay crops of every miss (predicted vs
   annotated region) for inspection; categorize (grabbed chrome, grabbed
   background texture, partial display, wrong panel).
5. Only once localization clears an agreed IoU bar (propose: ≥ 0.7 IoU on
   ≥ 95% of readable test images) do you tune recognition on **detected**
   regions. Never tune recognition against hand-cropped regions and call
   localization solved.

## 5. Recognition benchmark

On the held-out test split, with localization fixed: compute the §5 metrics in
`README.md` via `score.py` (exact-match-on-accepted, coverage, 0 false-accept on
the challenge set, abstention, latency on-device). Compare approach A (classical
seven-seg) vs B (trained) on the **same** split. The four original photos are
regression-only and never counted toward generalization.

## 6. Known tooling limitations
- `ahash` (8×8 average hash) is coarse and can over-flag near-duplicates (it
  flagged one false pair among the 4 regression photos). This errs **safe** —
  over-grouping prevents leaks, never causes them — but at scale it can skew the
  70/15/15 balance. If that happens, switch the dedup hash in `ingest.py` to
  dHash/pHash (difference/perceptual hash); the split guard is unchanged.
- `split.py` greedy group placement is approximate; with few large sessions the
  ratios drift. Acceptable at N ≥ 500; the audit reports actual split sizes.
