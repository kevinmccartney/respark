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
│   └── web/                    # React web app (Vite)
├── infra/
│   ├── envs/develop/           # Terraform root (develop)
│   └── modules/ui/             # S3 static website module
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

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start the web dev server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |

### Task runner

Common workflows use [Task](https://taskfile.dev/) from the repository root (install via `brew install go-task` or see the Task docs).

| Task              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `task web:build`  | Production build of the web app                  |
| `task infra:plan` | `terraform init` + `plan` in `infra/envs/develop` |
| `task infra:apply`| `terraform init` + `apply` in `infra/envs/develop` |
| `task web:deploy` | Build + `aws s3 sync` to the develop UI bucket   |

List all tasks with `task --list`.

### AWS hosting (Terraform)

S3 static website infrastructure lives in [`infra/envs/develop`](infra/envs/develop/README.md) (Terraform root). Use `task infra:apply` then `task web:deploy`, or follow the manual steps in that README.

## Contributing

Contribution guidelines and development workflow will be documented as the codebase grows.

## License

TBD.

---

_Magic: The Gathering is a trademark of Wizards of the Coast. respark is an unofficial fan project and is not affiliated with Wizards of the Coast._
