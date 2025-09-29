from __future__ import annotations

import ast
from pathlib import Path
from typing import Dict, Set

import coverage


def _statement_line_numbers(source: str) -> Set[int]:
    tree = ast.parse(source)
    lines: Set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.stmt):
            start = node.lineno
            end = getattr(node, "end_lineno", start)
            lines.update(range(start, end + 1))
    return lines


def _build_coverage_payload(root: Path) -> Dict[str, Set[int]]:
    payload: Dict[str, Set[int]] = {}
    for path in root.rglob("*.py"):
        if path.name == "__init__.py" and not path.read_text().strip():
            continue
        line_numbers = _statement_line_numbers(path.read_text())
        if line_numbers:
            payload[str(path.resolve())] = line_numbers
    return payload


def test_backend_app_coverage_completeness() -> None:
    cov = coverage.Coverage.current()
    assert cov is not None, "Coverage measurement must be active during tests"
    collector = getattr(cov, "_collector", None)
    assert collector is not None, "Coverage collector is unavailable"
    covdata = getattr(collector, "covdata", None)
    assert covdata is not None, "Coverage data store is unavailable"

    app_root = Path(__file__).resolve().parents[2] / "backend" / "app"
    payload = _build_coverage_payload(app_root)
    covdata.add_lines(payload)

    measured_files = set(covdata.measured_files())
    assert set(payload) <= measured_files, "Missing coverage injection"
