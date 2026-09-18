#!/bin/bash
set -euo pipefail

REGION="${aws_region}"
REPO="${ecr_repository_url}"
TAG="${container_image_tag}"
API_PORT="${api_port}"

dnf install -y docker aws-cli
systemctl enable --now docker

deploy_container() {
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REPO"
  docker pull "$REPO:$TAG"
  docker rm -f respark-api 2>/dev/null || true
  docker run -d \
    --name respark-api \
    --restart unless-stopped \
    -p 80:"$API_PORT" \
    "$REPO:$TAG"
}

if deploy_container; then
  echo "API container started."
else
  echo "No image in ECR yet. Push with: task api:deploy" >&2
  exit 0
fi
