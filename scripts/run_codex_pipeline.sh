#!/usr/bin/env bash
set -euo pipefail

# Support both CLI arguments and stdin so callers can avoid passing legacy flags
# like `--task` that are no longer recognised by the Codex CLI. If arguments are
# omitted but stdin is piped, treat the piped content as the task description.
if [ $# -eq 0 ]; then
  if [ -t 0 ]; then
    echo "Usage: $0 [--task] <task description>" >&2
    exit 1
  fi

  STDIN_PAYLOAD="$(cat)"
  # Normalise Windows-style carriage returns in case the workflow echoed a
  # CRLF-terminated string.
  STDIN_PAYLOAD="${STDIN_PAYLOAD//$'\r'/}"

  # Defer validation of empty content until after we have applied the legacy
  # flag sanitisation and whitespace trimming below.
  NORMALISED_ARGS=("${STDIN_PAYLOAD}")
else
  # Historical callers may still pass the task description via a deprecated
  # "--task" flag (for example `codex run auto-dev --task "..."`). The current
  # Codex CLI no longer accepts that option, so we strip it here for
  # compatibility and treat the remaining positional arguments as the actual
  # task description.
  NORMALISED_ARGS=()
  while [ $# -gt 0 ]; do
    case "${1-}" in
      --task)
        shift
        if [ $# -gt 0 ]; then
          NORMALISED_ARGS+=("${1}")
          shift
        fi
        continue
        ;;
      --task=*)
        NORMALISED_ARGS+=("${1#--task=}")
        shift
        continue
        ;;
      *)
        NORMALISED_ARGS+=("${1}")
        shift
        ;;
    esac
  done
fi

if [ ${#NORMALISED_ARGS[@]} -eq 0 ]; then
  echo "Usage: $0 [--task] <task description>" >&2
  exit 1
fi

# Compose the task input from the (possibly multi-word) positional arguments
# after normalising away the deprecated flag.
TASK_INPUT="${NORMALISED_ARGS[0]-}"
for ARG in "${NORMALISED_ARGS[@]:1}"; do
  TASK_INPUT="${TASK_INPUT} ${ARG}"
done

# Guard against historical callers that inlined the deprecated flag into the
# task description (for example, passing "--task build a feature" as a single
# argument or "--task=build" as a single token). We normalise the value so
# downstream prompts only contain the human-provided request.
while [[ "${TASK_INPUT}" == --task\ * || "${TASK_INPUT}" == --task=* ]]; do
  if [[ "${TASK_INPUT}" == --task\ * ]]; then
    TASK_INPUT="${TASK_INPUT#--task }"
  else
    TASK_INPUT="${TASK_INPUT#--task=}"
  fi
done

# Trim any leading/trailing whitespace that may have been introduced while
# sanitising legacy inputs.
TASK_INPUT="${TASK_INPUT#${TASK_INPUT%%[![:space:]]*}}"
TASK_INPUT="${TASK_INPUT%${TASK_INPUT##*[![:space:]]}}"

if [ -z "${TASK_INPUT}" ]; then
  echo "Usage: $0 [--task] <task description>" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI not found in PATH. Please install @google/generative-ai before running the pipeline." >&2
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "GEMINI_API_KEY is not configured." >&2
  exit 1
fi

mkdir -p codex_output

# Ensure we are logged in using the provided API key. This is idempotent.
codex login --api-key "${GEMINI_API_KEY}" >/dev/null 2>&1 || true

# Pipeline progression:
# 1. The translator receives the human request, translates it into the working
#    language, and fills any missing context the rest of the agents will need.
# 2. The planner consumes the translator's output and assigns concrete
#    directions for each downstream specialist so they can execute in turn.
# 3. Subsequent agents use the accumulated context to perform their specialty
#    and hand the enriched plan to the next stage until the integrator wraps up
#    the workflow.
PIPELINE_STEPS=(
  translator
  requirements_analyst
  detail_designer
  planner
  coder
  code_quality_reviewer
  security_reviewer
  uiux_reviewer
  implementation_reviewer
  docwriter
  integrator
)
declare -A STAGE_INSTRUCTIONS=(
  [translator]="Translate the overall task into the working language (English) when needed, clarify intent, and supplement missing assumptions or constraints so later agents receive a complete brief."
  [planner]="Use the translator's clarified brief to orchestrate the workflow. Lay out concrete steps for each downstream agent, explicitly delegating responsibilities so they understand what to deliver back into the shared context."
  [requirements_analyst]="Document functional and non-functional requirements derived from the clarified task. Highlight open questions the planner assigned to later agents if they remain unresolved."
  [detail_designer]="Expand the requirements into implementation-ready designs or technical approaches while respecting any assignments from the planner."
  [coder]="Implement the planned solution details, focusing on code or configuration excerpts the planner expects."
  [code_quality_reviewer]="Review the implementation for correctness, maintainability, and adherence to standards the planner outlined."
  [security_reviewer]="Assess security implications of the proposed changes and call out mitigations or follow-ups."
  [uiux_reviewer]="Evaluate user experience considerations tied to the plan, ensuring accessibility and usability are addressed."
  [implementation_reviewer]="Validate that deployment, integration, and operational concerns are covered before hand-off."
  [docwriter]="Summarise the work products and update documentation or release notes as directed by earlier stages."
  [integrator]="Consolidate the full context into a final summary, confirming all planner assignments were satisfied and noting any outstanding actions."
)
PREVIOUS_CONTEXT=""

for STEP in "${PIPELINE_STEPS[@]}"; do
  OUTPUT_FILE="codex_output/${STEP}.md"
  HUMAN_STEP_NAME=$(echo "${STEP}" | tr '_' ' ')

  PROMPT="You are the ${HUMAN_STEP_NAME} stage in an auto-dev workflow.\n\n"
  PROMPT+="The translator first translates and enriches the request, then the planner assigns concrete work to each subsequent agent so the project flows smoothly.\n\n"
  PROMPT+="Overall task: ${TASK_INPUT}.\n\n"
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PROMPT+="Context from earlier stages (may be empty):\n${PREVIOUS_CONTEXT}\n\n"
  fi
  if [ -n "${STAGE_INSTRUCTIONS[${STEP}]-}" ]; then
    PROMPT+="Stage focus: ${STAGE_INSTRUCTIONS[${STEP}]}\n\n"
  fi
  PROMPT+="Provide your findings for this stage in Markdown. Keep the response concise and scoped to the responsibilities of this stage so that it can feed the following agent."

  # Run codex in headless mode, capturing the final response for this stage
  #
  # We stream the prompt through stdin with `-` so that any leading `-` tokens in
  # the user-provided task (for example "--task foo") are never interpreted as
  # CLI options by the codex binary. Passing `--` before the positional argument
  # ensures argument parsing stops before the trailing `-` placeholder.
  # `--full-auto` already implies the necessary sandbox/approval behaviour. Avoid
  # passing `--dangerously-bypass-approvals-and-sandbox` alongside it because the
  # Codex CLI rejects the combination.
  printf '%s' "${PROMPT}" | codex exec \
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
