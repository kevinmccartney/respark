#!/usr/bin/env bash
# Creates or updates the "main" repository ruleset from .github/rulesets/main.json.
# Needs the gh CLI, signed in as a repo admin.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULESET_FILE="${ROOT}/.github/rulesets/main.json"
REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
NAME="$(jq -r .name "$RULESET_FILE")"

RULESET_ID="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${NAME}\") | .id")"

if [[ -n "$RULESET_ID" ]]; then
  echo "Updating ruleset '${NAME}' (${RULESET_ID}) on ${REPO}"
  gh api --method PUT "repos/${REPO}/rulesets/${RULESET_ID}" --input "$RULESET_FILE" --jq '.id' >/dev/null
else
  echo "Creating ruleset '${NAME}' on ${REPO}"
  gh api --method POST "repos/${REPO}/rulesets" --input "$RULESET_FILE" --jq '.id' >/dev/null
fi

echo "Done: https://github.com/${REPO}/rules"
