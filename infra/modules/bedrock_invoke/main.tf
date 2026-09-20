# Player chat ConverseStream. US inference profiles authorize the profile ARN
# and the underlying foundation-model in every destination Region (us-east-1,
# us-east-2, us-west-2 for Haiku 4.5). IAM `*` does not match past `:`, so
# `foundation-model/*` misses ids that end in `:0`.
# https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html
resource "aws_iam_policy" "invoke" {
  name        = "${var.name_prefix}-bedrock-invoke"
  description = "Invoke Bedrock Converse / ConverseStream for Respark chat."
  tags        = var.tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InvokeBedrockConverse"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*::foundation-model/*:*",
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*:*:inference-profile/*:*",
          "arn:aws:bedrock:*:*:application-inference-profile/*",
          "arn:aws:bedrock:*:*:application-inference-profile/*:*",
        ]
      },
      {
        Sid    = "GetInferenceProfile"
        Effect = "Allow"
        Action = [
          "bedrock:GetInferenceProfile",
        ]
        Resource = [
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*:*:inference-profile/*:*",
          "arn:aws:bedrock:*:*:application-inference-profile/*",
          "arn:aws:bedrock:*:*:application-inference-profile/*:*",
        ]
      },
      # Haiku 4.5 is billed through Marketplace. ConverseStream auto-subscribes
      # on first use; without these actions Bedrock returns AccessDenied.
      # Do not condition ViewSubscriptions or Subscribe on ProductId / CalledViaLast —
      # Bedrock's model-access pre-check fails those conditions even when simulate-principal-policy allows.
      # https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
      {
        Sid    = "MarketplaceModelAccess"
        Effect = "Allow"
        Action = [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ]
        Resource = "*"
      },
    ]
  })
}
