#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '\n==> Running backend unit tests with coverage\n'
pushd "$ROOT_DIR/backend" >/dev/null
coverage erase || true
coverage run -m pytest tests
coverage xml -o coverage.xml
popd >/dev/null

printf '\n==> Running frontend unit tests with coverage\n'
pushd "$ROOT_DIR/frontend" >/dev/null
rm -rf coverage
CI=1 npm run test:ci -- --watch=false
popd >/dev/null

cat <<'MSG'

Coverage reports generated:
  - Backend: backend/coverage.xml
  - Frontend: frontend/coverage/frontend/lcov.info

Run sonar-scanner after executing this script to publish results to SonarQube.
MSG
