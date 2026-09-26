# Deployment Models & Deployment Modules

Deployment **modules** are general domains/capabilities of a web platform. They are responsible for the deployment and management of that capability.

Deployment modules are collections of primitives that compose into a **Deployment Model**. Mixing modules across platforms is allowed, but **networking integration gets harder**. Example: API on a Raspberry Pi + RDS in a VPC requires a private tunnel to the database (databases must not be reachable on the public internet).

Cloud providers (EC2, RDS, EKS, ALB, …) are provisioned as Terraform modules. **Bring-your-own hosts** (e.g. Raspberry Pi) are not created by Terraform — the machine already exists; you must configure the cluster over SSH.

## Notes

Treat these modules as WIP, some are not implemented yet & some may not fit together all that well. This document is the artifact of the planning that went into trying to define a couple of sane deployment models & ultimately a few were found that will satisfy a broad range of use-cases.

In the future, it's possible that SDK adapter layers will be written for the auth, monitoring, & events modules. These SDKs would wrap the implementation details of the auth provider or event broker so that the application code has a consistent interface to use. At the time of writing this document, user-facing features & technical debt paydown are being prioritized.

## Deployment Modules

### Networking

- Requirements
  - Public DNS resolves to the TLS edge for web and API
  - SSL/TLS termination at the edge (not on every app process)
  - Only the edge is public; API compute and data stay private (VPC subnets, NetworkPolicies, or equivalent)
  - When modules span networks, a private path to Data is required (peering, VPN, tunnel, PrivateLink, …)
- Providers
  - DNS
    - Route53
    - Other DNS (Cloudflare, etc.)
    - Registrar-provided DNS
  - SSL
    - Let's Encrypt
    - ACM
  - TLS edge
    - ALB
    - CloudFront
    - Nginx on EC2 (provisioned) or Raspberry Pi (existing host)
    - Kubernetes Ingress / Gateway (nginx, Traefik, …; often with cert-manager)

### Auth

- Requirements
  - End-user sign-in / sign-up for client (and admin where needed)
  - API can validate sessions/JWTs (issuer, audience, JWKS)
  - Configurable allowed origins / redirect URLs per environment
- Providers
  - Clerk
  - Cognito
  - Zitadel
  - Keycloak

### Data

- Requirements
  - Postgres reachable via `DATABASE_URL`
  - Not exposed on the public internet
  - Backups / restore path defined by the provider
  - Schema migrations runnable from CI or controlled API/ops path
- Providers
  - Postgres via Helm on the cluster (minimal / budget — same box as the app)
  - RDS
  - Managed Postgres SaaS (Supabase, Neon, …)

### Web Applications

- Requirements
  - Serve static web assets (HTML/CSS/JS)
  - Reachable via the public internet over HTTPS (via Networking)
  - Can call the API (same-site routing or CORS)
- Providers
  - Helm chart (static / nginx Deployment + Ingress) on the cluster
  - CloudFront + S3

### API

- Requirements
  - Runs the Nest process as a container
  - Deployed via **Helm** onto Kubernetes
  - Reachable only via the Networking TLS edge (no public Node port)
  - Can read secrets (`DATABASE_URL`, Clerk, optional Bedrock/AWS credentials)
  - Horizontally scalable where the cluster allows
- Providers (where the cluster runs)
  - Kubernetes on Raspberry Pi (existing host; install k3s/etc. over SSH — Terraform does not create the Pi)
  - Kubernetes on EC2 (k3s / k0s / kubeadm on provisioned VMs)
  - EKS (managed control plane; workloads still Helm)

### Monitoring

- Requirements
  - View logs from components in near real-time
  - SRE-style metrics (saturation, errors, latency)
  - Alerting on events / thresholds
  - OTEL-compatible ingest path (collector or native OTLP)
- Providers
  - LGTM stack (Loki, Grafana, Tempo, Prometheus)
  - SigNoz
  - CloudWatch

### Events

- Requirements (future)
  - Event broker for async work and fan-out
  - Pub/sub (multicast): one produce → many independent consumers
  - Topics / subjects / channels
  - At-least-once delivery
  - Optional later: retention / replay (Kafka-class)
- Providers
  - NATS
  - RabbitMQ
  - SNS/SQS (+ optional EventBridge on AWS)
  - Kafka (or MSK / Redpanda)

## Deployment Models

All four models standardize on **Kubernetes + Helm** for the API (and for in-cluster web/data where applicable). The ladder is how much you push off the box onto managed AWS / SaaS.

> There you can use different deployment models built up from the above modules or modules of your own design. These are just some reference architecture paths that can be considered well-paved.

| Model         | Cluster home | What's on the box vs managed                                               |
| ------------- | ------------ | -------------------------------------------------------------------------- |
| **minimal**   | Raspberry Pi | Everything on the Pi                                                       |
| **budget**    | EC2          | Everything on one EC2 — little else to pay for                             |
| **optimized** | EC2          | Still K8s-on-EC2 for API; **managed Postgres** + **CloudFront/S3** for web |
| **scaled**    | EKS          | **ALB** + **EKS** for API; CloudFront/S3 + managed Postgres                |

**Events** are omitted until the product needs a broker.

### minimal: Helm on Raspberry Pi

Existing Pi; install a lightweight cluster (e.g. k3s) over SSH, then `helm upgrade` the Respark charts. No cloud provision for compute.

| Module           | Default provider                                              |
| ---------------- | ------------------------------------------------------------- |
| Networking       | Kube Ingress Controller                                       |
| Auth             | Clerk                                                         |
| Data             | Postgres Helm chart on the Pi cluster + pg_dump backups to s3 |
| Web Applications | Helm (static / nginx) on the Pi cluster                       |
| API              | Helm → Kubernetes on Pi                                       |
| Monitoring       | SigNoz (Helm)                                                 |

Notes: one host/LAN; weakest HA. Backups = `pg_dump` / SD discipline. Terraform (if used) is DNS/inventory only — not the Pi itself.

### budget: Helm on EC2 (all-in-one)

Terraform provisions **one** EC2 (or VPS). Same Helm charts as minimal; lifecycle differs (cloud creates/destroys the VM). **Goal: minimize other infra cost** — API, web, Postgres, and monitoring all run on that cluster. No ALB, no CloudFront/S3, no managed DB.

| Module           | Default provider                                               |
| ---------------- | -------------------------------------------------------------- |
| Networking       | Route53 + Kube Ingress Controller                              |
| Auth             | Clerk                                                          |
| Data             | Postgres Helm chart on the EC2 cluster + pg_dump backups to s3 |
| Web Applications | Helm (static / nginx) on the EC2 cluster                       |
| API              | Helm → Kubernetes on EC2                                       |
| Monitoring       | SigNoz (Helm) on the same cluster                              |

Notes: single public IP / DNS A record is enough. Swap Data to SaaS only if you intentionally leave "budget."

### optimized: Helm on EC2 + managed Postgres + CloudFront / S3

Still **Kubernetes on EC2** + the same API Helm chart. Differentiator vs budget: pull **web** and **data** off the VM onto managed services so the box is mostly the API cluster.

| Module           | Default provider                                      |
| ---------------- | ----------------------------------------------------- |
| Networking       | Route53 + Kube Ingress Controller; CloudFront for web |
| Auth             | Clerk                                                 |
| Data             | Managed Postgres (RDS or SaaS: Supabase, Neon, …)     |
| Web Applications | CloudFront + S3                                       |
| API              | Helm → Kubernetes on EC2                              |
| Monitoring       | LGTM (Helm on the EC2 cluster) or SigNoz              |

Notes: Nest stays ClusterIP behind the VM Ingress. Private path from EC2 to RDS/SaaS required. Multi-node EC2 optional later.

### scaled: ALB + EKS + CloudFront / S3 + managed Postgres

Differentiator vs optimized: **managed control plane and cloud load balancer** — Helm charts deploy to **EKS**; API traffic via **ALB**; web and DB stay managed.

| Module           | Default provider                                                        |
| ---------------- | ----------------------------------------------------------------------- |
| Networking       | Route53 + **ALB** + Kube Ingress Controller for api; CloudFront for web |
| Auth             | Clerk                                                                   |
| Data             | Managed Postgres SaaS (Supabase, Neon, …)                               |
| Web Applications | CloudFront + S3                                                         |
| API              | Helm → **EKS** behind ALB                                               |
| Monitoring       | CloudWatch (add SigNoz / LGTM later for richer OTEL APM)                |

## Related

- [`ci-cd.md`](ci-cd.md) — how this monorepo deploys develop/production today
- [`infra/README.md`](../infra/README.md) — Terraform env roots
