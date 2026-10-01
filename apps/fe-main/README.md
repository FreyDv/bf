# fe-main

Public Next.js 15 site of the bf platform (App Router, Tailwind 4, `@bf/ui`). Talks to the backends **only through the edge** (`apps/api`) with tRPC clients typed by `@bf/contracts`.

Flow: "Sign in with Google" → `GET ${API}/auth/api/auth/google` (redirect to Google) → auth callback → redirect to `/auth/callback#access_token=…&refresh_token=…` → tokens kept in `localStorage` (`bf:session`, refreshed via `POST /auth/api/auth/refresh`) → `/me` reads `users.me` and manages addresses over `${API}/auth/trpc`.

```sh
pnpm setup:env
pnpm --filter fe-main dev        # http://localhost:4000
```

| Variable               | Default                 |
| ---------------------- | ----------------------- |
| `NEXT_PUBLIC_APP_NAME` | `bf`                    |
| `NEXT_PUBLIC_APP_URL`  | `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3000` |

Docker: `docker build -f docker/next.Dockerfile --build-arg APP=fe-main -t bf/fe-main .` or `pnpm stack:up`.
