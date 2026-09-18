#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/infra/envs/develop"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="${AWS_REGION:-us-east-1}"

REPO="$(terraform -chdir="$TF_DIR" output -raw api_ecr_repository_url)"
INSTANCE="$(terraform -chdir="$TF_DIR" output -raw api_instance_id)"
LOG_GROUP="$(terraform -chdir="$TF_DIR" output -raw api_cloudwatch_log_group)"

if ! command -v jq >/dev/null; then
  echo "jq is required to build the SSM payload (brew install jq)." >&2
  exit 1
fi

# No secrets here: the on-instance script reads DATABASE_URL and CLERK_SECRET_KEY
# from SSM Parameter Store using the instance role. The wait covers a redeploy
# issued right after `infra:apply` replaces the instance, while cloud-init is
# still installing the deploy script.
REMOTE_CMD="for _ in \$(seq 1 60); do [ -x /usr/local/bin/respark-deploy-api.sh ] && break; sleep 5; done
exec /usr/local/bin/respark-deploy-api.sh '${REPO}' '${IMAGE_TAG}'"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --comment "respark api redeploy" \
  --parameters "$(jq -n --arg c "$REMOTE_CMD" '{commands: [$c]}')" \
  --region "$AWS_REGION" \
  --query 'Command.CommandId' \
  --output text)

echo "SSM command ${CMD_ID} sent to instance ${INSTANCE}"

echo "Waiting for the redeploy to finish…"
for _ in $(seq 1 90); do
  sleep 5
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$CMD_ID" \
    --instance-id "$INSTANCE" \
    --region "$AWS_REGION" \
    --query 'Status' \
    --output text 2>/dev/null || echo Pending)

  case "$STATUS" in
    Success)
      echo "Redeploy succeeded."
      echo "Tail logs: aws logs tail ${LOG_GROUP} --follow --region ${AWS_REGION}"
      exit 0
      ;;
    Failed | Cancelled | TimedOut)
      echo "Redeploy ${STATUS}:" >&2
      aws ssm get-command-invocation \
        --command-id "$CMD_ID" \
        --instance-id "$INSTANCE" \
        --region "$AWS_REGION" \
        --query '{Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
        --output text >&2
      exit 1
      ;;
  esac
done

echo "Timed out waiting for command ${CMD_ID}; check it manually." >&2
exit 1
