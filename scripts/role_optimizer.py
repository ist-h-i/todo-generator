from __future__ import annotations
import json
from pathlib import Path

METRICS = Path("codex_output/metrics/roles.json")
POLICY_YML = Path(".codex/auto_evolve/policy.yml")
OUT = Path("codex_output/auto_evolve/proposals.json")


def load_metrics():
    data = json.loads(METRICS.read_text(encoding="utf-8")) if METRICS.exists() else {"roles": [], "global_fail_patterns": []}
    return data


def load_policy():
    # 最小実装: YAML依存を避け、JSONも許容
    try:
        import yaml
    except ModuleNotFoundError as exc:  # pragma: no cover - defensive
        raise RuntimeError(
            "PyYAML is required to load .codex/auto_evolve/policy.yml. Install it via `pip install PyYAML`."
        ) from exc
    return yaml.safe_load(POLICY_YML.read_text(encoding="utf-8"))


def normalize(val, lo, hi):
    return 0.0 if hi - lo <= 1e-9 else max(0.0, min(1.0, (val - lo) / (hi - lo)))


def health_score(role, stats):
    # health = 0.25*z(activity) + 0.25*(1-return) + 0.2*(1-fail) + 0.2*contrib - 0.1*z(cost)
    z = lambda x, k: normalize(role.get(k, 0.0), stats[k][0], stats[k][1])
    return (
        0.25 * z(role, "activity") +
        0.25 * (1 - role.get("return_rate", 0.0)) +
        0.20 * (1 - role.get("fail_rate", 0.0)) +
        0.20 * role.get("contrib", 0.0) -
        0.10 * z(role, "cost")
    )


def compute_stats(roles):
    def bounds(key):
        vals = [r.get(key, 0.0) for r in roles]
        return (min(vals) if vals else 0.0, max(vals) if vals else 1.0)
    return {k: bounds(k) for k in ("activity", "cost")}


def propose(data, policy):
    roles = data.get("roles", [])
    stats = compute_stats(roles)

    # A) idle detection
    idle = [r for r in roles if r.get("activity", 0.0) == 0.0 or r.get("idle_runs", 0) >= 20]

    # B) consolidation (最小実装: 同名prefixで冗長候補を仮検出)
    redundant_pairs = []
    for i, ri in enumerate(roles):
        for j, rj in enumerate(roles[i+1:], i+1):
            if ri["role"].split()[0] == rj["role"].split()[0]:
                redundant_pairs.append({"a": ri["role"], "b": rj["role"], "reason": "name-prefix-match"})

    # C) gaps
    gaps = [g for g in data.get("global_fail_patterns", []) if g.get("count", 0) >= 5]

    # D) route optimization (ダミー提案)
    routing = {"suggest": "increase_weight:AI_Safety"}

    # health score
    for r in roles:
        r["health"] = health_score(r, stats)

    return {
        "idle": idle,
        "redundant_pairs": redundant_pairs,
        "gaps": gaps,
        "routing": routing,
        "roles": roles,
        "policy": policy,
    }


def main():
    data = load_metrics()
    policy = load_policy()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(propose(data, policy), indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
