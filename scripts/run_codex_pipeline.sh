#!/usr/bin/env bash
set -euo pipefail

# --- single-line logger: replace newlines with \n (no pipes) ---
oneline() {
  # $1 の改行を \n に変換して1行で出力
  local s="${1//$'\n'/\\n}"
  printf '%s\n' "$s"
}

# ---------- Guard by env.RUN_CODEX ----------
if [ "${RUN_CODEX:-}" != "true" ]; then
  oneline "::notice::RUN_CODEX!=true; skipping Codex pipeline"
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
  oneline "Usage: RUN_CODEX=true TASK_INPUT='<task description or JSON>' $0"
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
  oneline "Error: codex CLI not found (checked codex, codex-cli, npx @openai/codex, python3 -m codex)."
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
        oneline "Error: failed to decode CODEX_AUTH_JSON_B64"
        exit 1
      fi
    fi
  fi
  chmod 600 "${AUTH_FILE}"
fi

# Ensure ChatGPT auth exists
if [ ! -f "${AUTH_FILE}" ]; then
  oneline "Error: ChatGPT authentication not found (~/.codex/auth.json)."
  oneline "Run 'codex login' locally and set CODEX_AUTH_JSON_B64 in CI."
  exit 1
fi

# Prefer ChatGPT auth
echo 'preferred_auth_method = "chatgpt"' > "${AUTH_DIR}/config.toml"

# ---------- Pipeline ----------
CODEX_OUTPUT_ROOT="${CODEX_OUTPUT_DIR:-codex_output}"
export CODEX_OUTPUT_ROOT
mkdir -p "${CODEX_OUTPUT_ROOT}"

OUTPUT_SUBDIR="${CODEX_OUTPUT_ROOT}"
if [ -n "${ISSUE_NUMBER:-}" ]; then
  OUTPUT_SUBDIR="${CODEX_OUTPUT_ROOT}/issue-${ISSUE_NUMBER}"
elif [ -n "${GITHUB_RUN_ID:-}" ]; then
  OUTPUT_SUBDIR="${CODEX_OUTPUT_ROOT}/run-${GITHUB_RUN_ID}"
fi
mkdir -p "${OUTPUT_SUBDIR}"

CODEX_STAGE_OUTPUT_DIR="${OUTPUT_SUBDIR}"
export CODEX_STAGE_OUTPUT_DIR

AVAILABLE_DYNAMIC_STAGES=(
  requirements_analyst
  requirements_reviewer
  detail_designer
  design_reviewer
  coder
  implementation_reviewer
  code_quality_reviewer
  security_reviewer
  threat_modeler
  ai_safety_reviewer
  performance_reviewer
  dpo_reviewer
  oss_sbom_auditor
  uiux_reviewer
  a11y_reviewer
  i18n_reviewer
  qa_automation_planner
  doc-writer
  doc_editor
  integrator
  release_manager
)

DEFAULT_POST_PLAN_STEPS=(
  requirements_analyst
  detail_designer
  coder
  code_quality_reviewer
  security_reviewer
  ai_safety_reviewer
  uiux_reviewer
  doc-writer
  doc_editor
  integrator
  release_manager
)

# Pre-planner stages run before the planner so that the pipeline can validate
# and clarify the task before any execution planning happens.
PRE_PLANNER_STEPS=(translator requirements_analyst)

declare -A STAGE_INSTRUCTIONS=(
  [translator]="Clarify the request in English. List assumptions, constraints, and unknowns. If more details are required, add them under '## Clarifying questions' as bullet points and write 'None' when no follow-up is needed."
  # The requirements_analyst collects requirements and outstanding questions so
  # the pipeline can pause and ask the user for additional details when
  # necessary.
  [requirements_analyst]="Summarize functional, non-functional and out-of-scope requirements. Document risks and assumptions, and list clarifying questions under '## Clarifying questions', writing 'None' when no further information is required."
  [planner]="Outline an execution plan that selects only the necessary stages, highlights critical risks, and sequences the work for smooth hand-offs."
  [requirements_reviewer]="Audit the proposed requirements for completeness, spot conflicts, and note any missing acceptance criteria."
  [detail_designer]="Translate requirements into module- and component-level design notes, covering data flow, contracts, and integration points."
  [design_reviewer]="Review the design for consistency with architecture standards, spotting scalability or maintainability risks."
  [coder]="Describe the exact files to edit with focused diffs or replacement blocks and list any commands to run. Avoid touching unrelated areas."
  [implementation_reviewer]="Check that the proposed implementation aligns with the design details and coding standards, pointing out risky shortcuts."
  [code_quality_reviewer]="Validate correctness, readability, and edge cases. Supply lightweight fixes when needed to keep the implementation tight."
  [security_reviewer]="Evaluate security posture, call out vulnerabilities, and request mitigations for authentication, authorization, and data handling."
  [threat_modeler]="Enumerate plausible attack paths, assess impact, and recommend control updates for the threat model."
  [ai_safety_reviewer]="Assess AI or automated behaviour for misuse, hallucination, and alignment risks, proposing safeguards where needed."
  [performance_reviewer]="Review performance characteristics, highlight bottlenecks, and outline measurement or optimisation steps."
  [dpo_reviewer]="Check privacy and data-protection obligations, ensuring data minimisation, consent, and retention policies are respected."
  [oss_sbom_auditor]="Track open-source dependencies, licensing, and SBOM updates tied to the change."
  [uiux_reviewer]="Evaluate UI and UX implications, verify adherence to the design system, and request clarity on workflows when necessary."
  [a11y_reviewer]="Assess accessibility impacts, referencing WCAG requirements and inclusive design practices."
  [i18n_reviewer]="Check internationalisation readiness, including localisation hooks, translatable strings, and locale fallbacks."
  [qa_automation_planner]="Recommend only the high-impact tests (unit, integration, or manual) required to validate the scoped change."
  [doc-writer]="Draft or update documentation, release notes, and recipes reflecting the implemented work."
  [doc_editor]="Polish documentation for clarity, tone, and consistency, ensuring references and links remain accurate."
  [integrator]="Confirm all planned work is covered, note remaining follow-ups, and explain how to land the change safely."
  [release_manager]="State release readiness, outline minimal verification steps, and call out approvals or rollbacks if needed."
  [work_report]="Draft the issue comment work report using sections for 背景, 変更概要, 影響, 検証, and レビュー観点. Synthesize prior stage outputs to fill each section with concise, actionable context."
)

PREVIOUS_CONTEXT=""

run_stage() {
  local STEP="$1"
  local OUTPUT_FILE="${CODEX_STAGE_OUTPUT_DIR}/${STEP}.md"
  local HUMAN_STEP_NAME
  HUMAN_STEP_NAME=$(echo "${STEP}" | tr '_' ' ')

  local PROMPT
  PROMPT="You are the ${HUMAN_STEP_NAME} stage in an auto-dev workflow.\n\n"
  PROMPT+="Order: translator -> planner -> selected execution stages chosen from the available role list.\n\n"
  PROMPT+="Working language: English.\n"
  PROMPT+="Overall task: ${TASK_INPUT}.\n\n"
  PROMPT+="Constraints:\n"
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
    PROMPT+="Keep the route lean: default to the smallest stage combination that achieves the goal while meeting quality and compliance expectations, and justify any additional stages.\n"
    PROMPT+="Your final message MUST end with a \`\`\`json code block containing {\"steps\":[\"stage_id\",...],\"notes\":\"...\",\"tests\":\"...\"}. Only use stage IDs from the allowed list.\n\n"
  fi
  PROMPT+="Provide your findings for this stage in Markdown. Keep it concise and scoped to this stage."

  local PROMPT_FILE
  PROMPT_FILE=$(mktemp)
  printf '%s' "${PROMPT}" > "${PROMPT_FILE}"

  "${CODEX_CLI[@]}" exec \
    --full-auto \
    --cd "${GITHUB_WORKSPACE:-$(pwd)}" \
    --output-last-message "${OUTPUT_FILE}" \
    --config approval_policy=never \
    --config sandbox='"workspace-write"' \
    -- \
    - < "${PROMPT_FILE}"
  local STATUS=$?
  rm -f "${PROMPT_FILE}"
  if [ "${STATUS}" -ne 0 ]; then
    return "${STATUS}"
  fi

  local STEP_OUTPUT
  STEP_OUTPUT=$(cat "${OUTPUT_FILE}")
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PREVIOUS_CONTEXT="${PREVIOUS_CONTEXT}"$'\n\n---\n\n'"${STEP_OUTPUT}"
  else
    PREVIOUS_CONTEXT="${STEP_OUTPUT}"
  fi

  # After the translator or requirements_analyst stage, scan for clarifying
  # questions and pause the pipeline if more details are required from the
  # user.
  if [ "${STEP}" = "translator" ] || [ "${STEP}" = "requirements_analyst" ]; then
    local CLARIFYING_SECTION
    CLARIFYING_SECTION=$(printf '%s\n' "${STEP_OUTPUT}" |
      python3 - <<'PY'
import re
import sys

text = sys.stdin.read().splitlines()

section_lines = []
in_section = False

heading_pattern = re.compile(r"^\s*(?:#{2,}|\*\*|__)+\s*clarifying questions", re.IGNORECASE)
next_heading_pattern = re.compile(r"^\s*(?:#{2,}|\*\*|__)+\s*[A-Za-z0-9]")

for raw in text:
    stripped = raw.strip()
    if not in_section:
        if heading_pattern.match(stripped):
            in_section = True
        continue

    if next_heading_pattern.match(stripped):
        leading = stripped.lstrip()
        if leading.startswith(("**", "__")):
            inner = re.sub(r"^(?:\*\*|__)\s*", "", leading)
            inner = re.sub(r"\s*(?:\*\*|__)\s*$", "", inner)
            normalized = inner.strip()
            if normalized.endswith(":") or "?" in normalized:
                section_lines.append(raw.rstrip())
                continue
        break

    section_lines.append(raw.rstrip())

print("\n".join(section_lines).rstrip())
PY
)

    local NEEDS_CLARIFICATION
    NEEDS_CLARIFICATION=$(printf '%s\n' "${CLARIFYING_SECTION}" | python3 - <<'PY'
import re, sys

text = sys.stdin.read()
if not text.strip():
    print("false")
    raise SystemExit

for raw in text.splitlines():
    line = raw.strip()
    if not line:
        continue
    # Remove common list markers
    clean = re.sub(r'^[\-\*\u2022]+\s*', '', line)
    clean = clean.strip()
    if not clean:
        continue
    lowered = clean.lower()
    if '?' in lowered:
        print("true")
        break
    prefixes = (
        "none",
        "n/a",
        "na",
        "no ",
        "not applicable",
        "not at this time",
        "nothing",
    )
    if lowered in {"no", "none"}:
        continue
    if any(lowered.startswith(prefix) for prefix in prefixes):
        continue
    print("true")
    break
else:
    print("false")
PY
)

    if [ "${NEEDS_CLARIFICATION}" = "true" ]; then
      {
        printf '## Clarifying questions\n'
        printf '%s\n' "${CLARIFYING_SECTION}" | sed 's/[[:space:]]*$//'
      } > "${CODEX_OUTPUT_ROOT}/clarifying_questions.md"
      cat <<'JSON' > "${CODEX_OUTPUT_ROOT}/status.json"
{"status":"needs_clarification"}
JSON
      local HUMAN_STAGE_LABEL="${HUMAN_STEP_NAME^}"
      oneline "::notice::${HUMAN_STAGE_LABEL} stage requested clarifications. Stopping pipeline early."
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
output_dir = pathlib.Path(os.environ["CODEX_STAGE_OUTPUT_DIR"])
planner_path = output_dir / "planner.md"
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

(output_dir / "execution_plan.json").write_text(
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

oneline "$(printf '::notice::Planner selected stages: %s' "$(IFS=', '; echo "${EXECUTION_PLAN[*]}")")"
printf '%s\n' "${EXECUTION_PLAN[@]}" > "${CODEX_STAGE_OUTPUT_DIR}/execution_plan_steps.txt"

for STEP in "${EXECUTION_PLAN[@]}"; do
  run_stage "${STEP}"
done

run_stage "work_report"

if [ -f "${CODEX_STAGE_OUTPUT_DIR}/work_report.md" ]; then
  cp "${CODEX_STAGE_OUTPUT_DIR}/work_report.md" "${CODEX_OUTPUT_ROOT}/work_report.md"
fi
