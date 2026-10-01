import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PoolConfig } from 'pg';

export const DRIZZLE = Symbol.for('bf.DRIZZLE');

export interface DrizzlePoolOptions {
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: PoolConfig['ssl'];
}

export interface DrizzleModuleOptions<S extends Record<string, unknown>> {
  connectionString: string;
  schema: S;
  pool?: DrizzlePoolOptions;
}

export type DrizzleDatabase<S extends Record<string, unknown>> = NodePgDatabase<S> & {
  $client: Pool;
};

/** Transaction handle type: accept either the db or a tx so repositories can join a caller's transaction. */
export type DrizzleExecutor<S extends Record<string, unknown>> =
  DrizzleDatabase<S> | Parameters<Parameters<NodePgDatabase<S>['transaction']>[0]>[0];

export function createDrizzleInstance<S extends Record<string, unknown>>(
  options: DrizzleModuleOptions<S>,
): DrizzleDatabase<S> {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.pool?.max ?? 10,
    min: options.pool?.min ?? 2,
    idleTimeoutMillis: options.pool?.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.pool?.connectionTimeoutMillis ?? 5_000,
    ssl: options.pool?.ssl,
  });
  // casing is hard-coded here AND in defineAppDrizzleConfig so apps cannot drift.
  return drizzle({ client: pool, schema: options.schema, casing: 'snake_case' });
}
