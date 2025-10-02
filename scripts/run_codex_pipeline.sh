#!/usr/bin/env bash
set -euo pipefail

# ---------- Task input ----------
TASK_INPUT="${TASK_INPUT:-${1:-}}"
if [ -z "${TASK_INPUT}" ] && [ ! -t 0 ]; then
  TASK_INPUT="$(cat)"
fi
# trim
TASK_INPUT="${TASK_INPUT#${TASK_INPUT%%[![:space:]]*}}"
TASK_INPUT="${TASK_INPUT%${TASK_INPUT##*[![:space:]]}}"
if [ -z "${TASK_INPUT}" ]; then
  echo "Usage: TASK_INPUT='<task description>' $0" >&2
  exit 1
fi

# ---------- Codex CLI detection ----------
if command -v codex >/dev/null 2>&1; then
  CODEX_CLI=(codex)
elif command -v codex-cli >/dev/null 2>&1; then
  CODEX_CLI=(codex-cli)
elif command -v npx >/dev/null 2>&1; then
  CODEX_NPM_PKG="${CODEX_NPM_PKG:-@openai/codex}"
  CODEX_CLI=(npx -y "${CODEX_NPM_PKG}")
elif command -v python3 >/dev/null 2>&1 && python3 -c "import codex" >/dev/null 2>&1; then
  CODEX_CLI=(python3 -m codex)
else
  echo "Error: codex CLI not found (checked codex, codex-cli, npx @openai/codex, python3 -m codex)." >&2
  exit 1
fi

# ---------- ChatGPT auth (no API key) ----------
AUTH_DIR="${HOME}/.codex"
AUTH_FILE="${AUTH_DIR}/auth.json"
mkdir -p "${AUTH_DIR}"

# If provided, materialize auth from secret
if [ -n "${CODEX_AUTH_JSON_B64:-}" ]; then
  if ! printf '%s' "$CODEX_AUTH_JSON_B64" | base64 -d > "${AUTH_FILE}" 2>/dev/null; then
    if ! printf '%s' "$CODEX_AUTH_JSON_B64" | base64 --decode > "${AUTH_FILE}" 2>/dev/null; then
      if command -v python3 >/dev/null 2>&1; then
        python3 - "$CODEX_AUTH_JSON_B64" "${AUTH_FILE}" <<'PY'
import base64,sys,pathlib
b64=sys.argv[1]; out=sys.argv[2]
p=pathlib.Path(out); p.parent.mkdir(parents=True, exist_ok=True)
p.write_bytes(base64.b64decode(b64))
PY
      else
        echo "Error: failed to decode CODEX_AUTH_JSON_B64" >&2
        exit 1
      fi
    fi
  fi
  chmod 600 "${AUTH_FILE}"
fi

# Ensure ChatGPT auth exists
if [ ! -f "${AUTH_FILE}" ]; then
  echo "Error: ChatGPT authentication not found (~/.codex/auth.json)." >&2
  echo "Run 'codex login' locally and set CODEX_AUTH_JSON_B64 in CI." >&2
  exit 1
fi

# Prefer ChatGPT auth
echo 'preferred_auth_method = "chatgpt"' > "${AUTH_DIR}/config.toml"

# ---------- Pipeline ----------
mkdir -p codex_output

PIPELINE_STEPS=(
  translator
  requirements_analyst
  requirements_reviewer
  planner
  threat_modeler
  dpo_reviewer
  detail_designer
  design_reviewer
  qa_automation_planner
  coder
  code_quality_reviewer
  security_reviewer
  uiux_reviewer
  implementation_reviewer
  a11y_reviewer
  i18n_reviewer
  performance_reviewer
  oss_sbom_auditor
  ai_safety_reviewer
  integrator
  release_manager
  docwriter
  doc_editor
)

declare -A STAGE_INSTRUCTIONS=(
  [translator]="Clarify the request in English. List assumptions and unknowns."
  [requirements_analyst]="Structure FR/NFR and acceptance criteria. Expose risks and open items."
  [requirements_reviewer]="Verify completeness and consistency. Send back if gaps remain."
  [planner]="Define steps, owners, dependencies, gates, and clear done criteria."
  [threat_modeler]="Identify key threats and propose mitigations on critical flows."
  [dpo_reviewer]="Check data minimization, retention, consent, and legal compliance."
  [detail_designer]="Design approach, interfaces, data, failure handling, and trade-offs."
  [design_reviewer]="Assess design soundness and external impact. Provide concrete diffs."
  [qa_automation_planner]="Define unit/contract/e2e test focus and thresholds."
  [coder]="Output file paths with full replacement blocks and run commands."
  [code_quality_reviewer]="Review correctness, readability, complexity; provide fix diffs."
  [security_reviewer]="Evaluate input validation, secret handling, dependency risks; propose fixes."
  [uiux_reviewer]="List UX improvements and interaction flow checks."
  [implementation_reviewer]="Verify build/deploy/monitoring/rollback readiness."
  [a11y_reviewer]="Validate WCAG, keyboard access, contrast, and ARIA."
  [i18n_reviewer]="Verify variable strings, formats, and missing translations."
  [performance_reviewer]="Set SLO targets, expected load, and regression thresholds."
  [oss_sbom_auditor]="Audit SBOM and license compliance; flag prohibitions."
  [ai_safety_reviewer]="Evaluate output safety and prompt-leak risks."
  [integrator]="Confirm feedback is applied and consolidate remaining actions."
  [release_manager]="Decide release readiness and rollback plan."
  [docwriter]="Draft README/CHANGELOG/ADR updates."
  [doc_editor]="Enforce terminology and formatting consistency."
)

PREVIOUS_CONTEXT=""

for STEP in "${PIPELINE_STEPS[@]}"; do
  OUTPUT_FILE="codex_output/${STEP}.md"
  HUMAN_STEP_NAME=$(echo "${STEP}" | tr '_' ' ')

  PROMPT="You are the ${HUMAN_STEP_NAME} stage in an auto-dev workflow.\n\n"
  PROMPT+="Order: translator → requirements → requirements review → planner → threat modeling → DPO review → design → design review → QA planning → coding → parallel reviews → integration → CI/release → docs.\n\n"
  PROMPT+="Working language: English.\n"
  PROMPT+="Overall task: ${TASK_INPUT}.\n\n"
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PROMPT+="Context from earlier stages:\n${PREVIOUS_CONTEXT}\n\n"
  fi
  if [ -n "${STAGE_INSTRUCTIONS[${STEP}]-}" ]; then
    PROMPT+="Stage focus: ${STAGE_INSTRUCTIONS[${STEP}]}\n\n"
  fi
  PROMPT+="Provide your findings for this stage in Markdown. Keep it concise and scoped to this stage."

  printf '%s' "${PROMPT}" | "${CODEX_CLI[@]}" exec \
    --full-auto \
    --cd "${GITHUB_WORKSPACE:-$(pwd)}" \
    --output-last-message "${OUTPUT_FILE}" \
    --config approval_policy=never \
    --config sandbox='"workspace-write"' \
    -- \
    -

  STEP_OUTPUT=$(cat "${OUTPUT_FILE}")
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PREVIOUS_CONTEXT="${PREVIOUS_CONTEXT}"$'\n\n---\n\n'"${STEP_OUTPUT}"
  else
    PREVIOUS_CONTEXT="${STEP_OUTPUT}"
  fi
done
