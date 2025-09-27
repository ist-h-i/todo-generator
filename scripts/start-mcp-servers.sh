#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v uvx >/dev/null 2>&1; then
  echo "[Error] uvx not found in PATH. Install uv from https://docs.astral.sh/uv/." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "[Error] npx not found in PATH. Install Node.js 20+ from https://nodejs.org/." >&2
  exit 1
fi

echo "Starting MCP Git server for ${REPO_DIR} ..."
uvx mcp-server-git --repository "${REPO_DIR}" &
GIT_PID=$!

echo "Starting MCP filesystem server for ${REPO_DIR} ..."
npx --yes @modelcontextprotocol/server-filesystem "${REPO_DIR}" &
FS_PID=$!

cleanup() {
  trap - INT TERM
  kill "$GIT_PID" "$FS_PID" 2>/dev/null || true
}

trap cleanup INT TERM
wait
