resource "aws_security_group" "task" {
  name        = "${local.name_prefix}-task-sg"
  description = "API task: Caddy on 80/443 from the internet"
  vpc_id      = data.aws_vpc.default.id

  dynamic "ingress" {
    for_each = [80, 443]
    content {
      description = "Caddy ${ingress.value} from the internet"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-task-sg"
  })
}

resource "aws_security_group" "efs" {
  name        = "${local.name_prefix}-efs-sg"
  description = "Caddy certificate storage, reachable only from the API task"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "NFS from the API task"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.task.id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-efs-sg"
  })
}
