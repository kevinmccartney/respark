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
│   ├── api/                    # NestJS API
│   └── web/                    # React web app (Vite)
├── infra/
│   ├── envs/develop/           # Terraform root (develop)
│   └── modules/ui/             # S3 + CloudFront + HTTPS UI module
├── docker-compose.yml          # Local API stack
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

Authentication uses [Clerk](https://clerk.com/) in `apps/web`. After cloning:

- **Web:** copy `apps/web/.env.example` → `apps/web/.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY` (`clerk env pull` from `apps/web` fills this; do not use the secret key in the web app).
- **API:** copy `apps/api/.env.example` → `apps/api/.env` and set `CLERK_SECRET_KEY` (copy from Dashboard or from web `.env.local` after `clerk env pull` — keep it out of the Vite bundle).

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Start the web dev server                           |
| `npm run dev:api` | Start the API in watch mode (`PORT`, default 3000) |

Local API details: [`apps/api/README.md`](apps/api/README.md). Debug in VS Code: **Run and Debug → API: debug (launch)**.
| `npm run build` | Production build (web + API) |
| `npm run preview` | Preview production build |

### Task runner

Common workflows use [Task](https://taskfile.dev/) from the repository root (install via `brew install go-task` or see the Task docs).

| Task                    | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `task build`            | Production build web + API                                        |
| `task web:build`        | Production build of the web app                                   |
| `task api:build`        | Compile the NestJS API                                            |
| `task docker:up`        | Start local Postgres + API + web (Compose watch mode)             |
| `task docker:down`      | Stop the local Compose stack (keeps DB volume)                    |
| `task docker:logs`      | Follow local API + web container logs                             |
| `task api:dev`          | API watch mode on the host (`PORT`, default 3000)                 |
| `task api:debug`        | Host API watch + inspector on 9229                                |
| `task api:start`        | Run compiled API (after `api:build`)                              |
| `task infra:plan`       | `terraform init` + `plan` in `infra/envs/develop`                 |
| `task infra:apply`      | `terraform init` + `apply` in `infra/envs/develop`                |
| `task db:up`            | Start local Postgres only                                         |
| `task db:migrate`       | Apply Drizzle migrations                                          |
| `task db:tunnel`        | SSM tunnel to develop RDS (`localhost:15432`)                     |
| `task db:url`           | Print develop `DATABASE_URL` from SSM (has password)              |
| `task api:secrets:push` | Push `CLERK_SECRET_KEY` to SSM Parameter Store                    |
| `task api:deploy`       | Build/push the API image and restart it on EC2                    |
| `task web:deploy`       | Build against the deployed API, sync to S3, invalidate CloudFront |

List all tasks with `task --list`.

Local Docker stack: `task docker:up` brings up Postgres, API (:3000), and web (:5173). Details in [`apps/api/README.md`](apps/api/README.md).

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

Develop UI (0.x) is served at **https://dev.respark.kevinmccartney.is** via [`infra/envs/develop`](infra/envs/develop/README.md) (S3, CloudFront, ACM, Route53). Run `task infra:apply` then `task web:deploy`.

`task web:deploy` injects **`VITE_API_URL`** from the Terraform `api_url` output at build time. Build the web app any other way for deployment and the bundle will target `http://localhost:3000`, so each visitor would call their own machine — production builds now fail loudly instead.

## Contributing

Contribution guidelines and development workflow will be documented as the codebase grows.

## License

TBD.

---

_Magic: The Gathering is a trademark of Wizards of the Coast. respark is an unofficial fan project and is not affiliated with Wizards of the Coast._
