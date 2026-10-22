import { escapeIdentifier } from 'pg';

/** The slice of pg.Client / pg.Pool this needs (so tests pass a fake). */
export interface SqlClient {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

/**
 * `CREATE DATABASE <name>` unless it exists. Run against a maintenance database (`postgres`) with a user that
 * may create databases — in production the Aurora master user, before `drizzle-kit migrate` of each service.
 * The identifier is quoted: `order` is a reserved word.
 */
export async function ensureDatabase(
  client: SqlClient,
  name: string,
  log: (message: string) => void = console.log,
): Promise<'created' | 'exists'> {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`invalid database name "${name}"`);
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (rowCount) {
    log(`database ${name} exists`);
    return 'exists';
  }
  await client.query(`CREATE DATABASE ${escapeIdentifier(name)}`);
  log(`database ${name} created`);
  return 'created';
}
