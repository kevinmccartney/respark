# Infrastructure

Terraform is organized by **environment** (roots) and **modules** (reusable building blocks).

```plaintext
infra/
├── envs/
│   └── develop/     # Terraform root for develop — run init/plan/apply here
└── modules/
    └── ui/          # S3 + CloudFront + ACM + Route53 for the React app
```

**develop** uses `dev.respark.kevinmccartney.is`. Add **prod** (and other envs) as sibling directories under `envs/` when you ship 1.0, each calling the same modules with different `domain_name` values.
