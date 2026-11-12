# ADR-027: context is the monorepo root (`docker build -f apps/backend/Dockerfile .`); one image for every
# backend entry point, the process is chosen by the command in the Helm values (ADR-008).
# The tag matches .nvmrc; the digest is what pins it. Bump both in one PR after the 7-day cooldown (ADR-005).
FROM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS base
WORKDIR /repo
# Tool versions come from package.json so that they have one home (R4). Node 26 does not bundle corepack.
COPY package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" \
      "turbo@$(node -p "require('./package.json').devDependencies.turbo")"

FROM base AS prune
COPY . .
RUN turbo prune @bf/backend --docker

FROM base AS build
# Dependencies first: this layer is rebuilt only when a package.json or the lockfile changes.
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
# `deploy` leaves the package with its production dependencies only.
RUN pnpm turbo run build --filter=@bf/backend \
 && pnpm --filter=@bf/backend deploy --prod /prod/backend

FROM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/backend/package.json ./package.json
COPY --from=build --chown=node:node /prod/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/backend/dist ./dist
USER node
# `node` directly, not `pnpm start`: SIGTERM must reach the process (ADR-027). No HEALTHCHECK: probes are in the chart (ADR-019).
CMD ["node", "dist/main.js"]
