#!/usr/bin/env bash
# Pushes API secrets from the repo-root .env.<ENV> into SSM Parameter Store.
# Terraform owns database-url; this covers secrets it should never see.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="${ENV:-develop}"
if [[ -n "${TF_DIR:-}" ]]; then
  [[ "${TF_DIR}" = /* ]] || TF_DIR="${ROOT}/${TF_DIR}"
else
  TF_DIR="${ROOT}/infra/envs/${ENV}"
fi
AWS_REGION="${AWS_REGION:-us-east-1}"

ENV_FILE="${ROOT}/.env.${ENV}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example and fill in the ${ENV} Clerk keys." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${CLERK_SECRET_KEY:-}" ]]; then
  echo "Set CLERK_SECRET_KEY in ${ENV_FILE} first." >&2
  exit 1
fi

PREFIX="$(terraform -chdir="$TF_DIR" output -raw api_parameter_prefix)"

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

# Only exists once the webhook endpoint is created in the Clerk dashboard.
if [[ -n "${CLERK_WEBHOOK_SIGNING_SECRET:-}" ]]; then
  put_secret clerk-webhook-signing-secret "Clerk webhook signing secret" "$CLERK_WEBHOOK_SIGNING_SECRET"
else
  echo "Skipped clerk-webhook-signing-secret (unset in ${ENV_FILE}). ECS needs the parameter to exist to start the task."
fi

echo "Run 'task api:deploy ENV=${ENV}' to roll the API onto it."
