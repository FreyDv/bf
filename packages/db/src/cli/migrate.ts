/**
 * `node node_modules/@bf/db/dist/cli/migrate.js` — what the one-off migration task runs inside a service image
 * (infra/aws/scripts/ecs-migrate.ts) and what docker/migrate.sh runs locally:
 *   1. connect to the maintenance database (POSTGRES_MAINTENANCE_DB, default `postgres`) and CREATE DATABASE
 *      POSTGRES_DB if it does not exist yet
 *   2. `drizzle-kit migrate` in the current directory (the app's drizzle.config.ts)
 * Same POSTGRES_* env as the app. Exit code = drizzle-kit's.
 */
import { spawnSync } from 'node:child_process';

import { Client } from 'pg';

import { loadPostgresEnv } from '../config';
import { ensureDatabase } from '../ensure-database';
import { buildPostgresUrl } from '../env';

async function main() {
  const env = loadPostgresEnv([]);
  const maintenance = process.env.POSTGRES_MAINTENANCE_DB || 'postgres';
  const client = new Client({
    connectionString: buildPostgresUrl({ ...env, POSTGRES_DB: maintenance }),
    connectionTimeoutMillis: env.DB_CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  try {
    await ensureDatabase(client, env.POSTGRES_DB);
  } finally {
    await client.end();
  }

  const result = spawnSync('npx', ['drizzle-kit', 'migrate'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
