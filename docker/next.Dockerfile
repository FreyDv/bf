# syntax=docker/dockerfile:1.7
# One Dockerfile for every Next.js app (local docker compose only — in production the same `out/` goes to S3).
# Build context = repo root:
#   docker build -f docker/next.Dockerfile --build-arg APP=fe-main --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 -t bf/fe-main .
# The build stage runs the static export (`output: 'export'`), the runner is nginx serving `out/` with the same
# rewrite rules CloudFront applies (docker/nginx-static.conf.template).
ARG APP=fe-main
ARG NODE_IMAGE=node:26-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat \
  && npm install -g pnpm@10.15.0
WORKDIR /repo

# ---------- deps ----------
FROM base AS deps
ARG APP
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/contracts/package.json packages/contracts/
COPY apps/${APP}/package.json apps/${APP}/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --filter "${APP}..."

# ---------- build ----------
FROM base AS build
ARG APP
ARG NEXT_PUBLIC_APP_NAME="bf"
ARG NEXT_PUBLIC_APP_URL="http://localhost:4000"
ARG NEXT_PUBLIC_API_URL="http://localhost:3000"
ARG NEXT_PUBLIC_DEV_TOKEN_SUB="admin"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
  NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
  NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_DEV_TOKEN_SUB=${NEXT_PUBLIC_DEV_TOKEN_SUB} \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /repo/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /repo/apps/${APP}/node_modules ./apps/${APP}/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY packages/config ./packages/config
COPY packages/ui ./packages/ui
COPY packages/contracts ./packages/contracts
COPY apps/${APP} ./apps/${APP}
RUN pnpm --filter @bf/contracts build && pnpm --filter "${APP}" build

# ---------- runner ----------
FROM ${NGINX_IMAGE} AS runner
ARG APP
# '' for the main site, '/admin' for fe-admin (must equal `basePath` in the app's next.config.ts)
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}
COPY docker/nginx-static.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/${APP}/out /usr/share/nginx/html${BASE_PATH}
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1${BASE_PATH}/ >/dev/null || exit 1
