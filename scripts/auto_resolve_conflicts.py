#!/usr/bin/env python3
"""Automatically resolve Git merge conflicts with the help of Codex."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import List, Sequence, Tuple

import google.generativeai as genai

MAX_RETRIES = 3

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
genai.configure()
model = genai.GenerativeModel(MODEL_NAME)


def run_cmd(cmd: Sequence[str], *, capture: bool = False, cwd: str | None = None) -> Tuple[str, str, int]:
    """Run a shell command and optionally capture its output."""
    print(f"$ {' '.join(cmd)}", flush=True)
    result = subprocess.run(
        list(cmd),
        cwd=cwd,
        check=False,
        text=True,
        capture_output=capture,
    )

    if capture:
        return result.stdout or "", result.stderr or "", result.returncode

    return "", "", result.returncode


def get_conflicted_files() -> List[str]:
    """Return a list of files that currently have merge conflicts."""
    stdout, _stderr, _code = run_cmd(["git", "diff", "--name-only", "--diff-filter=U"], capture=True)
    files = [line.strip() for line in stdout.splitlines() if line.strip()]
    return files


def read_file_content(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write_file_content(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def _response_text(response) -> str:
    text_value = getattr(response, "text", None)
    if isinstance(text_value, str) and text_value.strip():
        return text_value

    fragments: List[str] = []
    for candidate in getattr(response, "candidates", []) or []:
        parts = getattr(candidate, "content", None) or getattr(candidate, "parts", None)
        if not parts:
            continue
        for part in parts:
            text = getattr(part, "text", None) or getattr(part, "value", None)
            if isinstance(text, str):
                fragments.append(text)

    if not fragments and getattr(response, "output", None):
        for item in getattr(response, "output", []) or []:
            for part in getattr(item, "content", []) or []:
                text = getattr(part, "text", None)
                if isinstance(text, str):
                    fragments.append(text)

    return "".join(fragments).strip()


def ask_codex_to_resolve(filename: str, content: str, *, error_log: str | None = None) -> str:
    """Ask Codex to resolve conflicts or address test failures."""
    if error_log:
        prompt = f"""
あなたはソフトウェアエンジニアです。
以下のコードに問題があり、テストが失敗しました。
エラーログを参考に修正したコードを返してください。

### ファイル名
{filename}

### 現在のコード
{content}

### テストエラーログ
{error_log}
"""
    else:
        prompt = f"""
あなたはソフトウェアエンジニアです。
以下のソースコードには Git マージコンフリクトがあります。
`<<<<<<<, =======, >>>>>>>` を検出し、解消後の正しいコードを返してください。
余計なコメントやマーカーは残さないでください。

### ファイル名
{filename}

### コード
{content}
"""

    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.0, "response_mime_type": "text/plain"},
    )

    return _response_text(response)


def merge_in_progress() -> bool:
    """Return True if Git reports an in-progress merge."""
    return Path(".git/MERGE_HEAD").exists()


def resolve_conflicts() -> List[str]:
    """Resolve all current merge conflicts using Codex."""
    conflicted_files = get_conflicted_files()
    if not conflicted_files:
        print("✅ コンフリクトはありません。", flush=True)
        return []

    for file_path in conflicted_files:
        print(f"🔧 Resolving conflict in {file_path}...", flush=True)
        original = read_file_content(file_path)
        resolved = ask_codex_to_resolve(file_path, original)
        write_file_content(file_path, resolved)

    run_cmd(["git", "add", *conflicted_files])
    return conflicted_files


def _run_python_tests() -> Tuple[bool, str, str]:
    stdout_parts: List[str] = []
    stderr_parts: List[str] = []
    success = True

    backend_requirements = Path("backend/requirements.txt")
    root_requirements = Path("requirements.txt")

    if backend_requirements.exists():
        run_cmd(["pip", "install", "-r", str(backend_requirements)])
        out, err, code = run_cmd(["pytest", "backend/tests"], capture=True)
        stdout_parts.append(out)
        stderr_parts.append(err)
        success = success and code == 0
    elif root_requirements.exists() or Path("pytest.ini").exists() or Path("conftest.py").exists():
        if root_requirements.exists():
            run_cmd(["pip", "install", "-r", str(root_requirements)])
        out, err, code = run_cmd(["pytest"], capture=True)
        stdout_parts.append(out)
        stderr_parts.append(err)
        success = success and code == 0

    return success, "\n".join(part for part in stdout_parts if part).strip(), "\n".join(part for part in stderr_parts if part).strip()


def _run_node_tests() -> Tuple[bool, str, str]:
    stdout_parts: List[str] = []
    stderr_parts: List[str] = []
    success = True

    node_projects: List[Path] = []
    if Path("package.json").exists():
        node_projects.append(Path("."))
    frontend_package = Path("frontend/package.json")
    if frontend_package.exists():
        node_projects.append(frontend_package.parent)

    for project in node_projects:
        package_lock = project / "package-lock.json"
        install_cmd = ["npm", "ci"] if package_lock.exists() else ["npm", "install"]
        run_cmd(install_cmd, cwd=str(project))
        out, err, code = run_cmd(["npm", "test"], capture=True, cwd=str(project))
        stdout_parts.append(out)
        stderr_parts.append(err)
        success = success and code == 0

    return success, "\n".join(part for part in stdout_parts if part).strip(), "\n".join(part for part in stderr_parts if part).strip()


def run_tests() -> Tuple[bool, str, str]:
    """Run available test suites and return aggregated results."""
    print("🧪 Running tests...", flush=True)

    py_success, py_out, py_err = _run_python_tests()
    node_success, node_out, node_err = _run_node_tests()

    outputs = [text for text in [py_out, node_out] if text]
    errors = [text for text in [py_err, node_err] if text]

    if not outputs and not errors:
        print("⚠️ No test framework detected, skipping tests.")
        return True, "", ""

    return py_success and node_success, "\n".join(outputs).strip(), "\n".join(errors).strip()


def main() -> None:
    conflicted_files = resolve_conflicts()
    if not conflicted_files:
        return

    for attempt in range(1, MAX_RETRIES + 1):
        commit_message = f"🤖 auto-resolve attempt {attempt}"
        if attempt == 1 and merge_in_progress():
            run_cmd(["git", "commit", "-m", commit_message])
        else:
            run_cmd(["git", "commit", "--amend", "-m", commit_message])
        success, out, err = run_tests()

        if success:
            print(f"✅ テスト成功！（{attempt}回目）", flush=True)
            return

        print(f"❌ テスト失敗（{attempt}回目） 修正を試みます...", flush=True)
        error_log = "\n".join(part for part in [out, err] if part)

        for file_path in conflicted_files:
            current = read_file_content(file_path)
            fixed = ask_codex_to_resolve(file_path, current, error_log=error_log)
            write_file_content(file_path, fixed)

        run_cmd(["git", "add", *conflicted_files])

    print("🚨 最大リトライ回数に達しました。テスト失敗のままです。", flush=True)
    sys.exit(1)


if __name__ == "__main__":
    main()
