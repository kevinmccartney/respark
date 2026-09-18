#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/infra/envs/develop"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ -f "${ROOT}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/apps/api/.env"
  set +a
fi

if [[ -z "${CLERK_SECRET_KEY:-}" ]]; then
  echo "Set CLERK_SECRET_KEY in apps/api/.env (see .env.example) before redeploy." >&2
  exit 1
fi

REPO="$(terraform -chdir="$TF_DIR" output -raw api_ecr_repository_url)"
INSTANCE="$(terraform -chdir="$TF_DIR" output -raw api_instance_id)"
LOG_GROUP="$(terraform -chdir="$TF_DIR" output -raw api_cloudwatch_log_group)"
REGISTRY="${REPO%%/*}"
CLERK_B64="$(printf '%s' "$CLERK_SECRET_KEY" | base64 | tr -d '\n')"

# Runs on the EC2 instance via SSM (keep in sync with infra/modules/api/deploy-api-container.sh.tpl).
REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
export CLERK_SECRET_KEY=\$(printf '%s' '${CLERK_B64}' | base64 -d)

if [[ -x /usr/local/bin/respark-deploy-api.sh ]]; then
  exec /usr/local/bin/respark-deploy-api.sh '${REPO}' '${IMAGE_TAG}'
fi

aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}
docker pull ${REPO}:${IMAGE_TAG}
docker rm -f respark-api || true
docker run -d \\
  --name respark-api \\
  --restart unless-stopped \\
  -p 80:3000 \\
  -e NODE_ENV=production \\
  -e CLERK_SECRET_KEY \\
  --log-driver awslogs \\
  --log-opt awslogs-region=${AWS_REGION} \\
  --log-opt awslogs-group=${LOG_GROUP} \\
  --log-opt awslogs-stream-prefix=respark-api \\
  --log-opt awslogs-create-group=false \\
  ${REPO}:${IMAGE_TAG}
EOF
)

SCRIPT_B64="$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')"

if ! command -v jq >/dev/null; then
  echo "jq is required to build the SSM payload (brew install jq)." >&2
  exit 1
fi

SSM_PARAMS=$(jq -n \
  --arg b64 "$SCRIPT_B64" \
  '{commands: [("printf %s " + ($b64 | @sh) + " | base64 -d | bash")]}')

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --comment "respark api redeploy" \
  --parameters "$SSM_PARAMS" \
  --query 'Command.CommandId' \
  --output text)

echo "SSM command ${CMD_ID} sent to instance ${INSTANCE}"
echo "Tail logs: aws logs tail ${LOG_GROUP} --follow --region ${AWS_REGION}"
