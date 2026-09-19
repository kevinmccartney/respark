#!/usr/bin/env bash
# Opens an SSM port-forward from localhost:15432 to the ENV RDS instance
# via the API EC2 box. RDS stays private; your laptop never gets a public DB.
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

INSTANCE_ID="$(terraform -chdir="$TF_DIR" output -raw api_instance_id)"
DB_ENDPOINT="$(terraform -chdir="$TF_DIR" output -raw db_endpoint)"
DB_HOST="${DB_ENDPOINT%%:*}"

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
Tunnel:  127.0.0.1:${LOCAL_PORT}  →  ${DB_HOST}:5432  (via ${INSTANCE_ID})
User:    ${DB_USER}
Database:${DB_NAME}
Password: from SSM ${DATABASE_URL_PARAM} (not printed)

Connect with SSL (password via \`task db:url\`), e.g. rewrite the host to 127.0.0.1:${LOCAL_PORT}.

Leave this running. Ctrl-C closes the tunnel.
EOF

aws ssm start-session \
  --target "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${DB_HOST}\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
