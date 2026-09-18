resource "aws_instance" "api" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    deploy_api_script    = local.deploy_api_script
    cloudwatch_log_group = aws_cloudwatch_log_group.api.name
  })

  user_data_replace_on_change = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 12
    encrypted   = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2"
  })

  depends_on = [aws_ecr_repository.api, aws_cloudwatch_log_group.api]
}

locals {
  deploy_api_script = templatefile("${path.module}/deploy-api-container.sh.tpl", {
    aws_region           = var.aws_region
    cloudwatch_log_group = aws_cloudwatch_log_group.api.name
    api_port             = var.api_port
    container_image_tag  = var.container_image_tag
  })
}

resource "aws_eip" "api" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eip"
  })
}

resource "aws_eip_association" "api" {
  instance_id   = aws_instance.api.id
  allocation_id = aws_eip.api.id
}

resource "aws_route53_record" "origin" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = local.origin_hostname
  type    = "A"
  ttl     = 60
  records = [aws_eip.api.public_ip]
}
