#!/usr/bin/env python3
"""
Generate per-file recipe stubs under docs/recipes/ following the convention in
docs/recipes/README.md. By default, scans common source roots and creates
missing recipes only (does not overwrite existing files).

Scope (default):
- backend/app/**/*.py (excluding tests)
- frontend/src/**/*.ts (excluding *.spec.ts and test entry files)

You can also pass specific file or directory paths to limit generation.
"""
from __future__ import annotations

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Iterable, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
RECIPES_ROOT = REPO_ROOT / "docs" / "recipes"


def rel_to_repo(path: Path) -> Path:
    return path.resolve().relative_to(REPO_ROOT)


def recipe_path_for(source_path: Path) -> Path:
    rel = rel_to_repo(source_path).as_posix().replace("/", "__")
    return RECIPES_ROOT / f"{rel}.recipe.md"


def is_test_path(p: Path) -> bool:
    posix = rel_to_repo(p).as_posix()
    if "/tests/" in posix:
        return True
    if posix.endswith(".spec.ts"):
        return True
    # Skip Angular runner and test bootstrap files
    if posix.endswith("/test.ts"):
        return True
    return False


def iter_source_files(paths: List[Path]) -> Iterable[Path]:
    if not paths:
        # Defaults
        candidates = [
            REPO_ROOT / "backend" / "app",
            REPO_ROOT / "frontend" / "src",
        ]
    else:
        candidates = paths

    for base in candidates:
        base = base.resolve()
        if base.is_file():
            if not is_test_path(base) and base.suffix in {".py", ".ts"}:
                yield base
            continue
        if base.is_dir():
            for p in base.rglob("*"):
                if p.is_file() and p.suffix in {".py", ".ts"} and not is_test_path(p):
                    yield p


def extract_py_symbols(path: Path) -> Tuple[List[str], List[str]]:
    funcs: List[str] = []
    variables: List[str] = []
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except Exception:
        return funcs, variables

    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            funcs.append(node.name)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    variables.append(t.id)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                variables.append(node.target.id)
        # Include FastAPI routers and app instances named at module level
        elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            # best-effort; skip for now
            pass
    return sorted(set(funcs)), sorted(set(variables))


TS_EXPORT_RE = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:(?:async\s+)?function\s+(?P<fn>[A-Za-z0-9_]+)|"
    r"(?:(?:const|let|var)\s+(?P<var>[A-Za-z0-9_]+))|(?:class\s+(?P<cls>[A-Za-z0-9_]+))|(?:interface\s+(?P<intf>[A-Za-z0-9_]+)))",
    re.MULTILINE,
)


def extract_ts_symbols(path: Path) -> Tuple[List[str], List[str]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    fns: List[str] = []
    vars_: List[str] = []
    for m in TS_EXPORT_RE.finditer(text):
        if m.group("fn"):
            fns.append(m.group("fn"))
        if m.group("var"):
            vars_.append(m.group("var"))
    return sorted(set(fns)), sorted(set(vars_))


def generate_recipe_content(source_path: Path, fns: List[str], vars_: List[str]) -> str:
    rel = rel_to_repo(source_path).as_posix()
    lines = []
    lines.append(f"# Recipe: {rel}")
    lines.append("")
    lines.append("## Purpose & Entry Points")
    lines.append("Describe the feature, primary responsibilities, and how callers reach it.")
    lines.append("")
    lines.append("## Key Functions")
    if fns:
        for n in fns:
            lines.append(f"- `{n}` – TODO: description, params, returns")
    else:
        lines.append("- (none detected)")
    lines.append("")
    lines.append("## Important Variables")
    if vars_:
        for n in vars_:
            lines.append(f"- `{n}` – TODO: meaning, defaults, mutation points")
    else:
        lines.append("- (none detected)")
    lines.append("")
    lines.append("## Interactions & Dependencies")
    lines.append("List collaborating modules, services, routers, and UI bindings.")
    lines.append("")
    lines.append("## Testing Notes")
    lines.append("Reference tests, fixtures, common error scenarios.")
    lines.append("")
    lines.append("## Change History")
    lines.append("- Seeded by generator: TODO add context for future changes.")
    lines.append("")
    return "\n".join(lines)


def write_recipe(source_path: Path) -> Path | None:
    recipe_path = recipe_path_for(source_path)
    if recipe_path.exists():
        return None  # do not overwrite

    if source_path.suffix == ".py":
        fns, vars_ = extract_py_symbols(source_path)
    elif source_path.suffix == ".ts":
        fns, vars_ = extract_ts_symbols(source_path)
    else:
        return None

    recipe_path.parent.mkdir(parents=True, exist_ok=True)
    content = generate_recipe_content(source_path, fns, vars_)
    recipe_path.write_text(content, encoding="utf-8")
    return recipe_path


@dataclass
class Stats:
    created: int = 0
    skipped_existing: int = 0


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate per-file recipe stubs.")
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Optional files or directories to limit generation.",
    )
    args = parser.parse_args(argv)

    stats = Stats()
    for p in iter_source_files(args.paths):
        target = recipe_path_for(p)
        if target.exists():
            stats.skipped_existing += 1
            continue
        out = write_recipe(p)
        if out is not None:
            stats.created += 1

    print(f"Created: {stats.created}, Skipped existing: {stats.skipped_existing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

