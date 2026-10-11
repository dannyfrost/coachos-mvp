#!/usr/bin/env python3
"""Audit a dataset manifest for readiness: counts, label completeness,
scale/display diversity, camera-vs-screenshot balance, capture-session
distribution, duplicate flags, and split sizes. Read-only. Run:
  python dataset_audit.py --dataset ../../dataset
"""
import argparse, json, os
from collections import Counter

REQUIRED = ["ground_truth", "legible", "source", "session_id", "display_type", "quality"]
MIN_TOTAL = 500

def load(p):
    with open(p, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def pct(a, b):
    return f"{(100*a/b):.1f}%" if b else "n/a"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dataset", required=True)
    a = ap.parse_args()
    recs = load(os.path.join(a.dataset, "manifest.jsonl"))
    n = len(recs)
    print(f"=== DATASET AUDIT ({a.dataset}) ===")
    print(f"total images: {n}")

    non_reg = [r for r in recs if r.get("split") != "regression"]
    reg = [r for r in recs if r.get("split") == "regression"]
    print(f"  regression (pinned): {len(reg)} | collectable (non-regression): {len(non_reg)}")

    labeled = [r for r in recs if r.get("ground_truth") is not None]
    print(f"label completeness: {len(labeled)}/{n} have ground_truth ({pct(len(labeled),n)})")
    for f in REQUIRED:
        miss = sum(1 for r in recs if not r.get(f) and r.get(f) != 0)
        print(f"  missing {f}: {miss}")

    print("source: " + dict_str(Counter(r.get("source") or "unlabeled" for r in recs)))
    print("display_type: " + dict_str(Counter(r.get("display_type") or "unlabeled" for r in recs)))
    print("scale_model: " + dict_str(Counter(r.get("scale_model") or "unknown" for r in recs)))
    print("legible: " + dict_str(Counter(str(r.get("legible")) for r in recs)))

    q = Counter()
    for r in recs:
        for tag in (r.get("quality") or []):
            q[tag] += 1
    print("quality tags: " + dict_str(q))

    sessions = Counter(r.get("session_id") or "unlabeled" for r in recs)
    print(f"capture sessions: {len(sessions)} distinct")
    biggest = sessions.most_common(1)
    if biggest:
        s, c = biggest[0]
        print(f"  largest session '{s}': {c} images ({pct(c,n)}) "
              f"{'-- WARNING: session concentration inflates eval' if n and c/n>0.1 else ''}")

    exact = sum(1 for r in recs if r.get("exact_dup_of"))
    near = sum(1 for r in recs if r.get("near_dup_of"))
    print(f"duplicates flagged: exact {exact}, near {near} (grouped by split.py so they can't leak)")

    splits = Counter(r.get("split") or "unsplit" for r in recs)
    print("splits: " + dict_str(splits))

    print("\n=== READINESS ===")
    blockers = []
    if n < MIN_TOTAL:
        blockers.append(f"only {n} images; need >= {MIN_TOTAL}")
    if len(labeled) < n:
        blockers.append(f"{n-len(labeled)} images unlabeled")
    camera = sum(1 for r in recs if r.get("source") == "camera")
    shot = sum(1 for r in recs if r.get("source") == "screenshot")
    if n and (camera == 0 or shot == 0):
        blockers.append("need BOTH camera photos and screenshots represented")
    models = set(r.get("scale_model") for r in recs if r.get("scale_model"))
    if len(models) < 3:
        blockers.append(f"only {len(models)} known scale models; need diversity across the client base")
    if blockers:
        print("NOT READY for benchmarking:")
        for b in blockers:
            print(f"  - {b}")
    else:
        print("READY: proceed to localization benchmark then recognition benchmark.")

def dict_str(c):
    return ", ".join(f"{k}={v}" for k, v in sorted(c.items(), key=lambda kv: -kv[1]))

if __name__ == "__main__":
    main()
