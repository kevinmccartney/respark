resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-sg"
  description = "API origin reachable only from CloudFront"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "HTTP from CloudFront origin-facing"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sg"
  })
}
