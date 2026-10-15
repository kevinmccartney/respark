# The task's dns-updater container owns the value (the task's public IP changes on
# every start); Terraform only creates the record and removes it on destroy.
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 60
  records = ["127.0.0.1"]

  lifecycle {
    ignore_changes = [records]
  }
}
