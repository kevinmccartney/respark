#!/usr/bin/env bash
# Pushes API secrets from apps/api/.env into SSM Parameter Store.
# Terraform owns database-url; this covers secrets it should never see.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/infra/envs/develop"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ -f "${ROOT}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/apps/api/.env"
  set +a
fi

if [[ -z "${CLERK_SECRET_KEY:-}" ]]; then
  echo "Set CLERK_SECRET_KEY in apps/api/.env (see .env.example) first." >&2
  exit 1
fi

# Derive the prefix from the parameter Terraform already manages.
DATABASE_URL_PARAM="$(terraform -chdir="$TF_DIR" output -raw db_database_url_parameter)"
PREFIX="${DATABASE_URL_PARAM%/database-url}"

put_secret() {
  aws ssm put-parameter \
    --name "${PREFIX}/$1" \
    --description "$2" \
    --type SecureString \
    --value "$3" \
    --overwrite \
    --region "$AWS_REGION" \
    --output text > /dev/null

  echo "Wrote ${PREFIX}/$1"
}

put_secret clerk-secret-key "Clerk secret key for the API" "$CLERK_SECRET_KEY"

# Optional: only exists once the webhook endpoint is created in the Clerk dashboard.
if [[ -n "${CLERK_WEBHOOK_SIGNING_SECRET:-}" ]]; then
  put_secret clerk-webhook-signing-secret "Clerk webhook signing secret" "$CLERK_WEBHOOK_SIGNING_SECRET"
else
  echo "Skipped clerk-webhook-signing-secret (unset in apps/api/.env); /webhooks/clerk will 503."
fi

echo "Run 'task api:deploy' to restart the container with it."
