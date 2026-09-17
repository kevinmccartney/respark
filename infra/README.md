# Infrastructure

Terraform is organized by **environment** (roots) and **modules** (reusable building blocks).

```plaintext
infra/
├── envs/
│   └── develop/     # Terraform root for develop — run init/plan/apply here
└── modules/
    └── ui/          # S3 static website for the React app
```

Add more environments (for example `staging`, `prod`) as sibling directories under `envs/`, each calling the same modules with different settings.
