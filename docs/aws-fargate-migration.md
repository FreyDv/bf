# AWS migration: EC2 + compose + Caddy → ECS Fargate + CloudFront + S3

Status: **implemented in the repo (branch `feat/aws-fargate`, 2026-10-21), cutover pending** — run §5 "Ship it". Mode: big-bang cutover, see §5. The end state is described in `aws-target-architecture.md` and, as deployed, in `infra/aws/README.md`. ADR #23 records it (supersedes #22).

Deviations from this plan taken during implementation: tasks are **0.5 vCPU / 1 GB** (the Service Connect proxy needs ~0.25 vCPU / 64 MiB; §2.11 assumed 0.25 vCPU), log groups are per app (`/bf/prod/apps/<app>`), `desiredCount` is omitted from the templates (always-on = scaling-target minimum, so `cdk deploy` never resets an awake service), the migration one-off is its own task family `bf-prod-<app>-migrate`, and `services.ts` talks to AWS directly instead of the admin endpoint.
Input: the "AWS ECS Fargate — Infrastructure Concept v1.1" note. This document checks that concept against the
repository as it is, fixes what does not fit, and lays out a one-shot cutover (§5).

## 1. Where we are

| Thing             | Today                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apps              | **7** Nest services (`api` edge + `auth order course billing admin ai`), **2** Next.js apps (`fe-main`, `fe-admin`). **0** scheduled jobs.                                        |
| Discovery         | `scripts/apps.mjs` scans `apps/*` (kind nest/next, dockerfile, migrations, e2e…); CI and deploy matrices come from it. No app list anywhere.                                      |
| Images            | `docker/nest.Dockerfile` (ARG APP), `docker/next.Dockerfile` (standalone server), `docker/migrate.Dockerfile`; arm64; pushed to ECR `bf-prod/<app>` as `:sha` + floating `:prod`. |
| Runtime           | one `t4g.medium`, `infra/aws/host/compose.yml` + Caddy (Let's Encrypt), deploys via SSM Run Command (`host-deploy.ts`), rollback by re-tagging `:previous`.                       |
| Data              | Aurora Serverless v2 Postgres, min 0 ACU (auto-pause 10 min), public subnets, one DB per service; app S3 bucket; 4 Secrets Manager entries.                                       |
| Network           | VPC `10.42.0.0/16`, 2 public subnets, **no NAT, no ALB, no private subnets**; SGs only.                                                                                           |
| Edge              | `api` verifies RS256 JWT, strips/re-attaches `X-User-*`, `ROUTE_ROLES`, rate limit, proxies `/<svc>/*` → `UPSTREAMS` (`http://auth:3001`, …).                                     |
| Service → service | `@bf/trpc` clients, base URL from `<NAME>_URL` env (`AUTH_URL`, `ORDER_URL`, …), identity forwarded in headers.                                                                   |
| Health            | `/health/live` (no DB) is the only probe anywhere, on purpose: `/health/ready` runs `select 1` and would keep Aurora awake.                                                       |
| CI/CD             | `pipeline.yml`: PR checks → `ci ok` → approve → DB snapshot → `cdk deploy` ∥ build&push → rollout on host → smoke. Everything in TS scripts.                                      |
| Frontends         | placeholders; `output: 'standalone'`, `next/image fill`, `headers()` in `next.config.ts`, `NEXT_PUBLIC_*` baked at build.                                                         |
| Budget            | $100–150/mo cap; current ≈ $40–85/mo. Fargate + ALB + NAT + RDS was rejected in ADR #22 at ≈ $180.                                                                                |

## 2. Concept vs reality — what changes

The concept is sound; these are the points where it does not match the repo or where a cheaper/simpler
construction exists. Each one is already folded into the design in §3.

1. **"30 internal services" and "6 scheduled images" do not exist yet.** There are 6 internal services and no jobs.
   Everything below is written for _N_ services discovered from `apps/*`, exactly like CI does today, so growing to 30
   is a folder, not an infra change. Cost estimates use what exists.
2. **No NAT gateway, no VPC endpoints.** The concept wants outbound internet for every task. A NAT gateway is ≈ $32/mo
   plus per-GB; interface endpoints for ECR/Logs/Secrets are ≈ $29/mo. Instead: tasks run in the existing **public
   subnets with a public IP** (`assignPublicIp`), inbound closed by security groups. Cost: $0.005/h per *running* task
   (≈ $3.65/mo for the always-on `api`, pennies for services that sleep). This keeps the "no NAT" decision of ADR #22.
3. **Frontend paths.** `/fe/*` for the public site would make the shop's URL `malinina.ca/fe/`. Use the **default
   behaviour (`/`)** for `fe-main`, `/admin/*` for `fe-admin` (Next `basePath: '/admin'`), `/api/*` for the edge.
   One domain, one certificate, no CORS. `admin.malinina.ca` / `api.malinina.ca` go away (or stay as redirects).
4. **`/api/*` prefix.** The edge routes `/<svc>/*` and knows no `/api`. A **CloudFront Function strips `/api`**
   before the ALB, so `apps/api` and the local compose stay untouched.
5. **Static export is a real change to the Next apps**, not just a deploy change: `output: 'export'`,
   `images.unoptimized: true` (`next/image` needs it), `trailingSlash: true`, `basePath` for admin, and `headers()` is
   dead in export mode → the security headers move to a **CloudFront response-headers policy**. No middleware, no route
   handlers, no dynamic routes without `generateStaticParams`. Both apps are placeholders today, so this is cheap now
   and expensive later — do it first.
6. **Scale-to-zero vs CPU auto-scaling conflict.** ECS target tracking with `minCapacity 0` would scale an idle service
   to 0 after ~15 min of low CPU, ignoring the 3 h cooldown; and target tracking can never scale _out_ of 0 (no metric).
   Resolution: the orchestrator owns **only the scalable target's `min`/`max`** (sleep = `0/0`, awake = `1/N`);
   Application Auto Scaling enforces the bounds immediately and target tracking works between them. One knob, no race
   between two controllers.
7. **Internal calls bypass the edge.** `admin → order`, `billing → order`, `order → auth` go service-to-service, so the
   edge never sees that traffic and would let a dependency fall asleep under a running caller. Rule: **activity
   propagates down a static dependency graph** derived from the `*_URL` env of each service (already in config):
   waking `admin` wakes `auth order course billing ai`; a service's idle timer only runs when no dependent is awake.
8. **Shared orchestrator state — no extra store.** `api` scales horizontally, so "last activity" cannot live in
   memory, and it must not live in Postgres either (a one-minute sweep would keep Aurora awake). **ECS itself is the
   state**: `desiredCount`/`runningCount` say who is awake; last activity and the cooldown override are **tags on the
   ECS service** (`bf:last-activity`, `bf:cooldown`). Every `api` task runs the same one-minute sweep. Races are
   harmless: two wakes are the same `UpdateService`; a request landing on a service being stopped wakes it again.
9. **Always-on is a per-service setting, not a special case for `api`.** First login of the day waking `auth` is a
   30–60 s wait; making `auth` always-on costs ≈ $7/mo. Config decides, the code does not know which service is which.
10. **Deployment of a sleeping service needs no running task.** `UpdateService` without `desiredCount` keeps 0; the new
    revision is picked up on the next wake. The concept's flow (register revision → update service) is kept, done by a
    TypeScript script with the AWS SDK, not by `cdk deploy`. To stop a later `cdk deploy` from reverting the image,
    the stack reads the current tag of each app from SSM `/bf/prod/images/<app>` at synth time (fallback `:prod`).
11. **Task size.** 0.5 vCPU / 1 GB is not the Fargate minimum; **0.25 vCPU / 0.5 GB** is, and the Nest skeletons run
    today under a 384 MB compose limit. Start there for every service (and for `api`), scale out by CPU. Halves compute.
12. **Health checks.** ALB target group and container health checks use `/health/live` only — the Aurora pause rule
    from ADR #22 still applies. Readiness of a waking service = `runningCount ≥ 1` + `/health/live` answering
    through Service Connect.
13. **Jobs (future).** EventBridge Scheduler → ECS `RunTask`; the maximum execution time is enforced by a Step Functions
    `ecs:runTask.sync` state with `TimeoutSeconds` (ECS itself has no max runtime). Designed now, built when the first
    job lands in `apps/*`.

Honest cost note: this design is **not cheaper than the current host** at today's size; it is cheaper _at 30 services_
and it removes the single machine, adds autoscaling and independent rollouts. See §5.

## 3. Target architecture

```
Route 53  malinina.ca  A/AAAA alias ─► CloudFront (one distribution, ACM cert apex + *.malinina.ca)
                                           │  response-headers policy (nosniff, DENY, referrer, permissions)
            ┌──────────────────────────────┼──────────────────────────────────┐
            │ /            (default)       │ /admin/*                         │ /api/*  (CachingDisabled)
            ▼                              ▼                                  ▼  CF Function: strip /api
   S3 bf-prod-fe-main (OAC)       S3 bf-prod-fe-admin (OAC)           ALB :443 (SG: CloudFront prefix list only,
   CF Function: /x/ → /x/index.html                                    listener rule: X-Origin-Verify header)
                                                                             │
                                                                             ▼
   ┌─ ECS cluster bf-prod (Fargate, ARM64, public subnets + public IP, SG tasks) ───────────────────────────┐
   │  api        min 1 … max N   ──Service Connect (bf.local)──► auth  order  course  billing  admin  ai     │
   │  (edge + orchestrator)                                       desired 0 ⇄ 1…N, per-service cooldown     │
   │     │ state = ECS counts + service tags bf:last-activity, bf:co                                         │
   │     │ ecs/application-autoscaling: Register/UpdateScalableTarget, DescribeServices                      │
   │  jobs (later): EventBridge Scheduler → Step Functions → RunTask (max runtime)                          │
   └────────────────┬───────────────────────────────────────────────────────────────────────────────────────┘
                    ▼ 5432 from SG tasks (+ your IP via db-allow-me)         outbound: OpenAI, S3, ECR, logs
        Aurora Serverless v2, 0–4 ACU, auto-pause  (unchanged)              via the public IP, no NAT
```

Always-on: CloudFront, ALB, `api` (and whatever `alwaysOn` lists). Everything else is 0 tasks when idle.

### 3.1 Routing

| Path       | Origin                     | Cache                                        | Functions / policies                                                 |
| ---------- | -------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `/`        | S3 `fe-main` via OAC       | CachingOptimized; `_next/static/*` immutable | viewer-request: `/x` or `/x/` → `/x/index.html`; 404 → `/404.html`   |
| `/admin/*` | S3 `fe-admin` via OAC      | same                                         | same; Next `basePath: '/admin'`                                      |
| `/api/*`   | ALB (HTTPS, same ACM cert) | CachingDisabled, AllViewer                   | viewer-request: strip `/api`; origin custom header `X-Origin-Verify` |

CloudFront origin read timeout 60 s (default 30) and ALB idle timeout 60 s, so a cold-start wait can fit.

### 3.2 Services

One construct per Nest app, generated at synth from `apps.mjs` (same discovery CI uses):

- Task definition: Fargate ARM64, 0.25 vCPU / 0.5 GB (config per app), `awslogs` → `/bf/prod/apps/<app>`,
  container healthCheck `node -e fetch(…/health/live)`, `stopTimeout 30`, secrets injected from Secrets Manager
  (`POSTGRES_PASSWORD`, `JWT_*`, `OPENAI_API_KEY` — only the ones the app has today in compose.yml), env identical to
  `host/compose.yml` (`DB_POOL_MIN=0`, `DB_CONNECT_TIMEOUT_MS=30000`, `*_URL=http://<svc>:<port>`, …).
  RDS CA: baked into the image at `/etc/ssl/rds-ca.pem` (one `COPY` from a build-stage `curl`), `NODE_EXTRA_CA_CERTS`.
- Task role per app (today the whole host shares one role): `order` gets the app bucket; `api` gets the orchestrator
  permissions; others nothing.
- Service: Service Connect client+server on port name `http`, discovery name = app name (so `http://auth:3001` keeps
  working), deployment circuit breaker with rollback, `enableExecuteCommand` (replaces `ssm start-session`),
  `desiredCount` = 1 if `alwaysOn` else 0.
- Scalable target: min = 1 or 0, max = `maxTasks` (default 4); target tracking CPU 60 %, scale-in cooldown 5 min.
- `api` additionally: ALB target group on `/health/live`, min 1.

Image reference: `<registry>/bf-prod/<app>:<tag>` where `<tag>` = SSM `/bf/prod/images/<app>` at synth (CI writes it),
`:prod` when the parameter is missing or synth runs without credentials (PR checks).

### 3.3 Orchestrator (inside `apps/api`, module `orchestrator/`)

Off locally (`ORCHESTRATOR=none`, compose unchanged). On ECS: `ORCHESTRATOR=ecs`, plus `ECS_CLUSTER`,
`SERVICE_GRAPH` (`admin=auth|order|course|billing|ai,billing=order,order=auth`), `ALWAYS_ON`, `DEFAULT_COOLDOWN_S=10800`,
`WAKE_TIMEOUT_MS=50000`. All rendered by CDK from `lib/config.ts`.

State per service, read from ECS (`DescribeServices` with tags, cached 10 s per api task): `desiredCount`,
`runningCount`, rollout state, tag `bf:last-activity` (epoch seconds), tag `bf:cooldown` (seconds, overrides config).

- **Request path** (middleware before the proxy): resolve the target service and its closure in the graph; for each
  with `desiredCount 0`: `RegisterScalableTarget(min 1,max N)` + `UpdateService(desiredCount 1)` (idempotent: two
  api tasks doing it at once is harmless); poll `runningCount` then `GET http://<svc>:<port>/health/live` through
  Service Connect. Hold the request up to `WAKE_TIMEOUT_MS`, else **503 + `Retry-After: 10`** with a problem+json
  body; the frontends' tRPC link retries and shows "starting up". Record activity with `TagResource`
  `bf:last-activity=<now>` (at most once per service per 30 s per api task).
- **Sweep** (`@nestjs/schedule`, every minute, every api task, idempotent): for each service with `desiredCount ≥ 1`,
  `now − bf:last-activity > cooldown` and no awake dependent: `RegisterScalableTarget(0/0)` + `UpdateService(desiredCount 0)`.
  A request landing while the tasks drain sees `desiredCount 0` and wakes the service again (no lost requests, one
  extra cold start).
- **Failure**: `desiredCount 1` but `runningCount 0` for more than 3 min (image pull failure, crash loop) → back to 0,
  503, error log, CloudWatch alarm on the log metric. Deployment failures roll back via the circuit breaker.
- **Admin surface** (edge-protected, role `admin`): `GET /_services` (states), `POST /_services/:name/cooldown`,
  `POST /_services/:name/sleep|wake`. Per-service default cooldown also settable in `lib/config.ts`.

Verify on the real cluster right after the first deploy: `RegisterScalableTarget` min-change scales out promptly;
Service Connect returns a fast 503 for a 0-task service and picks up the new task within seconds.

### 3.4 Deploy flow (pipeline.yml, same shape as today)

```
PR: unchanged checks (+ next apps: `next build` export instead of docker build)  ─► ci ok
main: approve ─► snapshot ─► infra (cdk deploy, only if the stack changed)
                        ├─► images   (nest + job apps)  push :sha + :prod, PutParameter /bf/prod/images/<app>
                        └─► static   (next apps)        next build → s3 sync → invalidation
              ─► release: ecs-migrate.ts (ensure DBs, drizzle-kit migrate as RunTask per app, wait, exit code)
                          ecs-deploy.ts  (register revision from the current one with the new image → UpdateService;
                                          waits for stability of running services; sleeping ones stay at 0)
              ─► smoke: https://malinina.ca/, /admin/, /api/auth/health/live
```

Rollback = `ecs-deploy.ts --image <previous sha>` (or the circuit breaker, automatically). Migrations stay
expand-then-contract. Secrets rotation = `set-secrets.ts` then `UpdateService(forceNewDeployment)` for the affected
services (replaces the host "refresh" path). `db-snapshot.yml`, `db-allow-me`, `db-url` are unchanged.

### 3.5 Local development

Root `docker-compose.yml` keeps working as is: the orchestrator is off, `UPSTREAMS` unchanged. Only
`docker/next.Dockerfile` changes: build stage runs the export, runner is `nginx:alpine` with
`try_files $uri $uri/index.html $uri.html` — the same rewrite the CloudFront Function does, so local == prod.
`pnpm dev` (`next dev`) is unaffected.

## 4. Cost (us-east-1, ≈ 730 h/mo)

| Item                                    | Fixed     | Variable                                                            |
| --------------------------------------- | --------- | ------------------------------------------------------------------- |
| `api` 0.25 vCPU / 0.5 GB ARM, always on | $7.2      | + $7.2 per extra task-month when scaled out                         |
| public IPv4 for `api`                   | $3.65     |                                                                     |
| ALB                                     | $16.4     | + LCU ≈ $1–5                                                        |
| CloudFront, S3, CF Functions            | $0        | free tier covers 1 TB + 10 M requests                               |
| Aurora (unchanged)                      | $0        | $0.12/ACU-h awake; ≈ $15 at 8 h/day, $44 if never paused            |
| internal service, per awake task        | –         | $0.015/h incl. IP → 6 services × 10 h/day ≈ $27/mo; at 3 h/day ≈ $8 |
| Secrets (4), Route 53, ECR, logs        | ≈ $5      |                                                                     |
| **Total**                               | **≈ $32** | **≈ $55–105/mo in practice** (vs $40–85 today)                      |

Where the money goes: the ALB and the awake-hours of internal services. Levers, in order: `alwaysOn` list short,
cooldown ≤ 3 h, FARGATE_SPOT for internal services (–70 %, costs a cold start on interruption), and — if $16/mo
matters — replace the ALB with an API Gateway HTTP API + VPC Link + Cloud Map (pay-per-request, 30 s hard timeout).
That last one is a later experiment, not part of the migration.

## 5. Big-bang cutover (MVP: no load, no parallel run, no leftovers)

One branch, one PR, one deploy. The host stack is deleted in the same PR that adds Fargate. Downtime during the
switch is accepted. Order of work (dependencies, not phases):

1. **Next apps → static export** (`output: 'export'`, `trailingSlash`, `images.unoptimized`, admin `basePath`,
   drop `headers()`), `docker/next.Dockerfile` → nginx runner for local compose, `apps.mjs` gets `deploy: ecs|static|job`.
2. **`apps/api/orchestrator/`** (§3.3) with `ORCHESTRATOR=none` default and unit tests; `@bf/trpc` client retry;
   `@bf/db ensure-database`; RDS CA baked into `nest.Dockerfile`.
3. **CDK rewrite of `bf-prod`**: delete `host.ts`, `host-commands.ts`, `host/`; add `cluster.ts`, `services.ts`,
   `ingress.ts`, `jobs.ts` (empty); `network.ts` SGs for ALB/tasks/db; `config.ts` `ecs` + `static` sections;
   `github-stack.ts` permissions for ECS/CloudFront/S3/SSM. Route 53 apex + `admin.`/`api.` → the distribution
   (subdomains redirect to `/admin/` and `/api/`).
4. **Scripts**: `ecs-deploy.ts`, `ecs-migrate.ts`, `static-deploy.ts`, `smoke.ts` on the new URLs; delete
   `host-deploy.ts`; `set-secrets.ts` / `db-rotate-password.ts` end with a forced ECS deployment.
5. **`pipeline.yml`**: `images` (nest/job apps) ∥ `static` (next apps) → `release` (migrate → deploy) → `smoke`;
   `discover.ts` without `HOST_BUNDLE_PATHS`.
6. **Docs**: README, `infra/aws/README.md`, ADR #23.

Ship it:

```bash
node infra/aws/scripts/bootstrap.ts FreyDv/bf      # bf-github changed (new permissions)
pnpm aws:deploy                                    # PR label allow-destructive: instance + EIP go away; Aurora, buckets, secrets stay
# merge → pipeline: images + static → release (ensure DBs, migrate, deploy) → smoke
```

Expected switch window: `cdk deploy` ≈ 10–15 min (CloudFront + ACM validation dominate), DNS TTL 300 s.
Rollback if the new stack is broken: `git revert` + `pnpm aws:deploy` + `pnpm aws:host-deploy` recreates the host
from the old images still in ECR (`:prod` tag). Nothing stateful is touched by the migration.

Jobs, alarms, WAF, Spot, API Gateway: after, when there is something to schedule or protect.

## 6. Decisions (taken; change `lib/config.ts` later)

| #   | Decision     | Value                                                                |
| --- | ------------ | -------------------------------------------------------------------- |
| 1   | Region       | `us-east-1`                                                          |
| 2   | Public paths | `/` fe-main, `/admin/*` fe-admin, `/api/*` edge; subdomains redirect |
| 3   | Task sizes   | 0.25 vCPU / 0.5 GB, `maxTasks` 4, CPU target 60 %                    |
| 4   | Always-on    | `api` only                                                           |
| 5   | Cooldown     | 3 h default, per service in config, admin endpoint override          |
| 6   | Cold start   | hold ≤ 50 s, then 503 + `Retry-After`, frontend retries              |
| 7   | Ingress      | ALB behind CloudFront                                                |
| 8   | Discovery    | ECS Service Connect                                                  |
| 9   | Spot         | off                                                                  |
| 10  | Orchestrator | inside `apps/api`; state = ECS counts + service tags, no extra store |

Housekeeping: the untracked empty files `bf@` and `node` in the repo root look accidental.
