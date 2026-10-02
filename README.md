# bf — NestJS service monorepo

pnpm 10 · Turborepo · Node 26 · NestJS 12 · TypeScript 6 · ESLint 10 · **nestjs-trpc + contract-first `@bf/contracts`** · Drizzle (one Postgres, one database per service) · RS256 JWT issued by `auth` · Pino · Next.js 15 (`fe-main`, `fe-admin`) on `@bf/ui` · one `docker-compose.yml` for everything.

```
apps/
  api       :3000  edge — verifies JWT, enforces ROUTE_ROLES, rate-limits, proxies /<service>/* to the services
  auth      :3001  identity skeleton — users + refresh tokens; issues RS256 tokens (dev-token, refresh, logout, jwks)
  order     :3002  orders skeleton — CQRS, outbox/inbox tables, tRPC client to auth; no business logic yet
  course    :3003  courses catalogue (skeleton)
  billing   :3004  invoices (skeleton)
  admin     :3005  back-office skeleton — audit_log table, tRPC clients to the other services
  ai        :3006  LLM facade skeleton (@bf/llm wired, no procedures yet)
  fe-main   :4000  public Next.js site (placeholder page)
  fe-admin  :4001  Next.js admin (placeholder dashboard)
packages/  @bf/contracts (zod schemas + generated router types)  @bf/trpc (server context, middlewares, typed clients)
           @bf/config @bf/shared @bf/db @bf/events @bf/server @bf/storage @bf/llm @bf/ui
docker/    nest.Dockerfile (ARG APP)  next.Dockerfile (ARG APP)  migrate.Dockerfile + migrate.sh
infra/     postgres/redis/minio/otel/… compose files; infra/aws (CDK: one EC2 host + Aurora Serverless v2)
```

## Quick start (everything in Docker)

```bash
nvm use && npm i -g pnpm@10.15.0 && pnpm install
pnpm setup:env      # copies every .env.example → .env (apps + infra)
pnpm stack:up       # docker compose up --build -d  → postgres, redis, minio, migrate, 7 services, 2 Next apps
open http://localhost:4000   # fe-main
open http://localhost:4001   # fe-admin
```

## Quick start (apps on the host)

```bash
pnpm setup:env && pnpm gen:jwt-keys   # optional: fresh RS256 pair instead of the committed dev-only one
pnpm infra:core                       # postgres (+ 01-init.sql creates databases auth/order/course/billing/admin), minio, otel
pnpm build
for s in auth order course billing admin; do POSTGRES_DB=$s pnpm --filter $s db:migrate; done
pnpm dev                              # all services + both Next apps
```

### Try it

```bash
# dev token pair from auth (through the edge). roles are yours to pick locally.
TOKENS=$(curl -s -XPOST localhost:3000/auth/api/auth/dev-token -H 'content-type: application/json' -d '{"sub":"me","roles":["user","admin"]}')
TOKEN=$(echo "$TOKENS" | jq -r .accessToken)

curl -s localhost:3000/order/trpc/health.ping -H "authorization: Bearer $TOKEN" | jq .result.data      # any service: /<svc>/trpc/health.ping
curl -s localhost:3000/order/trpc/health.ping                                                            # 401 (no token)
```

tRPC `:300x/trpc/<router>.<procedure>`, health `:300x/health`, pgAdmin `:5050`, Jaeger `:16686`.

## Contracts (how services talk)

Contract-first: zod schemas are written by hand in `packages/contracts/src/<svc>/schemas.ts`, routers import them into `@Query/@Mutation({ input, output })`, and the nestjs-trpc CLI generates the `AppRouter` **type** back into `packages/contracts/src/<svc>/router.ts` (`pnpm contracts:generate`). Consumers (`@bf/trpc` clients in Nest, `@trpc/client` in Next) import `@bf/contracts/<svc>` through the workspace — nothing is published; CI fails on drift (`pnpm contracts:check`). Details: `packages/contracts/README.md`.

Request path: browser → `api` (JWT verified with `JWT_PUBLIC_KEY`, client `X-User-*` headers stripped, identity re-attached, `ROUTE_ROLES`, per-user rate limit) → `/<svc>/trpc/*` → service (`@bf/trpc` context trusts the headers; `AuthedMiddleware`/`AdminMiddleware` guard procedures) → other services via `TrpcClientModule` (correlation id + identity propagated).

## Commands

| Command                                        | What                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm lint` / `typecheck` / `test` / `deps`    | ESLint 10 flat (`@bf/config`), tsc 6, Jest, dependency-cruiser                            |
| `pnpm contracts:generate` / `contracts:check`  | regenerate `@bf/contracts/*/router.ts` for every service / fail on drift                  |
| `pnpm db:generate` / `db:check` / `db:migrate` | per-service drizzle-kit; migrations committed under `apps/*/drizzle`; `POSTGRES_DB=<svc>` |
| `pnpm test:e2e`                                | auth contract tests against local infra                                                   |
| `pnpm env:check`                               | `.env.example` vs zod env schema drift for every Nest service (CI)                        |
| `pnpm apps [--changed <ref>] [--only e2e]`     | discover apps from `apps/*` (kind, dockerfile, migrations, e2e…) — CI/deploy matrices     |
| `pnpm gen:jwt-keys`                            | fresh RS256 pair into every `apps/*/.env`                                                 |
| `pnpm stack:up` / `stack:down`                 | whole platform via the root `docker-compose.yml`                                          |

## CI / CD

No app list anywhere: `scripts/apps.mjs` scans `apps/*` and the workflows fan out per affected app
(turbo graph + `docker/`, `.github/`, `scripts/` as global triggers).

- `pipeline.yml` is the **only** workflow for the path PR → production, so one run shows everything:
  - **CI** (PR and `main`): repo-wide prettier, packages, `infra/aws` (tsc · eslint · `cdk synth`), env drift, contracts drift; per affected app **static** (prettier · eslint · tsc · deps), **unit**, **migrations drift**, **e2e**, **docker build**. `ci ok` is the single required check.
  - **PR comments** (sticky, updated on every push): **release plan** (what a merge deploys), **infra diff** (`cdk diff`; fails on a removed/replaced stateful resource unless the PR has the label `allow-destructive`), **test report** (unit + e2e, failures included).
  - **Production** (merge to `main`, or "Run workflow" for chosen apps / `infra`): `ci ok` → **approve** (one click, once `prod-approval` has a reviewer) → **DB snapshot** → `cdk deploy` (only if the stack changed) ∥ per app **build & push** → **rollout** (`drizzle-kit migrate`, `docker compose up --wait`, automatic rollback to the previous images when a container is unhealthy) → **smoke test** of the public URLs. Containers are checked on `/health/live` only; there is deliberately no DB health check (Aurora must be able to pause).
- `db-snapshot.yml` snapshots Aurora to S3 (called by the pipeline, or run by hand). One-time GitHub settings (branch protection on `ci ok`, the `prod-approval` environment, the label): `node scripts/ci/repo-settings.ts --apply`. AWS setup: `infra/aws/README.md`.
- Workflow logic lives in TypeScript (`scripts/ci/*.ts`, `infra/aws/scripts/*.ts`), run with plain `node` — the same commands work locally.

Decisions: `docs/ADR.md` (#16–20 cover the split). Infra details: `infra/README.md`. AWS: `infra/aws/README.md`.
