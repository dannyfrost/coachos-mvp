# Weight-OCR launch assessment — can automatic scale-photo recognition meet a launch threshold?

Date: 2026-10-10. Author: engineering (CV/ML review).
Scope: the non-negotiable requirement that CoachOS cannot launch until automatic
weight recognition from scale photos meets a measured accuracy target.

**Bottom line (go/no-go): NO-GO for automatic OCR as a launch gate on current
evidence.** The recognizer is the wrong tool, the information is recoverable in
principle, but there is no dataset to build or validate a dependable system, and
the hard engineering (robust display localization) is unsolved. See §7.

---

## 1. Root cause — from the actual photographs

Four real client photos (`Downloads/weight log/`), ground truth transcribed by a
human: `81.70`, `79.75`, `76.40` (a WhatsApp **screenshot**), `74.60`. All are
**reflective segment LCDs** — dark grey digits on a pale grey/green background
(not emissive LED) — three are angled camera photos with glare/fingerprints on
the glass; one is a screenshot (frontal, well-lit, phone chrome around it).

On-device (BlueStacks, Android 9, build 60f50e9e) the shipped ML Kit pipeline
produced: `74.60`→`"K3"`, `76.40`→`"23:45 … Répondre 55% Ke"`, `79.75`→`"SI6"`.
Candidate selection was correct (null each time; `55%` correctly rejected).

Two independent failures, separated:

1. **Recognition (dominant, definitive).** ML Kit Text Recognition **cannot read
   seven-segment glyphs even when they are clean, large and high-contrast.** Proof:
   in the `76.40` screenshot the digits are the biggest, clearest element, and an
   OTSU threshold renders `76.40` as crisp black-on-white (see `seg_debug.py`
   output), yet ML Kit returned the surrounding UI text and never the number.
   This is a model-capability gap, not a contrast/preprocessing gap — the Skia
   preprocessing already shipped does not and cannot fix it.
2. **Localization (secondary, for camera photos).** On the angled camera photos
   the digits *are* present after CLAHE+OTSU, but the bright wood-grain background
   produces competing texture; the display must be localized/cropped and
   perspective-corrected first. This is solvable engineering, not missing data.

What is **not** the cause: resolution (922×2048, well above `MIN_OCR_DIMENSION`
500), decimal parsing, or candidate selection — those are correct.

## 2. Candidate approaches

### A. Classical seven-segment CV (localize → rectify → threshold → sample 7 segments)
- **Viability:** the information is recoverable (measured — §4). Recognition of
  clean segments is simple and deterministic.
- **Hard part:** robust **display localization + perspective correction** across
  scale models, angles, glare, and screenshots-with-chrome. Two prototype
  localizers here grabbed the wrong region (wood grain; the screenshot's
  `Sabrines…` chrome) — this is the real work.
- **Cost:** on-device needs OpenCV (react-native-vision-camera + a CV module) or a
  hand-rolled Skia pipeline. Deterministic, no training data to recognize, but
  needs a validation set to tune localization and prove generalization.
- **Risk:** does not generalize for free across display geometries; per-model
  tuning likely.

### B. Trained model (digit/display detector or small OCR head)
- A small display-detector (e.g. nano object detector) to crop the LCD, then a
  seven-segment digit classifier or a CRNN trained on seven-seg fonts.
- **Needs a labeled dataset** (hundreds–thousands of real scale photos across the
  actual scale models in use), augmented for blur/glare/perspective/low-contrast,
  with session-disjoint train/val/test splits.
- On-device via TFLite/ONNX; model size/latency manageable for a detector+classifier.
- **ML Kit cannot be fine-tuned** — its model/API is closed; "improve ML Kit" is
  not an option. A custom model is a separate artifact.
- Most robust long-term; highest data and maintenance cost.

### C. Improved capture (complementary, not a substitute)
- A framing overlay ("fit the display in the box"), tap-to-focus, exposure lock,
  glare/steady guidance. Cheap, materially raises input quality, shrinks the
  localization problem. Does **not** by itself make recognition work (see §1.1).

### Not recommended as the launch answer
- **Cloud OCR** (e.g. Cloud Vision): different model, may read some seven-seg, but
  adds per-scan cost, network dependency, and sends **body-weight photos off-device**
  (privacy). Could be a stopgap but conflicts with on-device/offline expectations.

## 3. Dataset — the gating constraint

**Current data: 4 real photos (3 camera, 1 screenshot) + a handful of synthetic
LCD renders from a prior session.** This is far too small to train (B) or to
*validate* any approach to a launch threshold. Reporting accuracy on these 4
alone would be meaningless and is explicitly disallowed.

The data source already exists: **coaches receive client scale photos over
WhatsApp every day.** Collection plan:
- Gather ≥ 500 real photos (target: ≥ 50 per distinct scale model in the client
  base), spanning camera photos and screenshots, good and poor quality.
- Human-transcribe ground-truth weight per image; record: scale/display type,
  camera-vs-screenshot, quality tag, failure category, human-legible (y/n).
- Obtain client consent for any image used in training.
- Partition **by capture session / client** so near-duplicates never span
  train/val/test (prevents inflated accuracy).
- Keep the 4 current photos as named **regression** cases only — never as the
  basis for a general-accuracy claim.

Until this exists, neither (A) can be validated nor (B) trained.

## 4. Prototype + measured results (feasibility probe, not a solution)

Classical seven-seg prototypes (`scratchpad/sevenseg_proto.py`, `sevenseg_v2.py`,
OpenCV 5.0.0) run on the 4 photos:

| Photo | GT | Exact match | Why |
|-------|----|-------------|-----|
| 81.70 | 81.70 | ✗ | localizer grabbed wood-grain noise; 0 clean digit boxes |
| 79.75 | 79.75 | ✗ | same |
| 76.40 (screenshot) | 76.40 | ✗ | localizer grabbed the `Sabrines…` chrome band, not the display |
| 74.60 | 74.60 | ✗ | same |

**Measured exact-match: 0/4.** But the `seg_debug.py` intermediates prove the
**information is present** — after CLAHE+OTSU the digits are legible (the
screenshot's `76.40` is crisply isolated black-on-white). The 0/4 reflects
**unsolved localization**, not unrecoverable digits, and confirms a 1-shot
untuned classical pipeline is not launch-ready. A fair evaluation of (A) requires
the §3 dataset to tune and measure localization + recognition together.

Reproduce: `scratchpad/ocrvenv/Scripts/python.exe sevenseg_v2.py <4 photo paths>`
(writes `crop_N.png`); `seg_debug.py` writes `dbg_N.png` (gray/CLAHE/adaptive/OTSU).

## 5. Proposed acceptance criteria (set threshold with product owner before final eval)

Measure on a **held-out** test split (session-disjoint), reported separately for
**clear photos / difficult seven-seg / screenshots**:
- Exact numeric match rate (primary).
- Decimal-point accuracy; per-digit accuracy.
- **False acceptance of unrelated numbers = 0%** (hard constraint; already met by
  the current candidate-selection guard).
- Abstention rate (prefer abstain over wrong).
- Latency on target Android devices.

Recommended framing: **high precision, abstain-first.** Because a coach reviews
every photo anyway, the useful target is "auto-fill only when confident, else ask
the client to confirm/retype" — e.g. exact-match ≥ 95% *on accepted readings* with
0% unrelated-number acceptance, at whatever recall the data supports. The product
owner must set the launch threshold; it must be high enough for dependable
automatic logging, and it cannot be evaluated until §3 data exists.

## 6. Physical-device test procedure

See `docs/WEIGHT_OCR_DEVICE_TEST.md` (updated with the 2026-10-10 BlueStacks run).
For the real-device loop: install the EAS preview APK, import the labeled test
set to the gallery, drive the weight-photo flow, and record raw ML Kit text,
extracted candidate, final field value, and latency per image — then compute §5
metrics on the held-out split, never on the tuning images.

## 7. Remaining failure modes + go/no-go

Open failure modes: (a) ML Kit cannot recognize seven-seg at all — must be
replaced for this field; (b) display localization unsolved on angled/low-contrast
camera photos and on screenshots with chrome; (c) generalization across scale
models unknown; (d) no data to train or validate.

**Go/no-go: NO-GO** for automatic OCR as a launch gate on current evidence.
To reach GO: (1) collect + label the §3 dataset (data already arrives via coach
WhatsApp); (2) build approach **A** (classical seven-seg with robust localization
+ perspective) and/or **B** (trained display+digit model), validated on a held-out
split to the §5 threshold; (3) ship capture guidance (C) to raise input quality.
Realistic effort: **weeks**, dominated by data collection/labeling and
localization engineering — not a hours-scale fix.

**Product flag (senior-engineer recommendation):** making automatic OCR *launch-
critical* is worth re-examining. A coach reviews every scale photo, so the
existing **photo-mandatory + manual-entry + evidence-enforced** flow already
delivers a human-verifiable weight today. Consider launching on that flow with
OCR as a *post-launch convenience* gated by §5 metrics, rather than blocking
launch on an automatic recognizer that needs weeks of data work to be dependable.
The shipped safeguards (retry ladder, photo evidence 025/026/027, false-positive
rejection) are verified and remain correct regardless of which path is chosen.

---

## Update 2026-10-10 (round 2) — localization iteration + dataset pipeline delivered

**Localization, 3rd attempt (`scratchpad/sevenseg_v3.py`, connected-component
digit-band detection):** still fails — returned no valid digit band on all 4
photos (dark background merges with strokes under OTSU-inverse; digit-size
filters mis-fire). Running total: three distinct localizer designs (bright-quad,
morph-cluster, connected-component) all failed to crop the display reliably on
this image quality. This is strong evidence that **robust display localization on
reflective low-contrast LCDs is real, non-trivial engineering** that needs a
labeled dataset to tune and a localization benchmark (IoU/corner-error vs
annotations) to measure — not a one-shot heuristic. Measured classical-CV
exact-match remains **0/4**, bottlenecked at localization (recognition of clean
segments is the easy part, as the OTSU debug images show).

**Dataset + evaluation pipeline built and verified** (`tools/weight-ocr-dataset/`):
- `ingest.py` — copies originals, records sha256 + average-hash + dims, flags
  exact/near duplicates, writes one pending annotation record per image.
- `split.py` — session-disjoint 70/15/15 with near-dup union-find guard;
  regression photos pinned out of train/val/test; warns when N < 100.
- `score.py` — exact-match-on-accepted, coverage, false-accept, abstention, with
  Wilson 95% CIs and by-source/quality breakdown; warns NO-GO when sample < 50.
- `README.md` — annotation schema + acceptance criteria; `regression_labels.json`
  — the 4 photos' human ground truth (pinned regression only).
- Verified on the 4 photos: ingest → manifest (checksums/dims/dedup) → split
  correctly reports 0 splittable + the <500 warning. Client images are
  `.gitignore`d (`dataset/.gitignore`) — never committed (personal data).

**Final GO/NO-GO: NO-GO (unchanged).** The pipeline is ready; the dataset is not
collected; localization is unsolved; ML Kit cannot recognize seven-seg. To reach
GO, in order: (1) collect ≥ 500 consented labeled photos via `ingest.py`;
(2) build + benchmark a display localizer to an IoU target; (3) build approach A
and/or B, measure on the held-out split to the §5 thresholds; (4) ship capture
guidance. No production code was changed this round; `tsc`/jest untouched.
