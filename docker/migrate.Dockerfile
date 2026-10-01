# syntax=docker/dockerfile:1.7
# Migration runner: workspace with drizzle-kit for every DB-backed service. Build context = repo root.
# No app list here: every apps/*/drizzle.config.ts is a migratable service (see docker/migrate.sh).
ARG NODE_IMAGE=node:26-alpine
FROM ${NODE_IMAGE}
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN npm install -g pnpm@10.15.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY packages ./packages
COPY apps ./apps
COPY docker/migrate.sh ./docker/migrate.sh
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile \
    $(for c in apps/*/drizzle.config.ts; do printf -- '--filter %s... ' "$(basename "$(dirname "$c")")"; done) \
  && pnpm turbo run build --filter=@bf/db
CMD ["sh", "docker/migrate.sh"]
