#!/bin/sh
# Runs migrations for every DB-backed service against one Postgres instance (the `migrate` one-shot service in
# docker-compose.yml, image docker/migrate.Dockerfile). Each service gets its own database (POSTGRES_DB=<service>),
# created on the fly by @bf/db's migrate entry — the same entry the production one-off task runs.
# Services are discovered: every apps/*/drizzle.config.ts. Override with MIGRATE_SERVICES="auth order".
set -eu
if [ -z "${MIGRATE_SERVICES:-}" ]; then
  MIGRATE_SERVICES="$(for c in apps/*/drizzle.config.ts; do basename "$(dirname "$c")"; done | tr '\n' ' ')"
fi
for svc in $MIGRATE_SERVICES; do
  echo "== migrate $svc (database $svc)"
  (cd "apps/$svc" && POSTGRES_DB="$svc" node ../../packages/db/dist/cli/migrate.js)
done
echo "migrations done"
