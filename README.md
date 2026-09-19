# respark

**respark** is a Magic: The Gathering companion app that helps you reignite your MTG journey — continuously learn, evaluate and reevaluate cards, and build decks with confidence.

## Vision

Whether you're returning after years away or deepening an existing collection habit, respark is built around the loop of **learn → evaluate → build**. Start with decks you care about, search the card catalog, and refine lists over time instead of one-off deck dumps.

## MVP scope

The first release focuses on a solid web foundation and deck building basics:

| Area         | Goal                                    |
| ------------ | --------------------------------------- |
| **Platform** | React web app with authentication       |
| **Account**  | Sign up, log in, and onboarding         |
| **Decks**    | Deck list view and individual deck view |
| **Cards**    | Search for cards and add them to a deck |

## Monorepo

This repository is organized as a monorepo so the web app, shared types, and future packages (API, workers, etc.) can evolve together. Package layout and tooling will be added as implementation begins.

```plaintext
respark/
├── apps/
│   ├── admin/                  # Admin ops dashboard (Vite + Clerk)
│   ├── api/                    # NestJS API
│   ├── etl/                    # MTG data pipeline (lib + CLI)
│   └── web/                    # React web app (Vite)
├── docs/                       # Product / pipeline documentation
├── infra/
│   ├── envs/develop/           # Terraform root (develop)
│   └── modules/ui/             # S3 + CloudFront + HTTPS UI module
├── docker-compose.yml          # Local Postgres + API + web + admin
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

Authentication uses [Clerk](https://clerk.com/) in `apps/web` and `apps/admin` (same Clerk application). After cloning:

- **Web:** copy `apps/web/.env.example` → `apps/web/.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY` (`clerk env pull` from `apps/web` fills this; do not use the secret key in the web app).
- **Admin:** copy `apps/admin/.env.example` → `apps/admin/.env.local` and use the same publishable key. Grant access by setting the Clerk user's public metadata to `{ "role": "admin" }` (see [`apps/admin/README.md`](apps/admin/README.md)).
- **API:** copy `apps/api/.env.example` → `apps/api/.env` and set `CLERK_SECRET_KEY` (copy from Dashboard or from web `.env.local` after `clerk env pull` — keep it out of the Vite bundle).

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the web dev server                            |
| `npm run dev:api`   | Start the API in watch mode (`PORT`, default 3000)  |
| `npm run dev:admin` | Start the admin dashboard (`http://localhost:4000`) |
| `npm run build`     | Production build (web + API)                        |
| `npm run preview`   | Preview production build                            |

Local API details: [`apps/api/README.md`](apps/api/README.md). Debug in VS Code: **Run and Debug → API: debug (launch)**.

### Task runner

Common workflows use [Task](https://taskfile.dev/) from the repository root (install via `brew install go-task` or see the Task docs).

| Task                    | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `task build`            | Production build etl, API, web, and admin                         |
| `task etl:build`        | Compile the ETL CLI                                               |
| `task web:build`        | Production build of the web app                                   |
| `task admin:build`      | Production build of the admin app                                 |
| `task api:build`        | Compile the NestJS API (runs `etl:build` first)                   |
| `task docker:up`        | Start local Postgres + API + web + admin (Compose watch mode)     |
| `task docker:down`      | Stop the local Compose stack (keeps DB volume)                    |
| `task docker:logs`      | Follow local API + web + admin container logs                     |
| `task api:dev`          | API watch mode on the host (`PORT`, default 3000)                 |
| `task admin:dev`        | Admin Vite app on port 4000                                       |
| `task api:debug`        | Host API watch + inspector on 9229                                |
| `task api:start`        | Run compiled API (after `api:build`)                              |
| `task infra:plan`       | `terraform` fmt/validate/plan in `infra/envs/$ENV` (default develop) |
| `task infra:apply`      | Apply plan file if present, else interactive apply (`ENV=…`)      |
| `task deploy`           | Apply Terraform, deploy API, then web+admin in parallel (`ENV=…`) |
| `task db:up`            | Start local Postgres only                                         |
| `task db:migrate`       | Apply Drizzle migrations                                          |
| `task etl -- <cmd>`     | MTG ETL CLI — see [`docs/etl/operations.md`](docs/etl/operations.md) |
| `task db:tunnel`        | SSM tunnel to RDS for `$ENV` (`localhost:15432`)                  |
| `task db:url`           | Print `$ENV` `DATABASE_URL` from SSM (has password)               |
| `task api:secrets:push` | Push `CLERK_SECRET_KEY` to SSM for `$ENV`                         |
| `task api:deploy`       | Build/push the API image and restart it on EC2 (`ENV=…`)          |
| `task web:deploy`       | Build against the deployed API, sync to S3, invalidate CloudFront |
| `task admin:deploy`     | Same for the admin dashboard                                      |

Pass `ENV=production` (or `ENV=develop`) on any infra/deploy task; CI uses the same commands. List all tasks with `task --list`.

Local Docker stack: `task docker:up` brings up Postgres, API (:3000), web (:5173), and admin (:4000). Details in [`apps/api/README.md`](apps/api/README.md).

#### Connect a local Postgres client to develop RDS

RDS is **not** public. Use `task db:tunnel` — it opens an SSM port-forward through the API EC2 instance so `127.0.0.1:15432` reaches Postgres without opening the security group.

Requires the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) and `ssm:StartSession` on your IAM user.

**Credentials** (develop defaults):

| Field    | Value                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| User     | `respark`                                                                              |
| Database | `respark`                                                                              |
| Password | Random, generated by Terraform — read from SSM (`…/api/database-url`), never committed |

```bash
task db:tunnel   # leave running
task db:url      # postgres://respark:<password>@<rds-host>:5432/respark
```

For a GUI client: host `127.0.0.1`, port `15432`, user `respark`, SSL require, password from `task db:url`.

### AWS hosting (Terraform)

Develop web (0.x) is at **https://dev.respark.kevinmccartney.is**; admin at **https://dev.admin.respark.kevinmccartney.is** — see [`infra/envs/develop`](infra/envs/develop/README.md) (S3, CloudFront, ACM, Route53). Full stack: `task deploy` (Terraform apply → API → web → admin), or run the pieces separately (`task infra:apply`, `task web:deploy`, `task admin:deploy`). GitHub Actions CI/CD: [`docs/ci-cd.md`](docs/ci-cd.md).

Both deploy tasks inject **`VITE_API_URL`** from the Terraform `api_url` output at build time. Build either SPA any other way for deployment and the bundle will target `http://localhost:3000`, so each visitor would call their own machine — production builds now fail loudly instead.

## Contributing

Contribution guidelines and development workflow will be documented as the codebase grows.

## License

TBD.

---

_Magic: The Gathering is a trademark of Wizards of the Coast. respark is an unofficial fan project and is not affiliated with Wizards of the Coast._
