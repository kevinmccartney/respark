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

aws ssm put-parameter \
  --name "${PREFIX}/clerk-secret-key" \
  --description "Clerk secret key for the API" \
  --type SecureString \
  --value "$CLERK_SECRET_KEY" \
  --overwrite \
  --region "$AWS_REGION" \
  --output text > /dev/null

echo "Wrote ${PREFIX}/clerk-secret-key"
echo "Run 'task api:deploy' to restart the container with it."
