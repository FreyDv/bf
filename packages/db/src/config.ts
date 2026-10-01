/**
 * `@bf/db/config` — Nest-free helper used by each app's `drizzle.config.ts`.
 * Reads POSTGRES_* (from process.env, optionally merged with an env file), validates, and
 * returns a drizzle-kit config for the app's own database (one database per service, public schema).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

import { buildPostgresUrl, postgresEnvSchema } from './env';

export interface AppDrizzleConfigOptions {
  /** Service name == database name (`auth`, `order`, …). Used as the POSTGRES_DB default. */
  app: string;
  /** Path(s) to schema register, relative to the app root. Default `./src/db/schema.register.ts`. */
  schema?: string | string[];
  /** Migrations output dir. Default `./drizzle`. */
  out?: string;
  /** Extra env files to load (first wins). Default: `.env` then `../../infra/postgres/.env`. */
  envFiles?: string[];
  /** Where to resolve relative envFiles from. Default process.cwd(). */
  cwd?: string;
}

export function loadPostgresEnv(envFiles: string[], cwd = process.cwd(), defaultDb?: string) {
  for (const file of envFiles) {
    const abs = resolve(cwd, file);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
  if (defaultDb && !process.env.POSTGRES_DB) process.env.POSTGRES_DB = defaultDb;
  const parsed = postgresEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `POSTGRES_* environment is incomplete:\n${issues}\nChecked env files: ${envFiles.join(', ')}`,
    );
  }
  return parsed.data;
}

export function defineAppDrizzleConfig(options: AppDrizzleConfigOptions) {
  const cwd = options.cwd ?? process.cwd();
  const env = loadPostgresEnv(
    options.envFiles ?? ['.env', '../../infra/postgres/.env'],
    cwd,
    options.app,
  );
  return defineConfig({
    dialect: 'postgresql',
    schema: options.schema ?? './src/db/schema.register.ts',
    out: options.out ?? './drizzle',
    casing: 'snake_case',
    migrations: { table: '__drizzle_migrations' },
    dbCredentials: { url: buildPostgresUrl(env) },
    strict: true,
    verbose: true,
  });
}

export { buildPostgresUrl, postgresEnvSchema } from './env';
