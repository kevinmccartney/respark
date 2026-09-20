#!/bin/bash
# Installed on API EC2 as /usr/local/bin/respark-deploy-api.sh
set -euo pipefail

REPO="$${1:?ECR repository URL required}"
TAG="$${2:-${container_image_tag}}"

REGION="${aws_region}"
LOG_GROUP="${cloudwatch_log_group}"
API_PORT="${api_port}"

# IMDSv2 (http_tokens = required) — used to name the log stream per instance.
IMDS_TOKEN="$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
INSTANCE_ID="$(curl -s http://169.254.169.254/latest/meta-data/instance-id \
  -H "X-aws-ec2-metadata-token: $IMDS_TOKEN")"

read_parameter() {
  aws ssm get-parameter \
    --name "$1" \
    --with-decryption \
    --region "$REGION" \
    --query 'Parameter.Value' \
    --output text
}

# Read by the instance role; secrets never leave the VPC.
DATABASE_URL="$(read_parameter '${parameter_prefix}/database-url')"
CLERK_SECRET_KEY="$(read_parameter '${parameter_prefix}/clerk-secret-key')"
# Optional: the endpoint has to exist in the Clerk dashboard before this is available,
# so a missing value degrades the webhook route rather than blocking the whole deploy.
CLERK_WEBHOOK_SIGNING_SECRET="$(read_parameter '${parameter_prefix}/clerk-webhook-signing-secret' || true)"
BEDROCK_MODEL_ID="$(read_parameter '${parameter_prefix}/bedrock-model-id' || true)"
export DATABASE_URL CLERK_SECRET_KEY CLERK_WEBHOOK_SIGNING_SECRET BEDROCK_MODEL_ID

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$${REPO%%/*}"

docker pull "$REPO:$TAG"
docker rm -f respark-api 2>/dev/null || true

docker run -d \
  --name respark-api \
  --restart unless-stopped \
  -p 80:"$API_PORT" \
  -e NODE_ENV=production \
  -e AWS_REGION="$REGION" \
  -e AWS_DEFAULT_REGION="$REGION" \
  -e CHAT_PROVIDER=bedrock \
  -e CLERK_SECRET_KEY \
  -e CLERK_WEBHOOK_SIGNING_SECRET \
  -e DATABASE_URL \
  -e BEDROCK_MODEL_ID \
  -e RUN_MIGRATIONS=true \
  --log-driver awslogs \
  --log-opt "awslogs-region=$REGION" \
  --log-opt "awslogs-group=$LOG_GROUP" \
  --log-opt "awslogs-stream=respark-api/$INSTANCE_ID" \
  --log-opt awslogs-create-group=false \
  "$REPO:$TAG"
