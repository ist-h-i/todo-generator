#!/usr/bin/env bash
# Usage (each role tail):
#   append_role_metric "Coder" 1 0.12 0.03 12345 0.7
#                        role   activity  return fail  tokens contrib
set -euo pipefail
mkdir -p codex_output/metrics

append_role_metric() {
  local role="$1"; shift
  local activity="$1"; shift
  local return_rate="$1"; shift
  local fail_rate="$1"; shift
  local tokens="$1"; shift
  local contrib="$1"; shift
  local now
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  jq -n --arg role "$role" --argjson activity "$activity" \
        --argjson return_rate "$return_rate" --argjson fail_rate "$fail_rate" \
        --argjson tokens "$tokens" --argjson contrib "$contrib" \
        --arg timestamp "$now" '{role: $role, activity: $activity, return_rate: $return_rate, fail_rate: $fail_rate, tokens: $tokens, contrib: $contrib, ts: $timestamp}' \
    >> codex_output/metrics/metrics.jsonl
}
