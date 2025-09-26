#!/usr/bin/env bash
set -euo pipefail

TASK_INPUT=${1-}
if [ -z "${TASK_INPUT}" ]; then
  echo "Usage: $0 <task description>" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI not found in PATH. Please install @openai/codex before running the pipeline." >&2
  exit 1
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is not configured. Skipping Codex pipeline run." >&2
  exit 0
fi

mkdir -p codex_output

# Ensure we are logged in using the provided API key. This is idempotent.
codex login --api-key "${OPENAI_API_KEY}" >/dev/null 2>&1 || true

PIPELINE_STEPS=(translator requirements_analyst detail_designer planner)
PREVIOUS_CONTEXT=""

for STEP in "${PIPELINE_STEPS[@]}"; do
  OUTPUT_FILE="codex_output/${STEP}.md"
  HUMAN_STEP_NAME=$(echo "${STEP}" | tr '_' ' ')

  PROMPT="You are the ${HUMAN_STEP_NAME} stage in an auto-dev workflow.\n\n"
  PROMPT+="Overall task: ${TASK_INPUT}.\n\n"
  if [ -n "${PREVIOUS_CONTEXT}" ]; then
    PROMPT+="Context from earlier stages (may be empty):\n${PREVIOUS_CONTEXT}\n\n"
  fi
  PROMPT+="Provide your findings for this stage in Markdown. Keep the response concise and scoped to the responsibilities of this stage so that it can feed the following agent."

  # Run codex in headless mode, capturing the final response for this stage
  #
  # We stream the prompt through stdin with `-` so that any leading `-` tokens in
  # the user-provided task (for example "--task foo") are never interpreted as
  # CLI options by the codex binary. Passing `--` before the positional argument
  # ensures argument parsing stops before the trailing `-` placeholder.
  printf '%s' "${PROMPT}" | codex exec \
    --full-auto \
    --dangerously-bypass-approvals-and-sandbox \
    --cd "${GITHUB_WORKSPACE:-$(pwd)}" \
    --output-last-message "${OUTPUT_FILE}" \
    --config approval_policy=never \
    --config sandbox='"workspace-write"' \
    -- \
    -

  PREVIOUS_CONTEXT=$(cat "${OUTPUT_FILE}")
done
