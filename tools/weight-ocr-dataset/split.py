#!/usr/bin/env python3
"""Assign train/val/test splits to manifest.jsonl, session-disjoint so no
capture session (or near-duplicate) spans partitions. Images pinned to the
'regression' split (the original failing photos) are left untouched and
never enter train/val/test. Deterministic given --seed.

Split is by session_id: every image sharing a session goes to one side.
Near-duplicates (near_dup_of chains) are forced into the same session group
so they can't leak across partitions even if session_id was mislabeled.
"""
import argparse, json, os, random
from collections import defaultdict

def load(p):
    with open(p, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def union_find(recs):
    parent = {r["image_id"]: r["image_id"] for r in recs}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    def union(a, b):
        parent[find(a)] = find(b)
    by_session = defaultdict(list)
    for r in recs:
        if r.get("session_id"):
            by_session[r["session_id"]].append(r["image_id"])
    for ids in by_session.values():
        for i in ids[1:]:
            union(ids[0], i)
    for r in recs:
        if r.get("near_dup_of"):
            union(r["image_id"], r["near_dup_of"])
        # Exact duplicates must also never span partitions, even if their
        # session_id labels differ — group them too (leak guard).
        if r.get("exact_dup_of"):
            union(r["image_id"], r["exact_dup_of"])
    groups = defaultdict(list)
    for r in recs:
        groups[find(r["image_id"])].append(r["image_id"])
    return groups

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--ratios", default="0.70,0.15,0.15")
    ap.add_argument("--seed", type=int, default=1337)
    a = ap.parse_args()
    mp = os.path.join(a.dataset, "manifest.jsonl")
    recs = load(mp)
    by_id = {r["image_id"]: r for r in recs}
    pool = [r for r in recs if r.get("split") != "regression"]
    rtr, rva, rte = (float(x) for x in a.ratios.split(","))

    groups = union_find(pool)
    gids = [g for g in groups if any(by_id[i].get("split") != "regression" for i in groups[g])]
    random.Random(a.seed).shuffle(gids)
    n = len(pool)
    assigned = {"train": 0, "val": 0, "test": 0}
    want = {"train": rtr * n, "val": rva * n, "test": rte * n}
    for g in gids:
        members = [i for i in groups[g] if by_id[i].get("split") != "regression"]
        # place whole group where it leaves the biggest proportional deficit
        tgt = max(("train", "val", "test"),
                  key=lambda k: (want[k] - assigned[k]) / max(want[k], 1))
        for i in members:
            by_id[i]["split"] = tgt
        assigned[tgt] += len(members)

    with open(mp, "w", encoding="utf-8") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    reg = sum(1 for r in recs if r.get("split") == "regression")
    print(f"groups {len(gids)} (session-disjoint) | train {assigned['train']} "
          f"val {assigned['val']} test {assigned['test']} | regression {reg} (pinned, excluded)")
    if n < 100:
        print(f"WARNING: only {n} splittable images -- far below the >=500 needed to "
              f"validate to launch criteria. Splits are not statistically meaningful yet.")

if __name__ == "__main__":
    main()
