from __future__ import annotations
import json, pathlib, statistics as st
from collections import defaultdict

METRICS = pathlib.Path("codex_output/metrics/metrics.jsonl")
OUT_JSON = pathlib.Path("codex_output/metrics/roles.json")


def load_lines():
    if not METRICS.exists():
        return []
    rows = []
    for line in METRICS.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except Exception:
            pass
    return rows


def aggregate(rows):
    by_role = defaultdict(list)
    for r in rows:
        by_role[r.get("role", "Unknown")].append(r)

    out = []
    for role, items in by_role.items():
        activity = sum(1 for _ in items)
        return_rate = st.mean([i.get("return_rate", 0.0) for i in items]) if items else 0.0
        fail_rate = st.mean([i.get("fail_rate", 0.0) for i in items]) if items else 0.0
        cost = st.mean([i.get("tokens", 0.0) for i in items]) if items else 0.0
        contrib = st.mean([i.get("contrib", 0.0) for i in items]) if items else 0.0
        out.append({
            "role": role,
            "activity": float(activity),
            "return_rate": float(return_rate),
            "fail_rate": float(fail_rate),
            "cost": float(cost),
            "contrib": float(contrib),
            "idle_runs": 0,
            "prompt_embedding": [0.0, 0.0, 0.0],  # placeholder (LLM埋め込みは別途拡張)
        })

    # グローバル失敗パターン（簡易ダミー）
    global_patterns = [{"topic": "i18n_missing", "count": 0}, {"topic": "sbom_gap", "count": 0}]
    return {"roles": out, "global_fail_patterns": global_patterns}


def main():
    rows = load_lines()
    agg = aggregate(rows)
    OUT_JSON.write_text(json.dumps(agg, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
