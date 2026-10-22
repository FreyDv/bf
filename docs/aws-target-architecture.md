# bf on AWS — the final picture

What the platform looks like **after** the move to ECS Fargate. No history, no diff: this is the state the code and
the account end up in. The migration order is in `aws-fargate-migration.md`; this file becomes `infra/aws/README.md`.

## 1. One page

```
                 https://malinina.ca/            https://malinina.ca/admin/        https://malinina.ca/api/<svc>/…
                        │                               │                                  │
Route 53 ───────────────┴───────────────────────────────┴──────────────────────────────────┘
 malinina.ca, www., admin., api.  →  A/AAAA alias  →  CloudFront distribution "bf-prod"  (ACM: malinina.ca + *.malinina.ca)
                                                        │ response-headers policy: nosniff, X-Frame DENY, referrer, permissions
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
   │        │ state = ECS counts + tags                                                                                             │
   │        │ ecs:UpdateService · application-autoscaling:RegisterScalableTarget · ecs:DescribeServices                             │
   │   jobs (when they exist): EventBridge Scheduler → Step Functions (timeout) → RunTask                                           │
   └──────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                  │ 5432, SG bf-prod-db ← SG bf-prod-tasks (+ your IP via `pnpm db:allow-me`)       outbound (OpenAI, S3, ECR,
                  ▼                                                                                   logs, secrets): public IP, no NAT
        Aurora Serverless v2 Postgres bf-prod, 0–4 ACU, auto-pause 10 min, db.malinina.ca
        S3 bf-prod-<acct>-api (app files)      Secrets Manager bf/prod/*      SSM /bf/prod/images/<app>      ECR bf-prod/<app>
```

Always running: CloudFront, ALB, `api`. Everything else exists as a definition and costs nothing until used.

## 2. Local development (unchanged in spirit)

| Mode                 | Command                       | What runs                                                                                                                                                        |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| everything in Docker | `pnpm stack:up`               | root `docker-compose.yml`: postgres, redis, minio, `migrate`, 7 Nest services, `fe-main` + `fe-admin` as **nginx serving the static export** (ports 4000 / 4001) |
| apps on the host     | `pnpm infra:core && pnpm dev` | postgres/minio/otel in Docker, Nest + `next dev` on the host                                                                                                     |

- `api` runs with `ORCHESTRATOR=none`: it proxies `/<svc>/*` to `UPSTREAMS` exactly as today; no AWS SDK calls, no
  sleeping services locally.
- Frontends call `NEXT_PUBLIC_API_URL` + `/<svc>/trpc/…`: locally `http://localhost:3000`, in prod
  `https://malinina.ca/api` (CloudFront strips `/api`, so the edge sees the same paths in both places).
- `fe-admin` lives under `basePath: '/admin'` everywhere: `http://localhost:4001/admin/` locally.
- The same images that go to AWS are built by the same two Dockerfiles; `docker compose config -q` is a CI check.
- Nothing in local dev knows about ECS. The AWS-only pieces are `infra/aws/*`, the `orchestrator` module (off), and
  the CloudFront Function (prod only).

## 3. Repository layout (the AWS part)

```
infra/aws/
  bin/app.ts               three stacks: bf-github (once, from a laptop), bf-prod (platform), bf-prod-apps (services)
  lib/config.ts            region, domains, hosted zone, DB sizes, ECS defaults, names — the one place to edit
  lib/apps.ts              per-app overrides only: cpu/memory, maxTasks, alwaysOn, cooldownS (everything else is derived)
  lib/network.ts           VPC 10.42.0.0/16, 2 public subnets, SGs: alb, tasks, db, db-dev
  lib/secrets.ts           Secrets Manager: POSTGRES_PASSWORD (generated), JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, OPENAI_API_KEY
  lib/data.ts              Aurora Serverless v2 + app bucket + db.malinina.ca
  lib/cluster.ts           ECS cluster, Service Connect namespace, log group, execution role
  lib/ingress.ts           ACM certificate, ALB + listener rule, two static buckets + OAC, CloudFront, functions, DNS records
  lib/services.ts          for every Nest app from scripts/apps.mjs: task definition + service + auto scaling + task role
  lib/jobs.ts              for every job app: task definition + schedule + Step Functions timeout wrapper
  lib/images.ts            docker build args; image tag per app (SSM /bf/prod/images/<app>, fallback :prod)
  lib/github-stack.ts      OIDC trust, roles bf-gha-plan|infra|app|snapshot, bf-cfn-exec policy, snapshot bucket + key
  lib/prod-stack.ts        bf-prod  = network + secrets + data + cluster + ingress
  lib/apps-stack.ts        bf-prod-apps = services + jobs (imports the platform by name/export)
  scripts/
    bootstrap.ts           cdk bootstrap + deploy bf-github + restrict CloudFormation to bf-cfn-exec     (laptop, once)
    set-secrets.ts         write JWT pair / OpenAI key → Secrets Manager, then force a new deployment    (laptop)
    push-images.ts         build arm64 images locally → ECR :sha + :prod, write SSM tag                   (laptop; CI does the same with buildx)
    static-deploy.ts       next build (export) → s3 sync → CloudFront invalidation                        (laptop + CI)
    ecs-migrate.ts         RunTask per DB app: ensure database + drizzle-kit migrate, wait, exit code      (laptop + CI)
    ecs-deploy.ts          register task definition revision with the new image → UpdateService → wait    (laptop + CI)
    services.ts            list states; wake / sleep / cooldown <app> <seconds>  (through the api admin endpoint)
    exec.ts                shell into a running task (ECS Exec) — replaces `aws ssm start-session`
    smoke.ts               GET /, /admin/, /api/auth/health/live
    db-allow-me.ts db-url.ts db-rotate-password.ts db-snapshot.ts plan.ts gh-env.ts build-args.ts   (as today)
```

Root `package.json`: `aws:diff`, `aws:deploy` (both prod stacks), `aws:release` (= migrate + deploy for the apps you
name), `aws:static`, `aws:services`, `aws:exec`, `db:*` as today. No shell scripts anywhere; every step is `node x.ts`.

## 4. Bringing the account up from nothing

```bash
aws sso login
node infra/aws/scripts/bootstrap.ts FreyDv/bf                    # 1  cdk bootstrap, stack bf-github (roles, buckets, policy)
pnpm aws:deploy                                                  # 2  bf-prod: VPC, SGs, secrets, Aurora, buckets, cluster, ALB,
                                                                 #    CloudFront, certificate, DNS            (~15 min)
OPENAI_API_KEY=sk-… node infra/aws/scripts/set-secrets.ts        # 3  real JWT pair + OpenAI key
node infra/aws/scripts/push-images.ts $(git rev-parse --short HEAD)   # 4  ECR repos + images for every Nest app
node infra/aws/scripts/static-deploy.ts                          # 5  both frontends → S3
pnpm aws:deploy:apps                                             # 6  bf-prod-apps: task definitions, services (api = 1 task,
                                                                 #    the rest = 0), scaling targets
node infra/aws/scripts/ecs-migrate.ts                            # 7  databases + migrations (one-off Fargate tasks)
node infra/aws/scripts/smoke.ts                                  # 8  https://malinina.ca answers
```

Why two stacks: `bf-prod-apps` creates an `api` service that must start, so secrets and images have to exist first.
After step 8, merging to `main` does 4–8 by itself. `cdk diff` on a PR shows both stacks.

## 5. Identity (IAM)

| Role / policy          | Assumed by                 | May do                                                                                                                                                                                                |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bf-gha-plan`          | GitHub, `pull_request`     | read-only: `cdk diff`                                                                                                                                                                                 |
| `bf-gha-infra`         | GitHub, environment `prod` | assume the CDK deploy roles → CloudFormation acts with `bf-cfn-exec`                                                                                                                                  |
| `bf-gha-app`           | GitHub, environment `prod` | ECR push, `ssm:PutParameter /bf/prod/images/*`, `ecs:RegisterTaskDefinition/UpdateService/RunTask/Describe*`, `iam:PassRole bf-prod-*`, S3 on the two static buckets, `cloudfront:CreateInvalidation` |
| `bf-gha-snapshot`      | GitHub, environment `prod` | Aurora snapshot + export (unchanged)                                                                                                                                                                  |
| `bf-cfn-exec` (policy) | CloudFormation             | what a deploy may create: ec2, rds, ecs, elasticloadbalancing, cloudfront, acm, servicediscovery, application-autoscaling, logs, scheduler, states; IAM only on `bf-prod-*` names                     |
| `bf-prod-exec`         | ECS agent (execution role) | pull `bf-prod/*` from ECR, read `bf/prod/*` secrets, write `/bf/prod/apps` logs — same for every task                                                                                                 |
| `bf-prod-task-api`     | the `api` container        | `ecs:DescribeServices/UpdateService` on `bf-prod` services, `application-autoscaling:*ScalableTarget*` on them, `ecs:TagResource/ListTagsForResource` on them, ECS Exec channel                       |
| `bf-prod-task-order`   | the `order` container      | the app bucket (put/get/delete/list)                                                                                                                                                                  |
| `bf-prod-task-<other>` | each other container       | nothing but the ECS Exec channel                                                                                                                                                                      |

No long-lived keys anywhere: GitHub uses OIDC, containers use task roles, laptops use SSO.

## 6. Network

VPC `bf-prod` `10.42.0.0/16`, two **public** subnets (`us-east-1a`, `us-east-1b`), internet gateway, **no NAT,
no private subnets, no VPC endpoints**. Every task gets a public IP for _outbound_ traffic; inbound is decided entirely
by security groups:

| Security group   | Attached to        | Inbound                                                                                         | Outbound |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------- | -------- |
| `bf-prod-alb`    | the ALB            | 443 from the managed prefix list `com.amazonaws.global.cloudfront.origin-facing`                | all      |
| `bf-prod-tasks`  | every Fargate task | `api` port 3000 from `bf-prod-alb`; **all TCP from `bf-prod-tasks` itself** (service ↔ service) | all      |
| `bf-prod-db`     | Aurora             | 5432 from `bf-prod-tasks`                                                                       | none     |
| `bf-prod-db-dev` | Aurora             | empty in code; `pnpm db:allow-me` adds your IP                                                  | none     |

So a service task has a public IP but nothing on the internet can open a connection to it: the only rule that admits
traffic to port 3001–3006 is "from another task". The ALB is reachable only by CloudFront, and CloudFront only talks
to it with the `X-Origin-Verify` header that the listener rule checks.

Service-to-service calls stay `http://auth:3001`: ECS Service Connect registers each service under its app name in the
`bf-prod.local` namespace, and a small proxy in every task routes, retries and load-balances. Nothing in app code or
env changes compared to compose.

## 7. Public entry

| Hostname                      | Serves                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `malinina.ca`, `www.`         | `/` → fe-main from S3; `/admin/*` → fe-admin from S3; `/api/*` → ALB → `api` |
| `admin.malinina.ca`           | 301 → `https://malinina.ca/admin/` (CloudFront Function)                     |
| `api.malinina.ca`             | 301 → `https://malinina.ca/api/…`                                            |
| `db.malinina.ca`              | CNAME to Aurora (laptop access only)                                         |
| `bf-prod-….elb.amazonaws.com` | the ALB; answers only CloudFront                                             |

Certificate: one ACM certificate `malinina.ca` + `*.malinina.ca`, DNS-validated in the hosted zone, used by both
CloudFront and the ALB (both in `us-east-1`). Renewal is automatic. Let's Encrypt and Caddy are gone.

CloudFront behaviours: static ones cache (`_next/static/*` immutable, HTML short), `/api/*` has caching disabled and
forwards every header, cookie and query string. Origin read timeout 60 s so a cold start can be held.

## 8. Configuration and secrets

Three kinds of values, three places:

| Kind               | Where                                                       | Reaches the container as                                              |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| secret             | Secrets Manager `bf/prod/<KEY>`                             | task definition `secrets:` → env var, never in CloudFormation or logs |
| non-secret, static | `lib/config.ts` + `lib/apps.ts` (git)                       | task definition `environment:`                                        |
| runtime knobs      | tags on the ECS service (`bf:last-activity`, `bf:cooldown`) | read by the orchestrator in `api`                                     |

There is no `.env` file on any machine. Rotating a secret: `set-secrets.ts` (or `db-rotate-password.ts`) writes the
new value and forces a new deployment of the services that use it; sleeping services pick it up on wake.

## 9. ECS: how a task is described

Every Nest app becomes one **task definition family** `bf-prod-<app>` and one **service** `bf-prod-<app>`. CDK
generates them in `lib/services.ts` from three inputs, so adding a service is still "add a folder":

1. `scripts/apps.mjs` — the app exists, its kind, whether it has migrations, and (new) its `PORT`, the `<NAME>_URL`
   keys it declares (→ dependency graph), and which secret keys its `.env.example` mentions.
2. `lib/config.ts` — defaults: `cpu 256`, `memory 512`, `maxTasks 4`, `cooldownS 10800`, `alwaysOn: ['api']`, `cpuTarget 60`.
3. `lib/apps.ts` — per-app overrides, only where needed:

```ts
export const appOverrides: Partial<Record<string, AppOverride>> = {
  api: { alwaysOn: true, minTasks: 1, maxTasks: 4 },
  auth: { cooldownS: 6 * 3600 }, // example: keep identity warm longer
  ai: { memory: 1024 }, // example: bigger heap for the LLM facade
};
```

What CDK emits for `order` (abridged, this is what `aws ecs describe-task-definition` shows):

```jsonc
{
  "family": "bf-prod-order",
  "requiresCompatibilities": ["FARGATE"],
  "runtimePlatform": { "cpuArchitecture": "ARM64" },
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "…:role/bf-prod-exec",
  "taskRoleArn": "…:role/bf-prod-task-order",
  "containerDefinitions": [
    {
      "name": "order",
      "image": "<acct>.dkr.ecr.us-east-1.amazonaws.com/bf-prod/order:<sha>",
      "portMappings": [{ "name": "http", "containerPort": 3002 }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3002" },
        { "name": "SERVICE_NAME", "value": "order" },
        { "name": "POSTGRES_DB", "value": "order" },
        { "name": "POSTGRES_HOST", "value": "bf-prod.cluster-….rds.amazonaws.com" },
        { "name": "DB_POOL_MIN", "value": "0" },
        { "name": "DB_CONNECT_TIMEOUT_MS", "value": "30000" },
        { "name": "AUTH_URL", "value": "http://auth:3001" },
        { "name": "S3_REGION", "value": "us-east-1" },
        { "name": "S3_BUCKET", "value": "bf-prod-<acct>-api" },
        { "name": "NODE_EXTRA_CA_CERTS", "value": "/etc/ssl/rds-ca.pem" },
      ],
      "secrets": [
        { "name": "POSTGRES_PASSWORD", "valueFrom": "arn:…:secret:bf/prod/POSTGRES_PASSWORD" },
        { "name": "JWT_PUBLIC_KEY", "valueFrom": "arn:…:secret:bf/prod/JWT_PUBLIC_KEY" },
      ],
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "node -e \"fetch('http://127.0.0.1:3002/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))\"",
        ],
        "interval": 10,
        "timeout": 5,
        "retries": 6,
        "startPeriod": 30,
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": { "awslogs-group": "/bf/prod/apps", "awslogs-stream-prefix": "order" },
      },
      "stopTimeout": 30,
    },
  ],
}
```

The service around it: launch type Fargate, subnets = the two public ones, `assignPublicIp: ENABLED`,
security group `bf-prod-tasks`, Service Connect client+server on port `http` as `order`, deployment circuit breaker
with rollback, `enableExecuteCommand`, `desiredCount 0` (or 1 when `alwaysOn`). Plus an Application Auto Scaling
target `min 0 / max 4` with a CPU-60 % target-tracking policy.

The `migrate` one-off uses the **same task definition** with a command override (`npx drizzle-kit migrate`), so the
image that migrates is the image that runs.

## 10. Runtime control from `api` (AWS SDK)

Yes — the `api` task role allows it, and the orchestrator module is the only code that uses the SDK. What is meant to
be changed on the fly, and from where:

| Knob                          | How                                                                                | Persisted in                                         |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| wake a service                | request arrives, or `POST /api/_services/<app>/wake`                               | ECS `desiredCount`                                   |
| put a service to sleep now    | `POST /api/_services/<app>/sleep`                                                  | ECS `desiredCount`                                   |
| idle lifetime (cooldown)      | `POST /api/_services/<app>/cooldown { seconds }` — or the default in `lib/apps.ts` | service tag `bf:cooldown` (override) / git (default) |
| scale bounds while awake      | `POST /api/_services/<app>/bounds { min, max }` → `RegisterScalableTarget`         | ECS scalable target                                  |
| force a redeploy (same image) | `POST /api/_services/<app>/redeploy` → `UpdateService(forceNewDeployment)`         | —                                                    |
| see everything                | `GET /api/_services` → state, running/desired, last activity, cooldown, revision   | —                                                    |

All of these need the `admin` role at the edge; `node infra/aws/scripts/services.ts` is the CLI for the same calls.
Mechanics: every request to `/<app>/*` records activity (tag `bf:last-activity` on the service, one write per app per 30 s at most) and wakes the app
and its dependencies if asleep (hold ≤ 50 s, then 503 + `Retry-After: 10`). A one-minute sweep in every `api` task
puts to sleep any awake service whose `now − lastActivity > cooldown` and that no awake service depends on.
Both calls are idempotent, so several `api` tasks doing the same thing is harmless; a request landing on a service
that is being stopped simply wakes it again. No database, no table: the ECS service is the only record.

What is **not** changed from `api` on purpose: environment variables, secrets, cpu/memory, images. Those are a task
definition revision, i.e. a commit (`lib/apps.ts`, `lib/config.ts`) or a release. Technically possible with the same
SDK; left out so that `git` stays the source of truth for what runs.

Lifetime of a scheduled job (when they exist): `timeoutS` in `lib/jobs.ts` → Step Functions `TimeoutSeconds` stops
the task; the task may also set its own shorter limit.

## 11. CI/CD

```
pull_request ──► discover ─┬─ format · packages · infra-check (tsc, eslint, cdk synth both stacks) · env-drift · contracts-drift
                           ├─ per app: static · unit · migrations · e2e · image (nest: docker build, push:false) / export (next: next build)
                           ├─ plan-release · plan-infra (cdk diff → PR comment) · report
                           └─► ci ok  (the one required check)

push main    ──► ci ok ──► approve (environment prod-approval, one click)
                            └─► snapshot (Aurora) ──► infra (cdk deploy bf-prod + bf-prod-apps, only when infra/aws changed)
                                                  ├─► images  (matrix: changed nest/job apps)   buildx arm64 → ECR :sha + :prod → SSM /bf/prod/images/<app>=<sha>
                                                  └─► static  (matrix: changed next apps)       next build → s3 sync → invalidation
                                                  ──► release  node infra/aws/scripts/ecs-migrate.ts <apps>   (RunTask per DB app, waits)
                                                               node infra/aws/scripts/ecs-deploy.ts  <apps>   (revision + UpdateService, waits for stability)
                                                  ──► smoke
```

- **Build**: `docker/build-push-action` on `ubuntu-24.04-arm`, `docker/nest.Dockerfile` with `APP=<app>`, GHA layer
  cache per app. Same Dockerfile as `pnpm stack:up`. Frontends are not images in prod: `next build` produces `out/`,
  which goes to S3.
- **Store**: ECR `bf-prod/<app>`, tags `<git sha>` (immutable record) and `prod` (floating "latest release"), scan on
  push, untagged images expire after 7 days. `ecs-deploy.ts` writes the sha to SSM `/bf/prod/images/<app>`.
- **Pick-up**: `ecs-deploy.ts` reads the service's current task definition, replaces the image with `:<sha>`, registers
  revision N+1 and calls `UpdateService(taskDefinition: N+1)`.
  - awake service → ECS rolling deployment: new task starts, passes `/health/live`, old one drains; circuit breaker
    rolls back to N if it never becomes healthy.
  - sleeping service (`desiredCount 0`) → the deployment completes instantly; the next wake starts revision N+1.
  - `cdk deploy bf-prod-apps` later synthesises with the same SSM tag, so infra deploys never revert an image.
- **Rollback**: `node infra/aws/scripts/ecs-deploy.ts --tag <previous sha> <app>`; migrations stay expand-then-contract.
- **Secrets, DB access, snapshots**: as today (`set-secrets.ts`, `db-allow-me`, `db-snapshot.yml`).

## 12. Day-2 cheat sheet

| What                            | Command                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| what would an infra change do   | `pnpm aws:diff`                                                               |
| apply infra                     | `pnpm aws:deploy`                                                             |
| release one app from a laptop   | `node infra/aws/scripts/push-images.ts <tag> order && pnpm aws:release order` |
| release the frontends           | `pnpm aws:static`                                                             |
| who is awake, since when        | `pnpm aws:services`                                                           |
| change idle lifetime of `order` | `pnpm aws:services cooldown order 1800`                                       |
| wake / sleep by hand            | `pnpm aws:services wake order` / `sleep order`                                |
| shell into a running task       | `pnpm aws:exec order`                                                         |
| logs                            | CloudWatch `/bf/prod/apps`, stream prefix `<app>/`                            |
| DB from the laptop              | `pnpm db:allow-me && pnpm -s db:url order`                                    |
| rotate the DB password          | `pnpm db:rotate-password`                                                     |
