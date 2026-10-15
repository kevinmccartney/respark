# respark

**respark** is a Magic: The Gathering companion app that helps you reignite your MTG journey — continuously learn, evaluate and reevaluate cards, and build decks with confidence.

## Vision

Whether you're returning after years away or deepening an existing collection habit, respark is built around the loop of **learn → evaluate → build**. Start with decks you care about, search the card catalog, and refine lists over time instead of one-off deck dumps.

## Monorepo

This repository is organized as a monorepo so the player client, shared types, and future packages (API, workers, etc.) can evolve together. Package layout and tooling will be added as implementation begins.

```plaintext
respark/
├── apps/
│   ├── admin/                  # Admin ops dashboard (Vite + Clerk)
│   ├── api/                    # NestJS API
│   ├── client/                 # Player-facing React app (Vite)
│   └── etl/                    # MTG data pipeline (lib + CLI)
├── docs/                       # Product / pipeline documentation
├── infra/
│   ├── envs/develop/           # Terraform root (develop)
│   ├── envs/production/        # Terraform root (production, same account)
│   ├── envs/local/             # Laptop API IAM (Bedrock)
│   └── modules/ui/             # S3 + CloudFront + HTTPS UI module
├── docker-compose.yml          # Local stack (task docker:up)
├── .env.example                # Template for .env.local / .env.develop / .env.production
├── package.json                # npm workspaces root
├── Taskfile.yml                # [Task](https://taskfile.dev/) runner
└── README.md
```

## Getting started

Requires [Node.js](https://nodejs.org/) 20+ (22+ recommended for Vite 8).

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:5173`).

Authentication uses [Clerk](https://clerk.com/), one Clerk instance per environment shared by the client, admin, and API. Env files live at the repo root (all gitignored; template: [`.env.example`](.env.example)):

- **`.env.local`** — local development (API, ETL CLI, Vite dev, Docker Compose). Copy `.env.example` and set the Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`).
- **`.env.develop`** / **`.env.production`** — the Clerk keys for that environment. `task api:secrets:push`, `task client:deploy`, and `task admin:deploy` read `.env.$ENV`.

Only `VITE_*` keys reach the browser bundle. Admin access: set the Clerk user's public metadata to `{ "role": "admin" }` (see [`apps/admin/README.md`](apps/admin/README.md)).

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the client dev server                         |
| `npm run dev:api`   | Start the API in watch mode (`PORT`, default 3000)  |
| `npm run dev:admin` | Start the admin dashboard (`http://localhost:4000`) |
| `npm run build`     | Production build (client + API)                     |
| `npm run preview`   | Preview production build                            |

Local API details: [`apps/api/README.md`](apps/api/README.md). Debug in VS Code: **Run and Debug → API: debug (launch)**.

### Task runner

Common workflows use [Task](https://taskfile.dev/) from the repository root (install via `brew install go-task` or see the Task docs).

| Task                         | Description                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `task install`               | Install JS deps (`npm ci`)                                                                                     |
| `task format`                | Write Prettier + `terraform fmt`                                                                               |
| `task format:check`          | Check formatting without writing (whole repo)                                                                  |
| `task format:staged`         | Format + ESLint staged files (lint-staged)                                                                     |
| `task lint`                  | ESLint + `terraform validate`                                                                                  |
| `task test`                  | Unit tests (etl + API chat evals, no Bedrock)                                                                  |
| `task lint:eslint`           | ESLint only                                                                                                    |
| `task infra:validate`        | `terraform validate` for `$ENV` (no remote backend)                                                            |
| `task precommit`             | Husky hook: staged format/lint + infra validate                                                                |
| `task commit`                | Interactive Conventional Commit (Commitizen)                                                                   |
| `task commitlint`            | Lint commit messages from `origin/main` (or `BASE=`) to HEAD                                                   |
| `task release`               | Platform version bump + changelog + tag (CI on `main`; locally `-- --dry-run`)                                 |
| `task build`                 | Production build etl, API, client, and admin                                                                   |
| `task <project>:ci`          | Per-project format-check, lint, test, and build (`schemas`/`ui`/`etl`/`api`/`client`/`admin`/`infra`/`shared`) |
| `task etl:build`             | Compile the ETL CLI                                                                                            |
| `task client:build`          | Production build of the player client                                                                          |
| `task admin:build`           | Production build of the admin app                                                                              |
| `task api:build`             | Compile the NestJS API (runs `etl:build` first)                                                                |
| `task docker:up`             | Local stack via Docker Compose: Postgres, API, client, admin (watch mode)                                      |
| `task docker:down`           | Stop the local stack (keeps the Postgres volume)                                                               |
| `task docker:logs`           | Follow local API + client + admin logs                                                                         |
| `task docker:ps`             | Local Compose services                                                                                         |
| `task api:dev`               | API watch mode on the host (`PORT`, default 3000)                                                              |
| `task admin:dev`             | Admin Vite app on port 4000                                                                                    |
| `task api:debug`             | Host API watch + inspector on 9229                                                                             |
| `task api:start`             | Run compiled API (after `api:build`)                                                                           |
| `task infra:plan`            | `terraform` fmt/validate/plan in `infra/envs/$ENV` (default develop)                                           |
| `task infra:apply`           | Apply plan file if present, else interactive apply (`ENV=…`)                                                   |
| `task deploy`                | Apply Terraform, deploy API, then client+admin in parallel (`ENV=…`)                                           |
| `task db:up`                 | Start local Postgres only (Compose `db` service)                                                               |
| `task db:migrate`            | Apply Drizzle migrations                                                                                       |
| `task etl -- <cmd>`          | MTG ETL CLI — see [`docs/etl/operations.md`](docs/etl/operations.md)                                           |
| `task db:tunnel`             | SSM tunnel to RDS for `$ENV` (`localhost:15432`)                                                               |
| `task db:url`                | Print `$ENV` `DATABASE_URL` from SSM (has password)                                                            |
| `task db:purge-non-playable` | Dry-run delete of catalog extras (tokens, art, planes, …) on `$ENV` RDS (`-- apply` to run)                    |
| `task api:secrets:push`      | Push the Clerk secrets from `.env.$ENV` to SSM                                                                 |
| `task api:deploy`            | Build/push the API image and roll the ECS Fargate service (`ENV=…`)                                            |
| `task client:deploy`         | Build against the deployed API, sync to S3, invalidate CloudFront                                              |
| `task admin:deploy`          | Same for the admin dashboard                                                                                   |

Pass `ENV=production` (or `ENV=develop`) on any infra/deploy task; CI uses the same commands. List all tasks with `task --list`.

Local stack: `task docker:up` runs Postgres, API (:3000), client (:5173), and admin (:4000) with Docker Compose, using the root `.env.local`. Details in [`apps/api/README.md`](apps/api/README.md).

#### Connect a local Postgres client to develop RDS

RDS is **not** public. Use `task db:tunnel` — it opens an SSM port-forward through the running API task (ECS Exec) so `127.0.0.1:15432` reaches Postgres without opening the security group.

Requires the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) and `ssm:StartSession` on your IAM user.

**Credentials** (develop defaults):

| Field    | Value                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| User     | `respark_develop` (production: `respark`)                                              |
| Database | `respark_develop` (production: `respark`)                                              |
| Password | Random, generated by Terraform — read from SSM (`…/api/database-url`), never committed |

```bash
task db:tunnel   # leave running
task db:url      # postgres://respark_develop:<password>@<rds-host>:5432/respark_develop
```

For a GUI client: host `127.0.0.1`, port `15432`, SSL require, user and password from `task db:url`. Architecture: [`docs/current-architecture.md`](docs/current-architecture.md).

### AWS hosting (Terraform)

Develop client (0.x) is at **https://dev.respark.kevinmccartney.is**; admin at **https://dev.admin.respark.kevinmccartney.is** — see [`infra/envs/develop`](infra/envs/develop/README.md). Production: **https://respark.kevinmccartney.is** / **https://admin.respark.kevinmccartney.is** — see [`infra/envs/production`](infra/envs/production/README.md). Full stack: `task deploy` (Terraform apply → API → client → admin), or run the pieces separately (`task infra:apply`, `task client:deploy`, `task admin:deploy`). Pass `ENV=production` for prod. GitHub Actions CI/CD: [`docs/ci-cd.md`](docs/ci-cd.md).

Both deploy tasks inject **`VITE_API_URL`** from the Terraform `api_url` output at build time. Build either SPA any other way for deployment and the bundle will target `http://localhost:3000`, so each visitor would call their own machine — production builds now fail loudly instead.

## Documentation

| Doc                                  | Topic                                                       |
| ------------------------------------ | ----------------------------------------------------------- |
| [`docs/domain.md`](docs/domain.md)   | Business objects, system diagram, ERDs                      |
| [`docs/ai-chat.md`](docs/ai-chat.md) | Global assistant: sticky context, tools, Bedrock, WebSocket |
| [`docs/README.md`](docs/README.md)   | Full index (CI/CD, ETL, chat)                               |

## Contributing

Contribution guidelines and development workflow will be documented as the codebase grows.

## License

TBD.

---

_Magic: The Gathering is a trademark of Wizards of the Coast. respark is an unofficial fan project and is not affiliated with Wizards of the Coast._
