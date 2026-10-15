#!/usr/bin/env bash
# Creates ENV's login role and database on the shared RDS instance (idempotent), using the
# production master connection through a tunnel on localhost:${LOCAL_PORT} (task db:tunnel ENV=production).
# The role's password comes from ENV's database-url parameter, which Terraform generates.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="${ENV:-develop}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LOCAL_PORT="${LOCAL_PORT:-15432}"

if [[ "$ENV" == production ]]; then
  echo "production uses the master user's own database; nothing to create." >&2
  exit 1
fi

read_url() {
  aws ssm get-parameter --name "$(terraform -chdir="${ROOT}/infra/envs/$1" output -raw db_database_url_parameter)" \
    --with-decryption --region "$AWS_REGION" --query Parameter.Value --output text
}

# postgres://USER:PASS@HOST:PORT/DB
ENV_URL="$(read_url "$ENV")"
ROLE="$(printf '%s' "$ENV_URL" | sed -E 's|^[^:]+://([^:]+):.*|\1|')"
PASSWORD="$(printf '%s' "$ENV_URL" | sed -E 's|^[^:]+://[^:]+:([^@]+)@.*|\1|')"
DB_NAME="$(printf '%s' "$ENV_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"

PROD_URL="$(read_url production)"
PROD_DB="$(printf '%s' "$PROD_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
MASTER_URL="$(printf '%s' "$PROD_URL" | sed -E "s|@[^/]+/|@127.0.0.1:${LOCAL_PORT}/|")?sslmode=require"

echo "Ensuring role ${ROLE} and database ${DB_NAME} (via 127.0.0.1:${LOCAL_PORT})"
# The password is passed as a psql variable on stdin, never in process arguments.
psql "$MASTER_URL" -v ON_ERROR_STOP=1 -q <<SQL
\set role_name '${ROLE}'
\set role_password '${PASSWORD}'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role_name') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password') \gexec
GRANT :"role_name" TO CURRENT_USER;
SELECT format('CREATE DATABASE %I OWNER %I', '${DB_NAME}', :'role_name')
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', '${DB_NAME}') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', '${PROD_DB}') \gexec
SQL
echo "Done."
