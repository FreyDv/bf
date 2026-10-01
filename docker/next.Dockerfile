# syntax=docker/dockerfile:1.7
# One Dockerfile for every Next.js app. Build context = repo root:
#   docker build -f docker/next.Dockerfile --build-arg APP=fe-main --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 -t bf/fe-main .
ARG APP=fe-main
ARG NODE_IMAGE=node:26-alpine

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
FROM ${NODE_IMAGE} AS runner
ARG APP
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0 \
  APP=${APP}
WORKDIR /app
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# The standalone output mirrors the monorepo layout (outputFileTracingRoot = repo root).
COPY --from=build --chown=nextjs:nodejs /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/${APP}/public ./apps/${APP}/public
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node apps/${APP}/server.js"]
