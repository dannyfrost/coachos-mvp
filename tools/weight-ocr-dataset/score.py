#!/usr/bin/env python3
"""Score a recognizer against the launch acceptance criteria on a chosen
split. Reads ground truth from manifest.jsonl and predictions from a
preds.jsonl ({"image_id","pred","accepted"}). Reports numerator/denominator,
Wilson 95% CIs, abstention, and a by-source/by-quality breakdown.

Metrics (on the selected split, default 'test'):
  exact_match_on_accepted = correct / accepted   (readable, in-scope only)
  coverage                = accepted / readable_in_scope
  false_accept (challenge)= accepted-and-wrong on challenge items
Illegible images are excluded from exact-value scoring, counted for
abstention. Thresholds are NOT applied here as pass/fail blindly — the
numbers are reported for the product-owner decision.
"""
import argparse, json, math, os
from collections import defaultdict

def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, c - h), min(1.0, c + h))

def norm(s):
    # Canonical numeric form so 76.40 == 76.4 and 76,4 == 76.4, but a
    # dropped decimal (7640) stays distinct from 76.4. Non-numeric strings
    # (challenge junk) fall through to the stripped text.
    if s is None:
        return None
    t = str(s).strip().replace(",", ".")
    try:
        return f"{float(t):g}"
    except ValueError:
        return t

def load(p):
    with open(p, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--preds", required=True)
    ap.add_argument("--split", default="test")
    a = ap.parse_args()
    recs = {r["image_id"]: r for r in load(os.path.join(a.dataset, "manifest.jsonl"))}
    preds = {p["image_id"]: p for p in load(a.preds)}

    sel = [r for r in recs.values() if r.get("split") == a.split]
    readable = [r for r in sel if r.get("legible") is True and r.get("ground_truth") is not None]
    challenge = [r for r in sel if r.get("legible") is False or r.get("ground_truth") is None]

    acc = cor = 0
    by = defaultdict(lambda: [0, 0])  # key -> [accepted, correct]
    for r in readable:
        p = preds.get(r["image_id"], {})
        if p.get("accepted"):
            acc += 1
            ok = norm(p.get("pred")) == norm(r["ground_truth"])
            cor += ok
            k = r.get("source") or "unknown"
            by[k][0] += 1; by[k][1] += ok
    fa = sum(1 for r in challenge if preds.get(r["image_id"], {}).get("accepted"))

    print(f"=== split={a.split} | readable_in_scope={len(readable)} challenge={len(challenge)} ===")
    if len(readable):
        em, lo, hi = wilson(cor, acc)
        cov, clo, chi = wilson(acc, len(readable))
        print(f"exact_match_on_accepted = {cor}/{acc} = {em:.3f} (95% CI {lo:.3f}-{hi:.3f})  [target >=0.98]")
        print(f"coverage                = {acc}/{len(readable)} = {cov:.3f} (95% CI {clo:.3f}-{chi:.3f})  [target >=0.90]")
        print(f"abstention              = {len(readable)-acc}/{len(readable)}")
    _, _, fa_hi = wilson(fa, max(len(challenge), 1))
    print(f"false_accept (challenge) = {fa}/{len(challenge)}  (Wilson 95% upper bound {fa_hi:.3f})  [target 0]")
    for k, (na, nc) in sorted(by.items()):
        print(f"  by source {k}: {nc}/{na} exact on accepted")
    if len(readable) < 50:
        print("WARNING: sample far too small for a launch decision. NO-GO until >=500 labeled images exist.")

if __name__ == "__main__":
    main()
