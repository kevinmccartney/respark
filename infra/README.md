# Infrastructure

Terraform is organized by **environment** (roots) and **modules** (reusable building blocks). Environments share one AWS account; isolation is via `Environment` tags, `respark-<env>-*` names, and distinct state keys.

```plaintext
infra/
├── envs/
│   ├── develop/      # Pre-prod (dev.*.kevinmccartney.is)
│   ├── production/   # Prod (respark / admin.respark / api.respark)
│   └── local/        # Laptop Compose IAM only
└── modules/
    ├── api/
    ├── db/
    ├── ui/
    └── bedrock_invoke/
```

Use `ENV=develop` (default) or `ENV=production` with Task (`task infra:plan`, `task deploy`, …). Production deploys are intentional — see [`envs/production/README.md`](envs/production/README.md) and [`docs/ci-cd.md`](../docs/ci-cd.md).
