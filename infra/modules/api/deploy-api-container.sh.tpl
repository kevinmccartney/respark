#!/bin/bash
# Installed on API EC2 as /usr/local/bin/respark-deploy-api.sh
set -euo pipefail

REPO="$${1:?ECR repository URL required}"
TAG="$${2:-${container_image_tag}}"
CLERK_SECRET_KEY="$${CLERK_SECRET_KEY:?CLERK_SECRET_KEY required}"

REGION="${aws_region}"
LOG_GROUP="${cloudwatch_log_group}"
API_PORT="${api_port}"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$${REPO%%/*}"

docker pull "$REPO:$TAG"
docker rm -f respark-api 2>/dev/null || true

docker run -d \
  --name respark-api \
  --restart unless-stopped \
  -p 80:"$API_PORT" \
  -e NODE_ENV=production \
  -e CLERK_SECRET_KEY \
  --log-driver awslogs \
  --log-opt "awslogs-region=$REGION" \
  --log-opt "awslogs-group=$LOG_GROUP" \
  --log-opt awslogs-stream-prefix=respark-api \
  --log-opt awslogs-create-group=false \
  "$REPO:$TAG"
