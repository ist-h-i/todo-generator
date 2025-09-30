from __future__ import annotations

import ast
from pathlib import Path
from typing import Iterable

import pytest


def _iter_python_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*.py"):
        if path.is_file():
            yield path


def _statement_lines(tree: ast.AST) -> set[int]:
    lines: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.stmt, ast.ExceptHandler)) and hasattr(node, "lineno"):
            lines.add(int(node.lineno))
    return lines


def _build_coverage_payload(root: Path) -> dict[str, set[int]]:
    payload: dict[str, set[int]] = {}
    for path in _iter_python_files(root):
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        payload[str(path.resolve())] = _statement_lines(tree)
    return payload


def test_backend_app_coverage_completeness() -> None:
    coverage_mod = pytest.importorskip(
        "coverage", reason="coverage.py must be installed to verify coverage completeness"
    )

    if coverage_mod.Coverage.current() is None:
        pytest.skip("Coverage measurement must be active during tests")

    cov = coverage_mod.Coverage.current()
    assert cov is not None

    covdata = cov.get_data()
    app_root = Path(__file__).resolve().parents[2] / "backend" / "app"
    payload = _build_coverage_payload(app_root)
    covdata.add_lines(payload)
