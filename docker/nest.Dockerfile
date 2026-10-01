# syntax=docker/dockerfile:1.7
# One Dockerfile for every NestJS service. Build context = repo root:
#   docker build -f docker/nest.Dockerfile --build-arg APP=auth -t bf/auth .
ARG APP=api
ARG NODE_IMAGE=node:26-alpine

FROM ${NODE_IMAGE} AS base
ARG APP
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# Node 26 no longer bundles corepack; pin pnpm explicitly (must match packageManager in package.json)
RUN npm install -g pnpm@10.15.0
WORKDIR /repo

FROM base AS build
ARG APP
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "${APP}..."
RUN pnpm turbo run build --filter="${APP}"
# Prune to a self-contained production tree (workspace deps included as real packages).
# drizzle/ + drizzle.config.ts + drizzle-kit stay available so the same image can run migrations.
RUN pnpm --filter "${APP}" deploy --legacy /out \
  && rm -rf /out/node_modules/.pnpm/@swc* /out/node_modules/.pnpm/typescript* 2>/dev/null || true

FROM ${NODE_IMAGE} AS runner
ARG APP
ENV NODE_ENV=production PORT=3000 APP=${APP}
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT}/health/live || exit 1
CMD ["node", "dist/main.js"]
