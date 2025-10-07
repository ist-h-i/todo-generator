#!/usr/bin/env bash
set -euo pipefail

# ---------- Guard by env.RUN_CODEX ----------
if [ "${RUN_CODEX:-}" != "true" ]; then
  echo "::notice::RUN_CODEX!=true; skipping Codex pipeline"
  exit 0
fi

# ---------- Task input ----------
TASK_INPUT="${TASK_INPUT:-${1:-}}"
if [ -z "${TASK_INPUT}" ] && [ ! -t 0 ]; then
  TASK_INPUT="$(cat)"
fi
# trim
TASK_INPUT="${TASK_INPUT#${TASK_INPUT%%[![:space:]]*}}"
TASK_INPUT="${TASK_INPUT%${TASK_INPUT##*[![:space:]]}}"
if [ -z "${TASK_INPUT}" ]; then
  echo "Usage: RUN_CODEX=true TASK_INPUT='<task description or JSON>' $0" >&2
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
import base64, sys, pathlib
b64 = sys.argv[1]
out = pathlib.Path(sys.argv[2])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(base64.b64decode(b64))
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

AVAILABLE_DYNAMIC_STAGES=(
  qa_automation_planner
  coder
  code_quality_reviewer
  integrator
  release_manager
)

DEFAULT_POST_PLAN_STEPS=(
  coder
  code_quality_reviewer
  integrator
)

PRE_PLANNER_STEPS=(translator)

declare -A STAGE_INSTRUCTIONS=(
  [translator]="Clarify the request in English. List assumptions, constraints, and unknowns. If more details are required, add them under '## Clarifying questions' as bullet points and write 'None' when no follow-up is needed."
  [planner]="Define the minimum-step execution plan, highlight critical risks, and ensure the ordered steps can finish the task with the smallest viable change set."
  [qa_automation_planner]="Recommend only the high-impact tests (unit, integration, or manual) required to validate the scoped change."
  [coder]="Describe the exact files to edit with focused diffs or replacement blocks and list any commands to run. Avoid touching unrelated areas."
  [code_quality_reviewer]="Validate correctness, readability, and edge cases. Supply lightweight fixes when needed to keep the implementation tight."
  [integrator]="Confirm all planned work is covered, note remaining follow-ups, and explain how to land the change safely."
  [release_manager]="State release readiness, outline minimal verification steps, and call out approvals or rollbacks if needed."
)

PREVIOUS_CONTEXT=""

run_stage() {
  local STEP="$1"
  local OUTPUT_FILE="codex_output/${STEP}.md"
  local HUMAN_STEP_NAME
  HUMAN_STEP_NAME=$(echo "${STEP}" | tr '_' ' ')

  local PROMPT
  PROMPT="You are the ${HUMAN_STEP_NAME} stage in an auto-dev workflow.\n\n"
  PROMPT+="Order: translator -> planner -> selected execution stages (qa_automation_planner, coder, code_quality_reviewer, integrator, release_manager).\n\n"
  PROMPT+="Working language: English.\n"
  PROMPT+="Overall task: ${TASK_INPUT}.\n\n"
  PROMPT+="Constraints:\n"
  PROMPT+="- Minimize the scope of changes and keep edits tightly targeted.\n"
  PROMPT+="- Use the fewest viable steps to reach a safe completion.\n"
  PROMPT+="- Call out residual risks or open questions explicitly.\n\n"
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PROMPT+="Context from earlier stages:\n${PREVIOUS_CONTEXT}\n\n"
  fi
  if [ -n "${STAGE_INSTRUCTIONS[${STEP}]-}" ]; then
    PROMPT+="Stage focus: ${STAGE_INSTRUCTIONS[${STEP}]}\n\n"
  fi
  if [ "${STEP}" = "planner" ]; then
    local AVAILABLE_FOR_PROMPT
    AVAILABLE_FOR_PROMPT=$(IFS=', '; echo "${AVAILABLE_DYNAMIC_STAGES[*]}")
    PROMPT+="Select the minimum necessary execution stages from: ${AVAILABLE_FOR_PROMPT}.\n"
    PROMPT+="Your final message MUST end with a ```json code block containing {\"steps\":[\"stage_id\",...],\"notes\":\"...\",\"tests\":\"...\"}. Only use stage IDs from the allowed list.\n\n"
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

  local STEP_OUTPUT
  STEP_OUTPUT=$(cat "${OUTPUT_FILE}")
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PREVIOUS_CONTEXT="${PREVIOUS_CONTEXT}"$'\n\n---\n\n'"${STEP_OUTPUT}"
  else
    PREVIOUS_CONTEXT="${STEP_OUTPUT}"
  fi

  if [ "${STEP}" = "translator" ]; then
    local CLARIFYING_SECTION
    CLARIFYING_SECTION=$(printf '%s\n' "${STEP_OUTPUT}" |
      awk '
        BEGIN { in_section=0 }
        tolower($0) ~ /^##[[:space:]]*clarifying questions/ { in_section=1; next }
        /^##[[:space:]]+/ { if (in_section) exit; }
        { if (in_section) print }
      ')

    local CLARIFYING_CLEAN
    CLARIFYING_CLEAN=$(printf '%s\n' "${CLARIFYING_SECTION}" |
      sed '/^[[:space:]]*[-*]\{0,1\}[[:space:]]*\(none\|n\/a\)\.?[[:space:]]*$/Id')

    if printf '%s\n' "${CLARIFYING_CLEAN}" | grep -q '[^[:space:]]'; then
      {
        printf '## Clarifying questions\n'
        printf '%s\n' "${CLARIFYING_SECTION}" | sed 's/[[:space:]]*$//'
      } > codex_output/clarifying_questions.md
      cat <<'JSON' > codex_output/status.json
{"status":"needs_clarification"}
JSON
      echo "::notice::Translator stage requested clarifications. Stopping pipeline early."
      exit 0
    fi
  fi
}

for STEP in "${PRE_PLANNER_STEPS[@]}"; do
  run_stage "${STEP}"
done

run_stage planner

PLAN_LINES=""
ALLOWED_IDS=$(IFS=','; echo "${AVAILABLE_DYNAMIC_STAGES[*]}")
DEFAULT_IDS=$(IFS=','; echo "${DEFAULT_POST_PLAN_STEPS[*]}")
if PLAN_OUTPUT=$(ALLOWED="${ALLOWED_IDS}" DEFAULT="${DEFAULT_IDS}" python3 - <<'PY'
import json, os, pathlib, re

def normalize(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")

def dedup(items):
    result = []
    for item in items:
        if item and item not in result:
            result.append(item)
    return result

allowed = dedup([normalize(entry) for entry in os.environ.get("ALLOWED", "").split(",") if entry.strip()])
default = dedup([normalize(entry) for entry in os.environ.get("DEFAULT", "").split(",") if entry.strip()])
if not allowed:
    allowed = default.copy()
allowed_set = set(allowed)
if not default:
    default = allowed.copy()

text = ""
planner_path = pathlib.Path("codex_output/planner.md")
if planner_path.exists():
    text = planner_path.read_text(encoding="utf-8")

pattern = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL)
plan_steps = []
planner_payload = None

for block in pattern.findall(text):
    try:
        data = json.loads(block)
    except Exception:
        continue
    steps = data.get("steps")
    if not isinstance(steps, list):
        continue
    collected = []
    for step in steps:
        candidate = None
        if isinstance(step, str):
            candidate = step
        elif isinstance(step, dict):
            candidate = step.get("id") or step.get("stage") or step.get("name")
        if not candidate:
            continue
        normalized = normalize(candidate)
        if normalized in allowed_set and normalized not in collected:
            collected.append(normalized)
    if collected:
        plan_steps = collected
        planner_payload = data
        break

source = "planner"
if not plan_steps:
    plan_steps = default
    source = "fallback"

output = {"steps": plan_steps, "source": source}
if planner_payload is not None:
    output["planner_payload"] = planner_payload

pathlib.Path("codex_output/execution_plan.json").write_text(
    json.dumps(output, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

for step in plan_steps:
    print(step)
PY
); then
  PLAN_LINES="${PLAN_OUTPUT}"
else
  PLAN_LINES=""
fi

EXECUTION_PLAN=()
if [ -n "${PLAN_LINES}" ]; then
  while IFS= read -r line; do
    if [ -n "${line}" ]; then
      EXECUTION_PLAN+=("${line}")
    fi
  done <<< "${PLAN_LINES}"
fi

if [ ${#EXECUTION_PLAN[@]} -eq 0 ]; then
  EXECUTION_PLAN=("${DEFAULT_POST_PLAN_STEPS[@]}")
fi

printf '::notice::Planner selected stages: %s\n' "$(IFS=', '; echo "${EXECUTION_PLAN[*]}")"
printf '%s\n' "${EXECUTION_PLAN[@]}" > codex_output/execution_plan_steps.txt

for STEP in "${EXECUTION_PLAN[@]}"; do
  run_stage "${STEP}"
done
