# infra/aws — ECS Fargate + CloudFront + Aurora Serverless v2 (AWS CDK, TypeScript)

Seven Nest services run as **Fargate tasks that sleep when idle**, the two Next.js frontends are **static exports on
S3**, one CloudFront distribution serves everything under one hostname, and Postgres is Aurora Serverless v2 that
**pauses to zero** when nobody is connected. No NAT gateway, no VPC endpoints, no EC2 host.

```
                 https://malinina.ca/            https://malinina.ca/admin/        https://malinina.ca/api/<svc>/…
                        │                               │                                  │
Route 53 ───────────────┴───────────────────────────────┴──────────────────────────────────┘
 malinina.ca, www., admin., api.  →  A/AAAA alias  →  CloudFront distribution  (ACM: malinina.ca + *.malinina.ca)
                                                        │ response-headers policy on the static behaviours
          ┌─────────────────────────────────────────────┼──────────────────────────────────────┐
          │ default  /*                                 │ /admin/*                             │ /api/*   (no cache)
          ▼                                             ▼                                      ▼ CF Function: strip "/api"
   S3 bf-prod-<acct>-fe-main                   S3 bf-prod-<acct>-fe-admin                ALB bf-prod :443 (same ACM cert)
   (private, OAC; CF Function: /x/ → /x/index.html)                                      SG bf-prod-alb: 443 from CloudFront prefix list only
                                                                                          listener rule: header X-Origin-Verify == secret, else 403
                                                                                                 │ target group bf-prod-api, /health/live
   ┌─ ECS cluster bf-prod (Fargate, arm64, public subnets, SG bf-prod-tasks) ───────────────────┼───────────────────────────────────┐
   │                                                                                            ▼                                   │
   │   api      1…4 tasks, always on    ── Service Connect namespace bf-prod.local ──►  auth:3001  order:3002  course:3003          │
   │   ├ edge (JWT, roles, rate limit, proxy /<svc>/*)                                  billing:3004  admin:3005  ai:3006           │
   │   └ orchestrator (wake / sleep / cooldown)                                         each: 0 tasks asleep, 1…4 awake            │
   │        │ state = ECS desiredCount/runningCount + tags bf:last-activity, bf:cooldown                                            │
   │        │ ecs:UpdateService · application-autoscaling:RegisterScalableTarget · ecs:DescribeServices                             │
   │   jobs (when they exist): EventBridge Scheduler → Step Functions (timeout) → RunTask     (lib/jobs.ts)                         │
   └──────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                  │ 5432, SG bf-prod-db ← SG bf-prod-tasks (+ your IP via `pnpm db:allow-me`)       outbound (OpenAI, S3, ECR,
                  ▼                                                                                   logs, secrets): public IP, no NAT
        Aurora Serverless v2 Postgres bf-prod, 0–4 ACU, auto-pause 10 min, db.malinina.ca
        S3 bf-prod-<acct>-api (app files)      Secrets Manager bf/prod/*      SSM /bf/prod/images/<app>      ECR bf-prod/<app>
```

Always running: CloudFront, the ALB, `api`. Everything else exists as a definition and costs nothing until used.

Everything is TypeScript: the resources are CDK code in `lib/`, every operation is a script in `scripts/` that runs the
same way on a laptop and in GitHub Actions (`node infra/aws/scripts/<name>.ts` — Node ≥ 26 runs `.ts` directly).

| Path                                 | Contents                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/app.ts`                         | Three stacks: `bf-github` (once, from a laptop), `bf-prod` (platform), `bf-prod-apps` (services). Reads the image tags at synth                                                             |
| `lib/config.ts`                      | **The one place to change things**: region, domains, hosted zone, ECS defaults (task size, cooldown, always-on), DB capacity, every name                                                    |
| `lib/apps.ts`                        | Per-app overrides (`appOverrides`) + what each service needs, derived from `scripts/apps.mjs` and `.env.example`: port, deps, secrets, env                                                  |
| `lib/network.ts`                     | VPC `10.42.0.0/16`, two public subnets (ALB + DB subnet group need two AZs; only `config.workAz` runs anything), security groups `alb`, `tasks`, `db`, `db-dev`. No NAT, no private subnets |
| `lib/secrets.ts`                     | Secrets Manager: `POSTGRES_PASSWORD` (generated), `JWT_*` / `OPENAI_API_KEY` (filled by `set-secrets.ts`)                                                                                   |
| `lib/data.ts`                        | Aurora Serverless v2 cluster, `db.<domain>` CNAME, the app S3 bucket                                                                                                                        |
| `lib/cluster.ts`                     | ECS cluster + Cloud Map namespace `bf-prod.local` (Service Connect)                                                                                                                         |
| `lib/ingress.ts`                     | ACM certificate, ALB + listener rule, the two static buckets (OAC), CloudFront + functions + headers policy, DNS records, SSM platform params                                               |
| `lib/cloudfront/viewer-request.ts`   | The one CloudFront Function: legacy hostnames → paths, strip `/api`, `/x/` → `/x/index.html`                                                                                                |
| `lib/services.ts`                    | For every Nest app: task definition, service (Service Connect, circuit breaker, ECS Exec), scaling target, task role, log group                                                             |
| `lib/jobs.ts`                        | Scheduled jobs — designed, built when the first job lands in `apps/*`                                                                                                                       |
| `lib/images.ts`                      | Image tag per app (SSM `/bf/prod/images/<app>`, fallback `:prod`); `NEXT_PUBLIC_*` for the static builds                                                                                    |
| `lib/github-stack.ts`                | Stack `bf-github`: OIDC trust, the four `bf-gha-*` roles, the `bf-cfn-exec` policy, snapshot bucket + key                                                                                   |
| `lib/prod-stack.ts`, `apps-stack.ts` | `bf-prod` = network + secrets + data + cluster + ingress; `bf-prod-apps` = services (+ jobs)                                                                                                |
| `scripts/*.ts`                       | bootstrap, set-secrets, push-images, static-deploy, ecs-migrate, ecs-deploy, release, services, exec, smoke, plan, db-\*                                                                    |

`cdk diff` shows what a deploy would change and `cdk deploy` only touches resources whose definition changed. The
generated CloudFormation is always inspectable: `pnpm --filter @bf/infra-aws cdk synth bf-prod-apps`.

## How the apps run

Adding a service is still "add a folder under `apps/`": `scripts/apps.mjs` discovers it, `lib/apps.ts` derives its
port, dependencies (`<NAME>_URL` keys), secrets (`SECRET_KEYS ∩ .env.example`) and environment, CDK emits the task
definition and service, CI builds and releases it. Only deviations go into `appOverrides` (`lib/apps.ts`).

| App                    | Port | Reachable                                | Gets                                                                     |
| ---------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `api`                  | 3000 | ALB ← CloudFront `/api/*`, **always on** | JWT public key, `UPSTREAMS`, orchestrator settings, `TRUST_PROXY_HOPS=2` |
| `auth`                 | 3001 | Service Connect only                     | DB `auth`, JWT **private** + public key                                  |
| `order`                | 3002 | Service Connect only                     | DB `order`, S3 bucket (task role), `AUTH_URL`                            |
| `course`               | 3003 | Service Connect only                     | DB `course`                                                              |
| `billing`              | 3004 | Service Connect only                     | DB `billing`, `ORDER_URL`                                                |
| `admin`                | 3005 | Service Connect only                     | DB `admin`, all `*_URL`s                                                 |
| `ai`                   | 3006 | Service Connect only                     | OpenAI key (no DB)                                                       |
| `fe-main` / `fe-admin` | –    | CloudFront `/` and `/admin/*` from S3    | `NEXT_PUBLIC_*` inlined at build time (`lib/images.ts`)                  |

Every task: Fargate ARM64, **0.5 vCPU / 1 GB** (the Service Connect proxy needs ~0.25 vCPU / 64 MiB of it), public
subnet + public IP for outbound traffic, security group `bf-prod-tasks` (inbound only from the ALB on 3000 and from
other tasks), container health check on `/health/live`, logs in CloudWatch `/bf/prod/apps/<app>` (stream
`<app>/<app>/<task id>`; the proxy under `sc/`), ECS Exec enabled. Service-to-service calls stay `http://auth:3001`:
Service Connect registers each service under its app name.

One Aurora cluster, one database per app (`POSTGRES_DB=<app>`), created by the migration task if missing, master user
`bf`. Secrets reach a container as task-definition `secrets:` (never in CloudFormation or logs).

### Scale to zero

- **Aurora** pauses only when no connection is open: `DB_POOL_MIN=0`, nothing probes `/health/ready` (it runs
  `select 1`), logical replication is off. The first connection after a pause waits ~15 s (`DB_CONNECT_TIMEOUT_MS=30000`).
- **Services** sleep (0 tasks) after `cooldownS` (default 3 h, `config.ecs` / `appOverrides` / tag `bf:cooldown`)
  without a request, unless an awake service depends on them (`admin` → `auth order course billing ai`, `billing` →
  `order`, `order` → `auth`). The orchestrator inside `api` wakes a service (and its dependencies) on the first
  request: it raises the scaling target to `1…max`, sets `desiredCount 1`, holds the request up to 50 s until the task
  is running and `/health/live` answers, else `503` + `Retry-After: 10` (`@bf/trpc` clients retry). A one-minute sweep
  in every `api` task puts idle services back to sleep. State = the ECS service itself (`desiredCount`, tags
  `bf:last-activity` / `bf:cooldown`); no database, no table. A service whose task never starts within 3 min is put
  back to sleep with a `wake_failed` log event (CloudWatch alarm).
- `/<svc>/health/*` never wakes a service (503 `SERVICE_ASLEEP` while it sleeps); the smoke test only hits the edge.
- `alwaysOn` (`config.ecs`, default `['api']`) services keep a minimum of 1 task.

Runtime knobs, from a laptop or through the edge (`/api/_services`, role `admin`):

```bash
pnpm aws:services                          # who is awake, since when, bounds, cooldown, revision
pnpm aws:services wake order               # start now        pnpm aws:services sleep order
pnpm aws:services cooldown order 1800      # tag bf:cooldown  (0 = back to the default)
pnpm aws:services bounds order 1 2         # scaling bounds while awake
pnpm aws:services redeploy order           # restart its tasks with the current revision
pnpm aws:exec order                        # shell inside a running task (needs aws cli + session-manager-plugin)
```

What is not changed at runtime on purpose: env, secrets, cpu/memory, images — those are a commit (`lib/apps.ts`,
`lib/config.ts`) or a release, so git stays the source of truth.

## Database access from your laptop

```bash
pnpm db:allow-me                    # opens 5432 for your CURRENT public IP only (replaces the previous one)
pnpm -s db:url order                # in a terminal: both strings, labelled
pnpm -s db:url order --pg           # postgresql://bf:<password>@db.malinina.ca:5432/order?sslmode=require
pnpm -s db:url order --jdbc         # jdbc:postgresql://db.malinina.ca:5432/order?user=bf&password=<password>&sslmode=require
psql "$(pnpm -s db:url order)"      # captured by $(…) it prints only the --pg form
pnpm db:allow-me --revoke           # close it again
```

`db.malinina.ca` is a CNAME, so the certificate name does not match it: `sslmode=require` works (psql, GUI clients);
tools that verify the hostname (Node `pg`, `drizzle-kit`) need the AWS endpoint — `pnpm -s db:url order --native`.

Rotate the database password (new random value → Aurora → Secrets Manager → services redeployed):

```bash
pnpm db:rotate-password                  # asks first; --yes skips the prompt
pnpm db:rotate-password --restart-only   # only the redeploy step, if it failed after the password had changed
```

The new value is stored as `AWSPENDING` and promoted to `AWSCURRENT` only after Aurora accepted it. Sleeping services
read the new value when they wake.

## One-time AWS setup (from your laptop, admin credentials)

```bash
aws sso login                                     # or aws configure — an admin in the target account
node infra/aws/scripts/bootstrap.ts <owner>/<repo>
```

It runs `cdk bootstrap`, deploys the stack `bf-github` (OIDC provider, roles `bf-gha-plan|infra|app|snapshot`, the
`bf-cfn-exec` policy, export role/KMS key, snapshot bucket) and then restricts what CloudFormation may do to that
policy. Re-run it after every change to `lib/github-stack.ts` (GitHub never deploys that stack). Then in GitHub:

1. Settings → Secrets and variables → Actions → **Variables**: `AWS_ACCOUNT_ID` (printed by the script). Not a secret.
2. Settings → Environments → `prod` and `prod-approval` (+ required reviewers) — `node scripts/ci/repo-settings.ts --apply`.
3. Branch protection on `main`: require `ci ok`.

## Bringing the platform up from nothing

```bash
node infra/aws/scripts/bootstrap.ts <owner>/<repo>                    # 1  once (above)
pnpm --filter @bf/infra-aws exec cdk deploy bf-prod --require-approval never
                                                                      # 2  VPC, SGs, secrets, Aurora, buckets, cluster, ALB,
                                                                      #    CloudFront, certificate, DNS            (~15–20 min)
OPENAI_API_KEY=sk-… node infra/aws/scripts/set-secrets.ts            # 3  real JWT pair + OpenAI key
node infra/aws/scripts/push-images.ts $(git rev-parse --short HEAD)   # 4  ECR repos + arm64 images for every Nest app
node infra/aws/scripts/static-deploy.ts                               # 5  both frontends → S3 (+ invalidation)
BF_IMAGE_TAG=$(git rev-parse --short HEAD) pnpm aws:deploy:apps       # 6  bf-prod-apps: task definitions, services, scaling
node infra/aws/scripts/ecs-migrate.ts --tag $(git rev-parse --short HEAD)   # 7  databases + migrations (one-off tasks)
node infra/aws/scripts/smoke.ts --deep                                # 8  https://malinina.ca answers
pnpm db:allow-me && pnpm -s db:url                                    #    your own access to Postgres
```

Why two stacks: `bf-prod-apps` creates services that start at once, so images and secrets have to exist first. The
services start with 1 task each; the sweep puts the idle ones to sleep after the cooldown (`pnpm aws:services sleep <app>`
does it now). After step 8, merging to `main` does 4–8 by itself.

## Day-to-day commands

| What                                | Command                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Preview infra changes (both stacks) | `pnpm aws:diff` (Markdown: `node infra/aws/scripts/plan.ts`)                  |
| Apply infra changes                 | `pnpm aws:deploy` (`pnpm aws:deploy:apps` for the services only)              |
| Build + push images                 | `node infra/aws/scripts/push-images.ts <tag> [app …]`                         |
| Release one or more services        | `pnpm aws:release --tag <tag> [app …]` (= `ecs-migrate.ts` + `ecs-deploy.ts`) |
| Roll back a service                 | `node infra/aws/scripts/ecs-deploy.ts --tag <previous sha> <app>`             |
| Release the frontends               | `pnpm aws:static [app …]`                                                     |
| Who is awake / wake / sleep / knobs | `pnpm aws:services …` (above)                                                 |
| Shell into a running task           | `pnpm aws:exec <app>`                                                         |
| Rotate secrets                      | `node infra/aws/scripts/set-secrets.ts [--rotate-jwt]` (redeploys the users)  |
| Snapshot the DB                     | `node infra/aws/scripts/db-snapshot.ts manual`                                |
| Logs                                | CloudWatch `/bf/prod/apps/<app>`                                              |

A release registers task-definition revision N+1 (= the current one with the new image), calls `UpdateService` and waits
for stability. Awake services roll (new task healthy → old one drains; the **deployment circuit breaker rolls back** when
a task never becomes healthy). Sleeping services only record the revision and start it on their next wake. The sha is
written to SSM `/bf/prod/images/<app>`, which `cdk synth` reads, so an infra deploy never reverts an image.
Migrations run first as one-off Fargate tasks (family `bf-prod-<app>-migrate`, same image/env/secrets, command
`node node_modules/@bf/db/dist/cli/migrate.js`: `CREATE DATABASE` if missing, then `drizzle-kit migrate`). Migrations
are not rolled back with the images, so keep them backwards compatible (expand, then contract).

## Delivery (GitHub Actions) — least privilege

No AWS keys in GitHub: workflows get short-lived credentials by OIDC, **one role per concern** (`lib/github-stack.ts`).

| Job (in `pipeline.yml`)           | Runs on                          | Role (what it may do)                                                                                            | What                                                                                                                  |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| CI jobs, `plan-release`, `report` | PR, push `main`                  | none                                                                                                             | checks per affected app; sticky PR comments: release plan, test report                                                |
| `plan-infra`                      | PR touching `infra/aws`          | `bf-gha-plan` — read-only (+ `ssm:GetParameters` on the image tags)                                              | sticky PR comment: `cdk diff`; fails on a destroyed stateful resource unless the PR has the label `allow-destructive` |
| `approve`                         | push `main`; dispatch            | none (environment `prod-approval`, required reviewer)                                                            | one approval per run before anything touches AWS                                                                      |
| `infra`                           | `infra/aws` changed; dispatch    | `bf-gha-infra` — may only assume the CDK deploy roles (CFN = `bf-cfn-exec`)                                      | `cdk deploy bf-prod bf-prod-apps`                                                                                     |
| `images`, `static`, `release`     | push `main`; dispatch (apps=…)   | `bf-gha-app` — ECR push, S3 on the static buckets + invalidation, ECS task defs/services/RunTask, SSM image tags | build+push → static exports → `ecs-migrate.ts` → `ecs-deploy.ts`                                                      |
| `smoke`                           | after `release` / `static`       | none                                                                                                             | `smoke.ts`: the public URLs answer, legacy hostnames redirect                                                         |
| `db-snapshot.yml` (`snapshot`)    | called by the pipeline; dispatch | `bf-gha-snapshot` — cluster snapshot + export, nothing else                                                      | Aurora snapshot + Parquet export to S3; keeps the last 10; once per run                                               |

Workflow steps are one-line calls of the same scripts (`scripts/ci/*.ts`, `infra/aws/scripts/*.ts`), so anything CI
does can be reproduced locally. `bf-prod` / `bf-prod-apps` only change with `lib/`, `bin/`, `cdk.json`, `package.json`.

### Restoring from a pre-release snapshot

Snapshots are named `bf-prod-pre-<label>-<utc timestamp>`. Restore creates a **new** cluster
(`aws rds restore-db-cluster-from-snapshot --snapshot-identifier … --db-cluster-identifier bf-prod-restored …` plus a
`db.serverless` instance); copy the data back or point the stack at it. The S3 export is a Parquet archive for
inspection, not a restore source.

## Things to know

- **Cross-stack references**: `bf-prod-apps` imports the VPC, security group, cluster, namespace, target group and bucket
  from `bf-prod` as CloudFormation exports. Replacing one of those resources needs two deploys (keep the old export
  with `exportValue`, deploy, move the apps, remove it).
- **Service Connect sees services that existed when a task started**: after `cdk deploy bf-prod-apps` added a new
  service, `pnpm aws:services redeploy api` (or the next release of `api`) makes the edge aware of it.
- **CloudFront has no custom error pages** (they would also rewrite `/api/*` error bodies); the static origins answer
  `404.html` through the viewer function.
- **First request of the day** to a sleeping service takes 30–60 s (Fargate pull + boot + Aurora resume). Making a
  service always-on: `appOverrides` or `config.ecs.alwaysOn`.
- **`pl-3b927c52`** (`config.cloudfront.originPrefixListId`) is the us-east-1 id of the CloudFront origin-facing prefix list.
- **Adding a job**: `lib/jobs.ts` (EventBridge Scheduler → Step Functions with a timeout → `RunTask`), when the first
  job app exists.

## Cost notes (us-east-1, approximate, ~730 h/month)

`api` 0.5 vCPU / 1 GB ARM always on ≈ $14.4, its public IPv4 ≈ $3.65, ALB ≈ $16.4 + LCU, CloudFront/S3/functions
within the free tier, Aurora $0.12 per ACU-hour and **$0 while paused** (≈ $15 at 8 h/day awake, ≈ $44 if it never
sleeps), each awake internal task ≈ $0.025/h incl. IP (6 services × 10 h/day ≈ $45/month, 3 h/day ≈ $14),
secrets/logs/Route 53/ECR ≈ $5 → **≈ $40 fixed, ≈ $65–120/month in practice**. Levers, in order: keep `alwaysOn`
short, cooldown ≤ 3 h, FARGATE_SPOT for internal services, and — if $16/month matters — an API Gateway HTTP API
instead of the ALB.
