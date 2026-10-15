#!/usr/bin/env bash
# Builds the API image (linux/arm64), pushes :<tag> and :latest to the env's ECR repo,
# and rolls the ECS service, which always runs :latest. Waits until the service is stable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="${ENV:-develop}"
if [[ -n "${TF_DIR:-}" ]]; then
  [[ "${TF_DIR}" = /* ]] || TF_DIR="${ROOT}/${TF_DIR}"
else
  TF_DIR="${ROOT}/infra/envs/${ENV}"
fi
AWS_REGION="${AWS_REGION:-us-east-1}"
API_DOCKERFILE="${API_DOCKERFILE:-apps/api/Dockerfile}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse --short HEAD)-$(date +%s)}"

tf_output() {
  terraform -chdir="$TF_DIR" output -raw "$1"
}

REPO="$(tf_output api_ecr_repository_url)"
CLUSTER="$(tf_output ecs_cluster_name)"
SERVICE="$(tf_output ecs_service_name)"

aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "${REPO%%/*}"

cd "$ROOT"
echo "Building ${REPO}:${IMAGE_TAG}"
if [[ "${DOCKER_BUILDX:-0}" == "1" ]]; then
  docker buildx build --platform linux/arm64 -f "$API_DOCKERFILE" \
    -t "${REPO}:${IMAGE_TAG}" -t "${REPO}:latest" --push .
else
  docker build --platform linux/arm64 -f "$API_DOCKERFILE" -t "${REPO}:${IMAGE_TAG}" -t "${REPO}:latest" .
  docker push "${REPO}:${IMAGE_TAG}"
  docker push "${REPO}:latest"
fi

echo "Rolling ${CLUSTER}/${SERVICE}"
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
  --force-new-deployment --region "$AWS_REGION" --query 'service.deployments[0].id' --output text
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$AWS_REGION"
echo "Deploy succeeded (${IMAGE_TAG})."
