import { z } from 'zod';

/** POSTGRES_* variables shared by drizzle-kit config, app env schemas and infra/postgres/.env. */
export const postgresEnvSchema = z.object({
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_POOL_MIN: z.coerce.number().int().min(0).max(50).default(2),
  /** How long a new connection may take. Aurora Serverless resuming from a pause needs ~15 s → 30000 there. */
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
});

export type PostgresEnv = z.infer<typeof postgresEnvSchema>;

export function buildPostgresUrl(
  env: Pick<
    PostgresEnv,
    | 'POSTGRES_HOST'
    | 'POSTGRES_PORT'
    | 'POSTGRES_DB'
    | 'POSTGRES_USER'
    | 'POSTGRES_PASSWORD'
    | 'POSTGRES_SSL'
  >,
): string {
  const user = encodeURIComponent(env.POSTGRES_USER);
  const pass = encodeURIComponent(env.POSTGRES_PASSWORD);
  // verify-full: pg checks the server certificate against Node's trust store (RDS: NODE_EXTRA_CA_CERTS = RDS CA bundle)
  const ssl = env.POSTGRES_SSL ? '?sslmode=verify-full' : '';
  return `postgres://${user}:${pass}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}${ssl}`;
}
