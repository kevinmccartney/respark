#!/usr/bin/env bash
# Create (or rotate) access keys for the local Compose API IAM user and write
# them to gitignored apps/api/.env.local. Keys stay out of Terraform state.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="${TF_DIR:-$ROOT/infra/envs/local}"
ENV_LOCAL="${ENV_LOCAL:-$ROOT/apps/api/.env.local}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ROTATE=0

for arg in "$@"; do
  if [ "$arg" = "--rotate" ]; then
    ROTATE=1
  fi
done

if [ ! -d "$TF_DIR" ]; then
  echo "missing Terraform dir $TF_DIR" >&2
  exit 1
fi

USER_NAME="$(terraform -chdir="$TF_DIR" output -raw api_user_name)"
if [ -z "$USER_NAME" ]; then
  echo "terraform output api_user_name is empty; apply ENV=local first" >&2
  exit 1
fi

existing_key=""
if [ -f "$ENV_LOCAL" ]; then
  existing_key="$(awk -F= '/^AWS_ACCESS_KEY_ID=/{print $2; exit}' "$ENV_LOCAL" | tr -d '"' | tr -d "'")"
fi

if [ -n "$existing_key" ] && [ "$ROTATE" -eq 0 ]; then
  echo "AWS_ACCESS_KEY_ID already set in $ENV_LOCAL (pass --rotate to replace)"
  exit 0
fi

if [ "$ROTATE" -eq 1 ] && [ -n "$existing_key" ]; then
  aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$existing_key"
fi

created="$(aws iam create-access-key --user-name "$USER_NAME" --output json)"
key_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessKey"]["AccessKeyId"])' <<<"$created")"
secret="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessKey"]["SecretAccessKey"])' <<<"$created")"

mkdir -p "$(dirname "$ENV_LOCAL")"
touch "$ENV_LOCAL"

python3 - "$ENV_LOCAL" "$key_id" "$secret" "$AWS_REGION" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
updates = {
    "AWS_ACCESS_KEY_ID": sys.argv[2],
    "AWS_SECRET_ACCESS_KEY": sys.argv[3],
    "AWS_REGION": sys.argv[4],
    "AWS_DEFAULT_REGION": sys.argv[4],
    "CHAT_PROVIDER": "bedrock",
}
lines = path.read_text() if path.exists() else ""
keys_seen = set()
out = []
for raw in lines.splitlines():
    if not raw.strip() or raw.lstrip().startswith("#") or "=" not in raw:
        out.append(raw)
        continue
    key = raw.split("=", 1)[0]
    if key in updates:
        out.append(f"{key}={updates[key]}")
        keys_seen.add(key)
    else:
        out.append(raw)
for key, value in updates.items():
    if key not in keys_seen:
        out.append(f"{key}={value}")
text = "\n".join(out)
if text and not text.endswith("\n"):
    text += "\n"
path.write_text(text)
PY

echo "Wrote AWS keys for $USER_NAME to $ENV_LOCAL"
echo "Recreate the API container: docker compose up -d api --force-recreate"
