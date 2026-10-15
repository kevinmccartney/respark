#!/usr/bin/env bash
# Opens an SSM port-forward from localhost:15432 to the ENV Postgres (shared RDS) through the
# running API task via ECS Exec. RDS stays private; your laptop never gets a public DB.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="${ENV:-develop}"
if [[ -n "${TF_DIR:-}" ]]; then
  [[ "${TF_DIR}" = /* ]] || TF_DIR="${ROOT}/${TF_DIR}"
else
  TF_DIR="${ROOT}/infra/envs/${ENV}"
fi
AWS_REGION="${AWS_REGION:-us-east-1}"
LOCAL_PORT="${LOCAL_PORT:-15432}"

CLUSTER="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
SERVICE="$(terraform -chdir="$TF_DIR" output -raw ecs_service_name)"
DB_ENDPOINT="$(terraform -chdir="$TF_DIR" output -raw db_endpoint)"
DB_HOST="${DB_ENDPOINT%%:*}"
DB_PORT="${DB_ENDPOINT##*:}"

TASK_ARN="$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --region "$AWS_REGION" --query 'taskArns[0]' --output text)"
if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "No running task in ${CLUSTER}/${SERVICE}." >&2
  exit 1
fi
TASK_ID="${TASK_ARN##*/}"
RUNTIME_ID="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$AWS_REGION" \
  --query "tasks[0].containers[?name=='api'].runtimeId | [0]" --output text)"

DATABASE_URL_PARAM="$(terraform -chdir="$TF_DIR" output -raw db_database_url_parameter)"
DATABASE_URL="$(aws ssm get-parameter \
  --name "$DATABASE_URL_PARAM" \
  --with-decryption \
  --region "$AWS_REGION" \
  --query 'Parameter.Value' \
  --output text)"

# postgres://USER:PASS@HOST:PORT/DB → local tunnel URL (password never printed).
DB_USER="$(printf '%s' "$DATABASE_URL" | sed -E 's|^[^:]+://([^:]+):.*|\1|')"
DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"

cat <<EOF
Tunnel:  127.0.0.1:${LOCAL_PORT}  →  ${DB_HOST}:${DB_PORT}  (via task ${TASK_ID})
User:    ${DB_USER}
Database:${DB_NAME}
Password: from SSM ${DATABASE_URL_PARAM} (not printed)

Connect with sslmode=require (password via \`task db:url\`), rewriting the host to 127.0.0.1:${LOCAL_PORT}.

Leave this running. Ctrl-C closes the tunnel.
EOF

aws ssm start-session \
  --target "ecs:${CLUSTER}_${TASK_ID}_${RUNTIME_ID}" \
  --region "$AWS_REGION" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${DB_HOST}\"],\"portNumber\":[\"${DB_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
