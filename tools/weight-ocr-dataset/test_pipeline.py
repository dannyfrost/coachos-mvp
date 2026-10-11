#!/usr/bin/env python3
"""Self-checks for the dataset pipeline's safety-critical logic:
leak isolation in split.union_find and correctness in score. Run:
  python test_pipeline.py
No images or cv2 needed (split/score are stdlib-only)."""
import split, score

def rec(iid, session=None, near=None, exact=None, split_=None):
    return {"image_id": iid, "session_id": session, "near_dup_of": near,
            "exact_dup_of": exact, "split": split_}

def test_near_dup_same_group():
    recs = [rec("a", session="s1"), rec("b", session="s2", near="a")]
    g = split.union_find(recs)
    roots = {r: k for k, ids in g.items() for r in ids}
    assert roots["a"] == roots["b"], "near-duplicates must land in the same group"

def test_exact_dup_same_group():
    # same content, DIFFERENT session labels -> must still be grouped (no leak)
    recs = [rec("a", session="s1"), rec("b", session="s2", exact="a")]
    g = split.union_find(recs)
    roots = {r: k for k, ids in g.items() for r in ids}
    assert roots["a"] == roots["b"], "exact duplicates must land in the same group (leak guard)"

def test_norm_numeric_equivalence():
    # 76.40 and 76.4 are the same weight; must score as a match
    assert score.norm("76.40") == score.norm("76.4"), "trailing-zero decimals must compare equal"
    # but a dropped decimal is NOT the same value
    assert score.norm("7640") != score.norm("76.40"), "missing decimal must NOT match"
    assert score.norm("76,4") == score.norm("76.4"), "comma separator must normalize"

def test_wilson_bounds():
    p, lo, hi = score.wilson(0, 30)
    assert p == 0.0 and lo == 0.0 and hi > 0.0, "0/N must give a non-zero upper bound"

if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn(); print(f"PASS {name}")
            except AssertionError as e:
                fails += 1; print(f"FAIL {name}: {e}")
    print(f"\n{'ALL PASS' if not fails else str(fails)+' FAILED'}")
    raise SystemExit(1 if fails else 0)
