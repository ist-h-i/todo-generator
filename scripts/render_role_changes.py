from __future__ import annotations
import json, argparse
from pathlib import Path

OUT_DIR = Path("codex_output/auto_evolve")


def mermaid_from_roles(roles):
    nodes = "\n".join([f"  {r['role'].replace(' ', '_')}[\"{r['role']}\\nhealth: {r.get('health', 0):.2f}\"]" for r in roles])
    # エッジは最小ダミー（実装で更新）
    edges = "\n".join(["  Translator --> Planner", "  Planner --> Coder", "  Coder --> Code_Quality_Reviewer", "  Coder --> Security_Reviewer", "  Security_Reviewer --> Integrator", "  Code_Quality_Reviewer --> Integrator", "  Integrator --> Release_Manager", "  Release_Manager --> DocWriter", "  DocWriter --> Doc_Editor"])
    return f"""flowchart LR\n{nodes}\n{edges}\n"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proposals", required=True)
    args = ap.parse_args()

    data = json.loads(Path(args.proposals).read_text(encoding="utf-8"))
    roles = data.get("roles", [])
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Graph before/after（初回は after のみ）
    (OUT_DIR / "graph_before_after.md").write_text(
        "# Workflow Graph (candidate)\n\n```mermaid\n" + mermaid_from_roles(roles) + "```\n",
        encoding="utf-8",
    )

    # Experiment plan
    (OUT_DIR / "experiment_plan.md").write_text(
        """# Experiment Plan\n- Canary: 10% of tasks (flags.json: canary_ratio)\n- Success: CI time -5% OR return_rate -10%, and defect density +0% ~ +10% max\n- Metrics window: 7 days\n- Review gates: keep human approval for disable/delete\n""",
        encoding="utf-8",
    )

    # Rollback
    (OUT_DIR / "rollback.md").write_text(
        """# Rollback\n- Restore `.codex/flags.json` previous commit\n- Re-run guardrails job or dispatch manual rollback\n- Announce in PR with metrics snapshot\n""",
        encoding="utf-8",
    )

if __name__ == "__main__":
    main()
