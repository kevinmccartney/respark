#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/infra/envs/develop"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="${AWS_REGION:-us-east-1}"

REPO="$(terraform -chdir="$TF_DIR" output -raw api_ecr_repository_url)"
INSTANCE="$(terraform -chdir="$TF_DIR" output -raw api_instance_id)"
REGISTRY="${REPO%%/*}"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --comment "respark api redeploy" \
  --parameters "commands=[
    \"set -euo pipefail\",
    \"aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}\",
    \"docker pull ${REPO}:${IMAGE_TAG}\",
    \"docker rm -f respark-api || true\",
    \"docker run -d --name respark-api --restart unless-stopped -p 80:3000 ${REPO}:${IMAGE_TAG}\"
  ]" \
  --query 'Command.CommandId' \
  --output text)

echo "SSM command ${CMD_ID} sent to instance ${INSTANCE}"
