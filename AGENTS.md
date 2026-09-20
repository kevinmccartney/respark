# Agent notes

Short standing orders for AI agents live in [`.cursor/rules/`](.cursor/rules/). Deep reference stays in [`docs/`](docs/) and package READMEs.

| Rule                | When                                      |
| ------------------- | ----------------------------------------- |
| `respark-core`      | Always — Task vs npm, ENV, quality gates  |
| `js-ts-quality`     | `apps/**` TS/JS — naming and code quality |
| `terraform-quality` | `infra/**` — Terraform naming and layout  |
| `infra-cicd`        | `infra/`, workflows, deploy scripts       |
| `api`               | `apps/api/`                               |
| `client-admin`      | `apps/client/`, `apps/admin/`             |
| `etl`               | `apps/etl/`, `docs/etl/`                  |

Start with `task --list` and `docs/README.md`. For CI/CD details, read `docs/ci-cd.md` rather than inventing pipeline steps.
