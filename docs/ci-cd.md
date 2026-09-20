# CI / CD (GitHub Actions)

Pipeline: **format check** → **release** (push to `main` only) → **detect changes** → **build** (changed apps) and **plan** (if infra) → on deployable refs, **apply** (if infra) → **deploy API** (if needed) → **client** ∥ **admin** (if needed).

Orchestration lives in [`Taskfile.yml`](../Taskfile.yml). The workflow only wires GitHub Environments, OIDC, path filters, and artifacts, then runs `task …` (never raw `npm` / `terraform` beyond what Task invokes). npm scripts stay in `package.json` for package binaries; Task calls those scripts.

Workflow file: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

## Formatting & lint

| Goal                 | Local                                                                                         | CI / git                   |
| -------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| Write format         | `task format`                                                                                 | —                          |
| Check format         | `task format:check`                                                                           | `format` job               |
| ESLint + TF validate | `task lint`                                                                                   | `format` job (`task lint`) |
| Unit / fixture tests | `task test`                                                                                   | `format` job (`task test`) |
| Commit messages      | husky `commit-msg` → commitlint; `task commit` (Commitizen)                                   | `format` job on PRs        |
| On commit            | husky → `task precommit` (lint-staged Prettier/ESLint/`terraform fmt`, then `infra:validate`) | —                          |

Prettier covers JS/TS/JSON/MD/YAML/CSS; ESLint covers apps; Terraform uses `terraform fmt` + `terraform validate` under `infra/`.

## Triggers

| Event                         | Environment                        | What runs                                                                                                                                     |
| ----------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request                  | `develop`                          | format/lint/test, Conventional Commit lint (PR title + commits), `build` + `plan` for changed paths                                           |
| Push to `main`                | `develop`                          | format/lint/test → platform release (if needed) → changed paths: `build` / `plan` → `apply` → `deploy-api` → `deploy-client` ∥ `deploy-admin` |
| `workflow_dispatch` on `main` | choice (`develop` or `production`) | **Force all** paths for the selected env (full rebuild + plan/apply + deploy)                                                                 |

Production deploys are intentional: use **Actions → CI / CD → Run workflow** and pick `production`.

## Change detection

[`dorny/paths-filter`](https://github.com/dorny/paths-filter) maps the git diff to flags:

| Flag     | Paths (also triggered by root `package.json` / lockfile / `Taskfile.yml` / tsconfig as “shared”) |
| -------- | ------------------------------------------------------------------------------------------------ |
| `etl`    | `apps/etl/**`                                                                                    |
| `api`    | `apps/api/**`, API deploy scripts (etl and `packages/schemas` changes count as API)              |
| `client` | `apps/client/**` (also `packages/schemas`, `packages/ui`)                                        |
| `admin`  | `apps/admin/**` (also `packages/schemas`, `packages/ui`)                                         |
| `infra`  | `infra/**`, TF backend bootstrap script                                                          |

- **Build** runs only the matching `task *:build` steps.
- **Plan / apply** run only when `infra` changed (or on force).
- **Deploy** runs for the matching app; an `infra` change also redeploys API/client/admin (EC2 / CDN may have moved).
- A platform version bump also deploys the API so `GET /info` serves the new version.
- Skipped upstream jobs do not block later deploys (e.g. a client-only change skips plan/apply/API, then deploys client).
- Client/admin still wait on API when API _is_ deploying.

## Local ↔ CI isomorphism

| Goal                  | Local                                      | CI                                                                     |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Format (write)        | `task format`                              | —                                                                      |
| Format (check)        | `task format:check`                        | `format` job                                                           |
| Lint                  | `task lint`                                | `format` job                                                           |
| Test                  | `task test`                                | `format` job                                                           |
| Lint commit messages  | `task commit` / `task commitlint`          | `format` job on PRs (title + commits)                                  |
| Platform release      | `task release -- --dry-run`                | `release` job on push to `main`                                        |
| Build apps            | `task build`                               | conditional `task *:build`                                             |
| Plan                  | `task infra:plan ENV=develop`              | same                                                                   |
| Apply                 | `task infra:apply ENV=develop`             | same (applies uploaded `tfplan`)                                       |
| Deploy API            | `task api:deploy ENV=develop`              | same on `ubuntu-24.04-arm` (+ `DOCKER_BUILDX=1` `API_IMAGE_TAG=<sha>`) |
| Deploy client / admin | `task client:deploy` / `task admin:deploy` | same                                                                   |

`ENV` selects `infra/envs/<ENV>` (override with `TF_DIR` if needed).

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

Release (CI `release` job on push to `main`, skipped for `chore(release):` commits):

1. No `v*` tags yet: tag `v0.1.0` from the current root version and create a GitHub Release (does not rewrite history into the changelog).
2. Otherwise: `conventional-recommended-bump` + `conventional-changelog` (`conventionalcommits` preset) via `task release` ([`scripts/release.mjs`](../scripts/release.mjs)): bump root `package.json` / lockfile, prepend [`CHANGELOG.md`](../CHANGELOG.md), commit `chore(release): vX.Y.Z`, tag, push, `gh release create`.
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
```

This creates `respark-tfstate` (S3) and `respark-tfstate-lock` (DynamoDB) in `us-east-1`. Each env’s `versions.tf` should use a distinct state key (e.g. `envs/develop/terraform.tfstate`). Laptop Compose IAM lives in [`infra/envs/local`](../infra/envs/local/README.md) (`task infra:apply ENV=local`) and is not a GitHub Environment.

### 2. GitHub Environments

Create GitHub Environments named **`develop`** and **`production`** (names must match `infra/envs/<name>`). Optionally require reviewers on `production` before apply/deploy.

Per environment, set:

| Kind     | Name                         | Purpose                                                                                                          |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Variable | `AWS_ROLE_ARN`               | IAM role ARN assumed via OIDC for this env                                                                       |
| Variable | `COMPILE_CHECK_API_URL`      | Placeholder `VITE_API_URL` for the compile-check `task build` (e.g. `https://dev.api.respark.kevinmccartney.is`) |
| Variable | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **publishable** key for that Clerk instance (dev vs prod). Public; baked into the client/admin bundle.     |

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
- `terraform apply` uses the exact plan artifact from the matching `plan` job (`tfplan-<env>`).
- Overlapping runs on the same ref + env are serialized via workflow concurrency; PR runs cancel superseded builds.
