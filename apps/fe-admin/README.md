# fe-admin

Internal admin UI for the bf platform. Next.js 15 (App Router) + Tailwind 4, built on the shared `@bf/ui` component package. Talks to the backends **only through the edge** (`apps/api`): REST for the browser-facing auth endpoints, tRPC (typed by `@bf/contracts`) for everything else.

## Run

```sh
pnpm setup:env                     # creates apps/fe-admin/.env from .env.example
pnpm --filter fe-admin dev         # http://localhost:4001
```

Other scripts: `build`, `start`, `lint`, `lint:fix`, `typecheck` (all wired into Turbo).

On first load the app requests a dev token pair from `auth` (`POST /auth/api/auth/dev-token`, roles `admin,user`) and stores the access token in `localStorage` under `bf-admin:dev-token`. Use "Retry" on an error card to drop a stale token and re-authenticate. Orders are read/written via `client.orders.*` (`@bf/contracts/order`) at `${API}/order/trpc`.

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
