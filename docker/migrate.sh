#!/bin/sh
# Runs drizzle-kit migrations for every DB-backed service against one Postgres instance.
# Used by the `migrate` one-shot service in docker-compose.yml (image: docker/migrate.Dockerfile).
# Each service migrates its own database (POSTGRES_DB=<service>); databases are created by
# infra/postgres/postgres-init/01-init.sql on first start.
# Services are discovered: every apps/*/drizzle.config.ts. Override with MIGRATE_SERVICES="auth order".
set -eu
if [ -z "${MIGRATE_SERVICES:-}" ]; then
  MIGRATE_SERVICES="$(for c in apps/*/drizzle.config.ts; do basename "$(dirname "$c")"; done | tr '\n' ' ')"
fi
for svc in $MIGRATE_SERVICES; do
  echo "== migrate $svc (database $svc)"
  POSTGRES_DB="$svc" pnpm --filter "$svc" db:migrate
done
echo "migrations done"
