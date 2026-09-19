#!/usr/bin/env bash
# Create the S3 bucket + DynamoDB lock table for Terraform remote state (once per account).
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
BUCKET="${TF_STATE_BUCKET:-respark-tfstate}"
TABLE="${TF_STATE_LOCK_TABLE:-respark-tfstate-lock}"

echo "Ensuring S3 bucket s3://${BUCKET} in ${AWS_REGION}…"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket already exists."
else
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
fi

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Ensuring DynamoDB table ${TABLE}…"
if aws dynamodb describe-table --table-name "$TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Table already exists."
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION" >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$AWS_REGION"
fi

echo "Done. Migrate local state with:"
echo "  terraform -chdir=infra/envs/develop init -migrate-state"
