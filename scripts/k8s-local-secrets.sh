#!/usr/bin/env bash
# Load apps/<app>/.env and .env.local into Secret respark-<app>-env in the local
# cluster. Later files win (.env.local over .env). Re-run after editing either
# file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAMESPACE="${K8S_NAMESPACE:-respark}"

merged="$(mktemp)"
trap 'rm -f "$merged"' EXIT

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

for app in api client admin; do
  files=()
  for file in "$ROOT/apps/$app/.env" "$ROOT/apps/$app/.env.local"; do
    if [ -f "$file" ]; then
      files+=("$file")
    fi
  done

  : >"$merged"
  if [ "${#files[@]}" -gt 0 ]; then
    # kubectl --from-env-file keeps quotes literally, so strip one surrounding pair.
    awk '
      /^[[:space:]]*(#|$)/ { next }
      {
        line = $0
        sub(/^[[:space:]]*export[[:space:]]+/, "", line)
        eq = index(line, "=")
        if (eq == 0) next
        key = substr(line, 1, eq - 1)
        gsub(/[[:space:]]/, "", key)
        value = substr(line, eq + 1)
        if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) value = substr(value, 2, length(value) - 2)
        if (!(key in values)) order[++n] = key
        values[key] = value
      }
      END { for (i = 1; i <= n; i++) print order[i] "=" values[order[i]] }
    ' "${files[@]}" >"$merged"
  fi

  kubectl create secret generic "respark-$app-env" \
    --namespace "$NAMESPACE" \
    --from-env-file="$merged" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "respark-$app-env: $(wc -l <"$merged" | tr -d ' ') key(s) from ${#files[@]} env file(s)"
done
