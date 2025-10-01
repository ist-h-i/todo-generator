#!/usr/bin/env python3
"""AI-assisted Git merge conflict resolver (OpenAI)."""

from __future__ import annotations
import os
import re
import subprocess
from pathlib import Path
from typing import List, Sequence, Tuple

from openai import OpenAI

# ---- Config -----------------------------------------------------------------
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", "300000"))  # skip huge files
CONFLICT_RE = re.compile(r"<<<<<<<|=======|>>>>>>>")

# Configure OpenAI from env (OPENAI_API_KEY; optionally OPENAI_BASE_URL)
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise SystemExit("Missing OPENAI_API_KEY")
base_url = os.getenv("OPENAI_BASE_URL")  # Azure/OpenAI-compatible endpoints用に任意
client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)

# ---- Shell helpers -----------------------------------------------------------
def run_cmd(cmd: Sequence[str], *, capture: bool = False, cwd: str | None = None) -> Tuple[str, str, int]:
    res = subprocess.run(list(cmd), cwd=cwd, check=False, text=True, capture_output=capture)  # noqa: S603
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
    if path.stat().st_size > MAX_FILE_BYTES:
        print(f"⏭️  Skip large file: {path} ({path.stat().st_size} bytes)")
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

# ---- LLM prompt --------------------------------------------------------------
SYS_PROMPT = """You are a senior software engineer.
Resolve Git merge conflicts inside the given file content.
Remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
Preserve surrounding context and project conventions.
Return ONLY the final file content. No explanations, no code fences.
"""

def strip_fences(text: str) -> str:
    m = re.search(r"```(?:\w+)?\n([\s\S]*?)\n```", text)
    return m.group(1) if m else text

def resolve_with_openai(filename: str, content: str) -> str:
    prompt = (
        SYS_PROMPT
        + "\n### File name\n"
        + filename
        + "\n\n### File content with conflicts\n"
        + content
    )
    resp = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": SYS_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=4096,
    )
    txt = (resp.choices[0].message.content or "").strip()
    return strip_fences(txt)

# ---- Main logic --------------------------------------------------------------
def main() -> None:
    conflicted = [Path(p) for p in get_conflicted_files()]
    if not conflicted:
        print("✅ No conflicts.")
        return

    resolved_any = False
    unresolved: List[str] = []

    for path in conflicted:
        if not is_text_and_reasonable(path):
            unresolved.append(str(path))
            continue

        original = read_file(path)
        if not CONFLICT_RE.search(original):
            print(f"ℹ️  No markers found in {path}, staging as-is.")
            run_cmd(["git", "add", str(path)])
            resolved_any = True
            continue

        print(f"🔧 Resolving: {path}")
        fixed = resolve_with_openai(str(path), original)

        if not fixed or CONFLICT_RE.search(fixed):
            print(f"❗ Still contains conflict markers: {path}")
            unresolved.append(str(path))
            continue

        write_file(path, fixed)
        run_cmd(["git", "add", str(path)])
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
