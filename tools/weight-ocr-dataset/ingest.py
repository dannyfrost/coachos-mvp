#!/usr/bin/env python3
"""Ingest raw scale photos into the dataset: copy originals, compute
checksums + average-hash, record dims, flag exact/near duplicates, and
write one pending annotation record per image to manifest.jsonl.

Never fabricates labels — ground_truth and quality are left null/empty for
a human to fill. Idempotent: re-running updates records by image_id.
"""
import argparse, hashlib, json, os, shutil, sys
import cv2, numpy as np

QUALITY_VOCAB = ["blur", "glare", "low_contrast", "perspective", "occlusion", "ok"]

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def ahash(path):
    img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, None
    h, w = img.shape
    small = cv2.resize(img, (8, 8), interpolation=cv2.INTER_AREA)
    bits = (small > small.mean()).flatten()
    val = 0
    for b in bits:
        val = (val << 1) | int(b)
    return f"{val:016x}", (w, h)

def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")

def load_manifest(p):
    recs = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    r = json.loads(line)
                    recs[r["image_id"]] = r
    return recs

def new_record(src, digest, ah, dims, regression):
    return {
        "image_id": f"img_{digest[:12]}",
        "src_path": os.path.basename(src),
        "sha256": digest,
        "ahash": ah,
        "width": dims[0] if dims else None,
        "height": dims[1] if dims else None,
        "ground_truth": None,
        "legible": None,
        "display_type": None,
        "scale_model": None,
        "session_id": None,
        "source": None,
        "quality": [],
        "display_bbox": None,
        "annotation_status": "pending",
        "reviewer": None,
        "split": "regression" if regression else None,
        "near_dup_of": None,
        "exact_dup_of": None,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="indir", help="folder of raw images")
    ap.add_argument("--out", required=True, help="dataset root")
    ap.add_argument("--regression", nargs="*", default=[], help="paths pinned as regression cases")
    ap.add_argument("--regression-labels", default=None,
                    help="regression_labels.json to apply by src_match substring")
    ap.add_argument("--near-dup-threshold", type=int, default=5, help="max ahash hamming for near-dup")
    a = ap.parse_args()

    reg_labels = []
    if a.regression_labels and os.path.exists(a.regression_labels):
        with open(a.regression_labels, encoding="utf-8") as f:
            reg_labels = json.load(f).get("labels", [])

    def apply_label(rec, src):
        base = os.path.basename(src)
        for lb in reg_labels:
            if lb.get("src_match") and lb["src_match"] in base:
                for k in ("ground_truth", "legible", "source", "display_type",
                          "scale_model", "quality", "session_id"):
                    if k in lb:
                        rec[k] = lb[k]
                rec["annotation_status"] = "reviewed"
                rec["reviewer"] = lb.get("reviewer", "regression_seed")
                return True
        return False

    originals = os.path.join(a.out, "originals")
    os.makedirs(originals, exist_ok=True)
    manifest_path = os.path.join(a.out, "manifest.jsonl")
    recs = load_manifest(manifest_path)

    jobs = []
    for p in a.regression:
        jobs.append((p, True))
    if a.indir:
        for fn in sorted(os.listdir(a.indir)):
            if fn.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                jobs.append((os.path.join(a.indir, fn), False))

    added = 0
    for src, regression in jobs:
        digest = sha256(src)
        ah, dims = ahash(src)
        iid = f"img_{digest[:12]}"
        if iid in recs:
            if regression:
                recs[iid]["split"] = "regression"
            continue
        rec = new_record(src, digest, ah, dims, regression)
        # exact + near duplicate detection against existing records
        for other in recs.values():
            if other["sha256"] == digest:
                rec["exact_dup_of"] = other["image_id"]; break
            if ah and other.get("ahash") and hamming(ah, other["ahash"]) <= a.near_dup_threshold:
                rec["near_dup_of"] = other["image_id"]
        if regression:
            apply_label(rec, src)
        ext = os.path.splitext(src)[1].lower() or ".jpg"
        shutil.copy2(src, os.path.join(originals, iid + ext))
        recs[iid] = rec
        added += 1

    with open(manifest_path, "w", encoding="utf-8") as f:
        for r in recs.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    labeled = sum(1 for r in recs.values() if r["ground_truth"] is not None)
    print(f"ingested {added} new; manifest total {len(recs)}; labeled {labeled}; "
          f"regression {sum(1 for r in recs.values() if r['split']=='regression')}")
    print(f"Quality vocab: {QUALITY_VOCAB}")
    print("Next: label manifest.jsonl (ground_truth, legible, quality, session_id, source, display_bbox), then split.py")

if __name__ == "__main__":
    main()
