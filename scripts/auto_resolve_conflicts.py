#!/usr/bin/env python3
"""AI-assisted Git merge conflict resolver (ChatGPT-auth Codex CLI)."""

from __future__ import annotations
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import List, Sequence, Tuple

# ---- Config -----------------------------------------------------------------
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", "300000"))  # skip huge files
CONFLICT_RE = re.compile(r"<<<<<<<|=======|>>>>>>>")
CODEX_BIN = os.getenv("CODEX_BIN", "codex")
CODEX_SANDBOX = os.getenv("CODEX_SANDBOX", "workspace-write")  # workspace-write recommended

# ---- Shell helpers -----------------------------------------------------------
def run_cmd(cmd: Sequence[str], *, capture: bool = False, cwd: str | None = None, stdin: str | None = None) -> Tuple[str, str, int]:
    res = subprocess.run(  # noqa: S603
        list(cmd),
        cwd=cwd,
        check=False,
        text=True,
        input=stdin if stdin is not None else None,
        capture_output=capture,
    )
    if capture:
        return res.stdout or "", res.stderr or "", res.returncode
    return "", "", res.returncode

# ---- Git helpers -------------------------------------------------------------
def get_conflicted_files() -> List[str]:
    out, _, _ = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"], capture=True)
    return [p.strip() for p in out.splitlines() if p.strip()]

def is_text_and_reasonable(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        size = path.stat().st_size
    except FileNotFoundError:
        return False
    if size > MAX_FILE_BYTES:
        print(f"⏭️  Skip large file: {path} ({size} bytes)")
        return False
    try:
        _ = path.read_text(encoding="utf-8")
        return True
    except UnicodeDecodeError:
        print(f"⏭️  Skip non-utf8 file: {path}")
        return False

def read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")

# ---- Codex helpers -----------------------------------------------------------
def codex_available() -> bool:
    if not shutil.which(CODEX_BIN):
        return False
    # ChatGPT auth file created by `codex login`
    auth_path = Path(os.path.expanduser("~")) / ".codex" / "auth.json"
    return auth_path.is_file()

def resolve_with_codex(filename: str) -> bool:
    """Ask Codex CLI to edit the target file in-place and remove markers."""
    instructions = f"""Resolve Git merge conflicts only in this file:
- Path: {filename}
Rules:
- Edit {filename} in-place. Remove all conflict markers (<<<<<<<, =======, >>>>>>>).
- Preserve surrounding context and project conventions.
- Do not modify any other files.
- Do not commit. After editing, run `git add {filename}`.
Output:
- Return a brief summary only; edits must be applied to the workspace.
"""
    cmd = [CODEX_BIN, "exec", "--quiet", "--sandbox", CODEX_SANDBOX]
    out, err, code = run_cmd(cmd, capture=True, stdin=instructions)
    if code != 0:
        print(f"❌ Codex failed for {filename} (exit {code})")
        if out.strip():
            print(out.strip())
        if err.strip():
            print(err.strip())
        return False
    # Stage if Codex succeeded
    run_cmd(["git", "add", filename])
    return True

# ---- Main logic --------------------------------------------------------------
def main() -> None:
    if not codex_available():
        raise SystemExit(
            "Codex CLI with ChatGPT auth is required. Ensure `codex` is in PATH and ~/.codex/auth.json exists."
        )

    conflicted_paths = [Path(p) for p in get_conflicted_files()]
    if not conflicted_paths:
        print("✅ No conflicts.")
        return

    resolved_any = False
    unresolved: List[str] = []

    for path in conflicted_paths:
        if not is_text_and_reasonable(path):
            unresolved.append(str(path))
            continue

        original = read_file(path)
        if not CONFLICT_RE.search(original):
            print(f"ℹ️  No markers found in {path}, staging as-is.")
            run_cmd(["git", "add", str(path)])
            resolved_any = True
            continue

        print(f"🔧 Resolving with Codex: {path}")
        ok = resolve_with_codex(str(path))
        if not ok:
            unresolved.append(str(path))
            continue

        # Verify markers removed
        fixed = read_file(path)
        if not fixed or CONFLICT_RE.search(fixed):
            print(f"❗ Still contains conflict markers after Codex edit: {path}")
            unresolved.append(str(path))
            continue

        resolved_any = True
        print(f"✅ Resolved: {path}")

    if unresolved:
        print("🚨 Unresolved files remain:")
        for f in unresolved:
            print(f" - {f}")
        raise SystemExit(1)

    if not resolved_any:
        print("⚠️ Nothing resolved.")
    else:
        print("🎉 All conflicts resolved and staged. Commit happens in the workflow step.")

if __name__ == "__main__":
    main()
