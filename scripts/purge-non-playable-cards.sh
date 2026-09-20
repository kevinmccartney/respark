#!/usr/bin/env bash
# Delete catalog/raw extras whose type line has a bare "Card" face.
# Default: develop RDS through the SSM tunnel (task db:tunnel). Dry-run unless apply.
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
SQL="${ROOT}/scripts/purge-non-playable-cards.sql"

APPLY=0
USE_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    apply | --apply) APPLY=1 ;;
    local | --local) USE_LOCAL=1 ;;
    *)
      echo "Unknown argument: $arg (use apply and/or local)" >&2
      exit 1
      ;;
  esac
done

if ! command -v psql >/dev/null; then
  echo "psql is required." >&2
  exit 1
fi

rewrite_ssm_url_to_tunnel() {
  python3 - "$1" "$LOCAL_PORT" <<'PY'
from urllib.parse import parse_qsl, quote, urlencode, urlparse
import sys

url, port = sys.argv[1], sys.argv[2]
parsed = urlparse(url)
if not parsed.hostname:
    raise SystemExit("DATABASE_URL is missing a host")
user = quote(parsed.username or "", safe="")
password = quote(parsed.password or "", safe="")
auth = f"{user}:{password}@" if user or password else ""
query = dict(parse_qsl(parsed.query, keep_blank_values=True))
query.setdefault("sslmode", "require")
path = parsed.path or "/respark"
print(f"{parsed.scheme}://{auth}127.0.0.1:{port}{path}?{urlencode(query)}")
PY
}

if [[ "$USE_LOCAL" -eq 1 ]]; then
  DATABASE_URL="${DATABASE_URL:-postgres://respark:respark@localhost:5432/respark}"
  TARGET="local Compose Postgres"
else
  DATABASE_URL_PARAM="$(terraform -chdir="$TF_DIR" output -raw db_database_url_parameter)"
  SSM_URL="$(aws ssm get-parameter \
    --name "$DATABASE_URL_PARAM" \
    --with-decryption \
    --region "$AWS_REGION" \
    --query 'Parameter.Value' \
    --output text)"
  DATABASE_URL="$(rewrite_ssm_url_to_tunnel "$SSM_URL")"
  TARGET="${ENV} RDS via 127.0.0.1:${LOCAL_PORT} (start \`task db:tunnel\` first)"
fi

echo "Target: ${TARGET}"
if [[ "$APPLY" -eq 1 ]]; then
  echo "Mode:   apply (will delete)"
else
  echo "Mode:   dry-run (counts only)"
fi

export DATABASE_URL
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v apply="$APPLY" -f "$SQL"
