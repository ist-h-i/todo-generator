#!/usr/bin/env python3
"""
Generate per-class/component recipe stubs for Angular TypeScript sources.

Output location:
- Co-located next to the TypeScript source file directory.
- One file per exported class in the same directory: <ClassName>.recipe.md

Scope (default):
- frontend/src/app/**/*.ts (excluding *.spec.ts and test bootstrap files)

Behavior:
- Idempotent: never overwrites existing recipe files.
- Best-effort extraction of exported classes and their public API
  (public methods/properties) using simple regex and brace tracking.

Usage:
- All:            python scripts/generate_class_recipes.py
- Specific path:  python scripts/generate_class_recipes.py frontend/src/app/core
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Iterable, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
CLASSES_RECIPES_ROOT = None  # deprecated central folder; retained for context


def rel_to_repo(path: Path) -> Path:
    return path.resolve().relative_to(REPO_ROOT)


def is_test_ts(p: Path) -> bool:
    posix = rel_to_repo(p).as_posix()
    return posix.endswith(".spec.ts") or posix.endswith("/test.ts")


def iter_ts_files(paths: List[Path]) -> Iterable[Path]:
    if not paths:
        bases = [REPO_ROOT / "frontend" / "src" / "app"]
    else:
        bases = paths

    for base in bases:
        base = base.resolve()
        if base.is_file():
            if base.suffix == ".ts" and not is_test_ts(base):
                yield base
            continue
        if base.is_dir():
            for p in base.rglob("*.ts"):
                if p.is_file() and not is_test_ts(p):
                    yield p


# Regex to capture `export class Name ... {`
EXPORT_CLASS_RE = re.compile(r"export\s+class\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\b")


def find_exported_classes(source: str) -> List[Tuple[str, int]]:
    """Return list of (class_name, start_index_of_opening_brace)."""
    results: List[Tuple[str, int]] = []
    for m in EXPORT_CLASS_RE.finditer(source):
        name = m.group("name")
        # Find the opening brace after the class declaration
        brace_idx = source.find("{", m.end())
        if brace_idx != -1:
            results.append((name, brace_idx))
    return results


def extract_block(source: str, start_brace_index: int) -> Optional[str]:
    """Extract balanced brace block body starting at `{` index (exclusive)."""
    depth = 0
    i = start_brace_index
    n = len(source)
    i += 1  # move past '{'
    body_start = i
    while i < n:
        ch = source[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            if depth == 0:
                # class block ends before this '}'
                return source[body_start:i]
            depth -= 1
        i += 1
    return None


METHOD_RE = re.compile(
    r"^\s*(?:public\s+)?(?:(?:get|set)\s+)?(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\(",
    re.MULTILINE,
)
PROPERTY_RE = re.compile(
    r"^\s*(?:public\s+)?(?:readonly\s+)?(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*(?::|=)",
    re.MULTILINE,
)
VISIBILITY_SKIP_RE = re.compile(r"^\s*(private|protected)\b")


def filter_public_api(body: str) -> Tuple[List[str], List[str]]:
    methods: List[str] = []
    props: List[str] = []

    # Split by lines to check visibility prefixes
    lines = body.splitlines()
    # Build an index to original line starts for later name extraction via regex
    body_with_newlines = body

    # Methods
    for m in METHOD_RE.finditer(body_with_newlines):
        # Backtrack to line start to check visibility keyword
        start = m.start()
        line_start = body_with_newlines.rfind("\n", 0, start) + 1
        line_text = body_with_newlines[line_start : body_with_newlines.find("\n", line_start) if body_with_newlines.find("\n", line_start) != -1 else len(body_with_newlines)]
        if VISIBILITY_SKIP_RE.match(line_text):
            continue
        name = m.group("name")
        if name == "constructor":
            continue
        methods.append(name)

    # Properties
    for m in PROPERTY_RE.finditer(body_with_newlines):
        start = m.start()
        line_start = body_with_newlines.rfind("\n", 0, start) + 1
        line_text = body_with_newlines[line_start : body_with_newlines.find("\n", line_start) if body_with_newlines.find("\n", line_start) != -1 else len(body_with_newlines)]
        if VISIBILITY_SKIP_RE.match(line_text):
            continue
        # Heuristic: if it also looks like a method on this same line, skip (already captured)
        if "(" in line_text and ")" in line_text:
            continue
        name = m.group("name")
        # Skip common TS keywords that may appear as identifiers accidentally
        if name in {"get", "set"}:
            continue
        props.append(name)

    # Deduplicate while preserving order
    def dedup(seq: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for x in seq:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    return dedup(methods), dedup(props)


def recipe_path_for(ts_file: Path, class_name: str) -> Path:
    """Place class recipe next to the TS file's directory.

    Example: frontend/src/app/core/api/status-reports-gateway.ts ->
    frontend/src/app/core/api/StatusReportsGateway.recipe.md
    """
    return ts_file.parent / f"{class_name}.recipe.md"


def generate_recipe_content(ts_file: Path, class_name: str, methods: List[str], props: List[str]) -> str:
    rel = rel_to_repo(ts_file).as_posix()
    lines: List[str] = []
    lines.append(f"# Recipe: {class_name}")
    lines.append("")
    lines.append(f"Source: `{rel}`")
    lines.append("")
    lines.append("## Purpose & Responsibilities")
    lines.append("Briefly describe what this class/component does and when it is used.")
    lines.append("")
    lines.append("## Public API")
    if methods:
        lines.append("- Methods:")
        for n in methods:
            lines.append(f"  - `{n}()` – TODO: description")
    else:
        lines.append("- Methods: (none detected)")
    if props:
        lines.append("- Properties:")
        for n in props:
            lines.append(f"  - `{n}` – TODO: description")
    else:
        lines.append("- Properties: (none detected)")
    lines.append("")
    lines.append("## Notable Dependencies")
    lines.append("List injected services, inputs/outputs, and important collaborators.")
    lines.append("")
    lines.append("## Usage Notes")
    lines.append("How to integrate or extend; constraints and side-effects.")
    lines.append("")
    lines.append("## Change History")
    lines.append("- Seeded by generator. Append context on future changes.")
    lines.append("")
    return "\n".join(lines)


@dataclass
class Stats:
    created: int = 0
    skipped_existing: int = 0


def process_ts_file(path: Path) -> List[Path]:
    created: List[Path] = []
    text = path.read_text(encoding="utf-8", errors="ignore")
    classes = find_exported_classes(text)
    for class_name, brace_idx in classes:
        body = extract_block(text, brace_idx)
        if body is None:
            continue
        methods, props = filter_public_api(body)
        out_path = recipe_path_for(path, class_name)
        if out_path.exists():
            continue
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            generate_recipe_content(path, class_name, methods, props),
            encoding="utf-8",
        )
        created.append(out_path)
    return created


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate per-class/component recipes for Angular TS sources.")
    parser.add_argument("paths", nargs="*", type=Path, help="Optional file/dir paths to limit scope.")
    args = parser.parse_args(argv)

    stats = Stats()
    for ts in iter_ts_files(args.paths):
        created = process_ts_file(ts)
        if created:
            stats.created += len(created)
        else:
            # If files exist already, assume skipped
            pass

    print(f"Created: {stats.created}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
