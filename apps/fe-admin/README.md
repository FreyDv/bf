# fe-admin

Internal admin UI for the bf platform. Next.js 15 (App Router) + Tailwind 4, built on the shared `@bf/ui` component package. Talks to the backends **only through the edge** (`apps/api`): REST for the browser-facing auth endpoints, tRPC (typed by `@bf/contracts`) for everything else.

## Run

```sh
pnpm setup:env                     # creates apps/fe-admin/.env from .env.example
pnpm --filter fe-admin dev         # http://localhost:4001
```

Other scripts: `build`, `start`, `lint`, `lint:fix`, `typecheck` (all wired into Turbo).

On first load the app requests a dev token pair from `auth` (`POST /auth/api/auth/dev-token`, roles `admin,user`) and stores the access token in `localStorage` under `bf-admin:dev-token` (`src/lib/auth-token.ts`; the tRPC client's fetch sends it and, on a 401, drops it and replays once). The dev-token endpoint is disabled in production: put a real admin access token under the same key to use the UI there.

## Pages

| Path     | What                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`      | Dashboard with a button to the infra page                                                                                                                                                                                                                                                                                                                           |
| `/infra` | ECS services behind the edge (status, running/desired tasks, vCPU and memory per task, last activity), **Wake up** per service and **Wake up all**, every Aurora cluster with status and current ACU. tRPC to the edge's own router (`src/lib/trpc.ts`, `@bf/contracts/api` at `${API}/_services/trpc`); refreshes every 10 s. Empty locally (`ORCHESTRATOR=none`). |

## Environment

All variables are `NEXT_PUBLIC_*` and inlined at build time (validated in `src/config/env.ts`).

| Variable                    | Default                 | Purpose                              |
| --------------------------- | ----------------------- | ------------------------------------ |
| `NEXT_PUBLIC_APP_NAME`      | `bf admin`              | Shown in the sidebar and page titles |
| `NEXT_PUBLIC_APP_URL`       | `http://localhost:4001` | Public URL (metadata base)           |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:3000` | Edge base URL                        |
| `NEXT_PUBLIC_DEV_TOKEN_SUB` | `admin`                 | Subject used for the dev token       |

## Docker

Shared Dockerfile for every Next app, built from the repo root:

```sh
docker build -f docker/next.Dockerfile --build-arg APP=fe-admin --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 -t bf/fe-admin .
```

Or simply `pnpm stack:up` (root `docker-compose.yml`).
