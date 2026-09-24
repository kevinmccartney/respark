# CI / CD (GitHub Actions)

Pipeline: **resolve environment** → **detect changes** → parallel per-project CI (`shared`, `schemas`, `ui`, `etl`, `api`, `client`, `admin`, `infra`) → **version & changelog** (push to `main` only) → **deploy infra** (if needed) → **deploy API** (if needed) → **deploy client** ∥ **deploy admin** (if needed).

Orchestration lives in [`Taskfile.yml`](../Taskfile.yml). The workflow only wires GitHub Environments, OIDC, path filters, and artifacts, then runs `task …` (never raw `npm` / `terraform` beyond what Task invokes). npm scripts stay in `package.json` for package binaries; Task calls those scripts.

Workflow file: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml). Node jobs share [`.github/actions/setup-js`](../.github/actions/setup-js/action.yml) (Node 22, Task, `task install`).

## Formatting & lint

Each project job runs its own `task <project>:ci` (scoped Prettier, ESLint, tests if any, and build). Whole-repo `task format` / `task lint` / `task test` stay for local and full-repo runs.

| Goal                 | Local                                                                                         | CI / git                                     |
| -------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Write format         | `task format`                                                                                 | —                                            |
| Check format         | `task format:check` (whole repo) or `task <project>:ci`                                       | per-project `*:ci` jobs                      |
| ESLint + TF validate | `task lint`                                                                                   | per-project `*:ci` (`infra:ci` validates TF) |
| Unit / fixture tests | `task test`                                                                                   | `etl:ci` / `api:ci`                          |
| Commit messages      | husky `commit-msg` → commitlint; `task commit` (Commitizen)                                   | `shared` job on every PR                     |
| On commit            | husky → `task precommit` (lint-staged Prettier/ESLint/`terraform fmt`, then `infra:validate`) | —                                            |

Prettier covers JS/TS/JSON/MD/YAML/CSS; ESLint covers apps, packages, and scripts; Terraform uses `terraform fmt` + `terraform validate` under `infra/`.

## Triggers

| Event                         | Environment                        | What runs                                                                                                                            |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pull request                  | `develop`                          | change detection, Conventional Commit lint (PR title + commits), per-project `*:ci`; `infra` still **plans**. No release or deploys. |
| Push to `main`                | `develop`                          | changed-project `*:ci` → platform release (if needed) → `apply` → `deploy-api` → `deploy-client` ∥ `deploy-admin`                    |
| `workflow_dispatch` on `main` | choice (`develop` or `production`) | **Force all** projects for the selected env (full `*:ci` + plan/apply + deploy)                                                      |

Production deploys are intentional: use **Actions → CI / CD → Run workflow** and pick `production`. Push to `main` always targets **develop**.

### First-time production bring-up

Terraform root: [`infra/envs/production`](../infra/envs/production/). Same AWS account as develop; resources are named `respark-production-*` and tagged `Environment=production`. State key: `envs/production/terraform.tfstate`.

1. Ensure GitHub Environment **`production`** exists with:
   - `AWS_ROLE_ARN` (OIDC role that trusts `environment:production`)
   - `VITE_CLERK_PUBLISHABLE_KEY` from a **separate Clerk production instance**
   - `COMPILE_CHECK_API_URL=https://api.respark.kevinmccartney.is`
   - Optional: required reviewers before deploy
2. Clerk production dashboard: allow origins for `https://respark.kevinmccartney.is` and `https://admin.respark.kevinmccartney.is` (webhook → prod API when ready).
3. Apply infra and push secrets (Clerk secret never enters Terraform state):

```bash
task infra:init ENV=production
task infra:plan ENV=production
task infra:apply ENV=production
task api:secrets:push ENV=production
```

4. Deploy apps: **Run workflow → `production`**, or `task deploy ENV=production`.
5. Confirm `site_url` / `admin_site_url` / `api_url` outputs, `/healthz` + `/info`, and sign-in. Prod DB starts empty — catalog ETL/sync is a follow-on.

## Change detection

[`dorny/paths-filter`](https://github.com/dorny/paths-filter) maps the git diff to flags. `changes` depends only on `config` (not on format or release). Checkout SHA is `github.sha`.

| Flag        | Paths                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`    | `docs/**`, root markdown, `.github/**`, `.husky/**`, `commitlint.config.mjs`, `docker-compose.yml`, `.prettierignore.shared`, `scripts/**` except API deploy scripts |
| `toolchain` | root `package.json`, `package-lock.json`, `Taskfile.yml`, `tsconfig*.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`                               |
| `schemas`   | `packages/schemas/**`                                                                                                                                                |
| `ui`        | `packages/ui/**`                                                                                                                                                     |
| `etl`       | `apps/etl/**`                                                                                                                                                        |
| `api`       | `apps/api/**`, API deploy scripts                                                                                                                                    |
| `client`    | `apps/client/**`                                                                                                                                                     |
| `admin`     | `apps/admin/**`                                                                                                                                                      |
| `infra`     | `infra/**`, TF backend bootstrap script                                                                                                                              |

Job `if` (plus `workflow_dispatch` `force=true`, which sets every flag):

| Job       | Runs when                                                                       |
| --------- | ------------------------------------------------------------------------------- |
| `shared`  | `shared` or `toolchain` or the event is a pull request (commitlint on every PR) |
| `schemas` | `schemas` or `toolchain`                                                        |
| `ui`      | `ui` or `toolchain`                                                             |
| `etl`     | `etl` or `schemas` or `toolchain`                                               |
| `api`     | `api` or `etl` or `schemas` or `toolchain` or a likely platform version bump    |
| `client`  | `client` or `schemas` or `ui` or `toolchain`                                    |
| `admin`   | `admin` or `schemas` or `ui` or `toolchain`                                     |
| `infra`   | `infra`                                                                         |

`toolchain` fans out to every JS project so a lockfile or ESLint config change rebuilds consumers. `shared` does **not** fan out to apps; it runs `task shared:ci` (Prettier on `.` with [`.prettierignore.shared`](../.prettierignore.shared) skipping trees other `*:ci` jobs already check, plus ESLint on root/scripts).

Each project job is self-contained: checkout `changes.sha`, `task install`, `task <project>:ci`. Package jobs do not upload artifacts for app jobs — consumers still compile schemas/ui themselves. The package jobs still exist so a schemas-only lint failure fails the workflow even if a consumer `tsc` happens to pass.

- **Plan / apply** run only when `infra` changed (or on force). Plan stays in the `infra` job (OIDC + `tfplan` artifact); `infra:ci` is fmt-check + validate only.
- **Deploy** runs for the matching app; an `infra` change also redeploys API/client/admin (EC2 / CDN may have moved).
- A platform version bump also runs API CI and deploys the API so `GET /info` serves the new version. Client/admin keep fetching `/info` at runtime.
- Skipped upstream jobs do not block later deploys (e.g. a client-only change skips plan/apply until release, then deploys API if the version bumped, plus client).
- Client/admin still wait on API when API _is_ deploying.

## Local ↔ CI isomorphism

| Goal                    | Local                                                                               | CI                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Format (write)          | `task format`                                                                       | —                                                                         |
| Format (check)          | `task format:check`                                                                 | scoped inside each `task *:ci`                                            |
| Lint                    | `task lint`                                                                         | scoped inside each `task *:ci`                                            |
| Test                    | `task test`                                                                         | `task etl:ci` / `task api:ci` (`schemas:build` then that package’s tests) |
| Lint commit messages    | `task commit` / `task commitlint`                                                   | `shared` job on PRs (title + commits)                                     |
| Shared / docs / scripts | `task shared:ci`                                                                    | `shared` job                                                              |
| Per-project CI          | `task schemas:ci`, `ui:ci`, `etl:ci`, `api:ci`, `client:ci`, `admin:ci`, `infra:ci` | matching project jobs                                                     |
| Platform release        | `task release -- --dry-run`                                                         | `release` job on push to `main` after project jobs                        |
| Build apps              | `task build`                                                                        | inside each `task *:ci`                                                   |
| Plan                    | `task infra:plan ENV=develop`                                                       | `infra` job after `infra:ci`                                              |
| Apply                   | `task infra:apply ENV=develop`                                                      | same (applies uploaded `tfplan`)                                          |
| Deploy API              | `task api:deploy ENV=develop`                                                       | same on `ubuntu-24.04-arm` (+ `DOCKER_BUILDX=1` `API_IMAGE_TAG=<sha>`)    |
| Deploy client / admin   | `task client:deploy` / `task admin:deploy`                                          | same                                                                      |

`ENV` selects `infra/envs/<ENV>` (override with `TF_DIR` if needed). Release and deploy checkouts use `needs.release.outputs.sha` when a bump commit exists, otherwise `needs.changes.outputs.sha`.

## Platform version & Conventional Commits

The platform has a single SemVer on the root [`package.json`](../package.json) (not per app). [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) drive the bump:

| Commits since the last `v*` tag               | Bump       |
| --------------------------------------------- | ---------- |
| `BREAKING CHANGE:` footer or `type!`          | major      |
| At least one `feat`                           | minor      |
| At least one `fix` (or other releasable type) | patch      |
| Only `chore` / `docs` / `test` / `ci` / …     | no release |

Authoring:

- husky **commit-msg** runs commitlint (`@commitlint/config-conventional`).
- `task commit` runs Commitizen (`cz-conventional-changelog`). Do not use a `prepare-commit-msg` hook — `git commit -m` must keep working.
- PRs: CI lints the **PR title** and every commit on the branch. **Squash-merge** (or rebase) with a conventional title; a default “Merge pull request #N” commit is not a bump signal.

Release (CI `release` job on push to `main` after every project job succeeds or is skipped; skipped for `chore(release):` commits):

1. No `v*` tags yet: tag `v0.1.0` from the current root version and create a GitHub Release (does not rewrite history into the changelog).
2. Otherwise: `conventional-recommended-bump` + `conventional-changelog` (`conventionalcommits` preset) via `task release` ([`scripts/release.mjs`](../scripts/release.mjs)): bump root `package.json` / lockfile, prepend [`CHANGELOG.md`](../CHANGELOG.md) (Prettier-formatted), commit `chore(release): vX.Y.Z`, tag, push, `gh release create`.
3. Later jobs check out that SHA. Locally: `task release -- --dry-run` (does not tag or push).

If `main` is protected, allow GitHub Actions to push so the job can tag.

Running APIs expose the version on public **`GET /info`** `{ "version": "0.1.0" }` (read from root `package.json`, or `APP_VERSION`). **`GET /healthz`** stays `{ "status": "ok" }` for load balancers. Client and admin footers fetch `/info` next to `/healthz`.

## One-time setup

### 1. Terraform remote state

State must live in S3 so CI and your laptop share the same stack:

```bash
bash scripts/bootstrap-tf-backend.sh
task infra:init ENV=develop
# If migrating from local state:
terraform -chdir=infra/envs/develop init -migrate-state
# Production (same account, separate state key):
task infra:init ENV=production
```

This creates `respark-tfstate` (S3) and `respark-tfstate-lock` (DynamoDB) in `us-east-1`. Each env’s `versions.tf` uses a distinct state key (`envs/develop/terraform.tfstate`, `envs/production/terraform.tfstate`, `envs/local/terraform.tfstate`). Laptop Compose IAM lives in [`infra/envs/local`](../infra/envs/local/README.md) (`task infra:apply ENV=local`) and is not a GitHub Environment.

### 2. GitHub Environments

Create GitHub Environments named **`develop`** and **`production`** (names must match `infra/envs/<name>`). Optionally require reviewers on `production` before apply/deploy.

Per environment, set:

| Kind     | Name                         | Purpose                                                                                                                                                                                |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable | `AWS_ROLE_ARN`               | IAM role ARN assumed via OIDC for this env                                                                                                                                             |
| Variable | `COMPILE_CHECK_API_URL`      | Placeholder `VITE_API_URL` for compile-check `task client:ci` / `admin:ci` (develop: `https://dev.api.respark.kevinmccartney.is`; production: `https://api.respark.kevinmccartney.is`) |
| Variable | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **publishable** key for that Clerk instance (dev vs prod). Public; baked into the client/admin bundle.                                                                           |

Clerk **secret** keys stay in SSM (`task api:secrets:push ENV=…`); the workflow does not push them.

### 3. GitHub → AWS OIDC role

1. Create an IAM OIDC identity provider for `https://token.actions.githubusercontent.com` (audience `sts.amazonaws.com`) if the account does not have one.
2. Create an IAM role trusted by that provider for this repo. Prefer matching on **`repository` + `environment`** claims (stable) rather than a bare `repo:OWNER/REPO:environment:…` `sub` — GitHub’s `sub` now embeds numeric IDs, e.g. `repo:kevinmccartney@11141389/respark@1375838939:environment:develop`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:repository": "kevinmccartney/respark"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:*:environment:develop"
        }
      }
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:repository": "kevinmccartney/respark"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:*:environment:production"
        }
      }
    }
  ]
}
```

Use one statement (or one role) per environment if you split roles. Jobs must set `environment: develop` or `environment: production` (the workflow already does) or assume-role will fail.

Alternatively, pin the exact `sub` from a debug JWT decode (includes `@ownerId` / `@repoId`).

3. Attach permissions sufficient to run Terraform for that env (S3, CloudFront, ACM, Route53, EC2, ECR, RDS, SSM, IAM for instance profiles, CloudWatch Logs) plus ECR push and SSM `SendCommand` for API redeploy.
4. Put the role ARN in the environment variable `AWS_ROLE_ARN` (you can use one role for both envs or separate roles with a single environment each).

## Notes

- API images are built for **`linux/arm64`** (Graviton) and tagged with the git SHA and `latest`. The `deploy-api` job runs on **`ubuntu-24.04-arm`** so `npm ci` is native; do not reintroduce QEMU for this image (Node 22 on Alpine under amd64→arm64 emulation hits SIGILL).
- Client/admin deploy tasks rebuild with `VITE_API_URL` from Terraform `api_url` and `VITE_CLERK_PUBLISHABLE_KEY` from the **GitHub Environment variable** of the same name (locally: `apps/client/.env.local` / `apps/admin/.env.local`). Client and admin share one Clerk app, so they share one publishable key. Production Vite builds fail if it is unset. Clerk **secret** keys stay in SSM.
- `terraform apply` uses the exact plan artifact from the matching `infra` job (`tfplan-<env>`).
- Overlapping runs on the same ref + env are serialized via workflow concurrency; PR runs cancel superseded builds.
