// Test database access for the toolkit (ADR-050 item 12, ADR-039 item 1.2). It refuses a database whose name does
// not mark it as a test database (TST-3), creates the tables the tests need in a schema of its own and drops it
// afterwards. TEST-2 generalises this helper for every package.
import { randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const TEST_NAME = /(^|[^a-z0-9])test($|[^a-z0-9])/i;

/** The name of the database a connection string points at. */
export const databaseName = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.slice(1));

/** TST-3: throws unless the name has `test` as a word of its own (`bf_test`, `test`, `qa-test-2`). */
export function assertTestDatabase(name: string): void {
  if (!TEST_NAME.test(name)) {
    throw new Error(
      `TST-3: refusing to run against database "${name}": its name must mark it as a test database (for example bf_test)`,
    );
  }
}

/** A schema name no other run uses; generated, so it is safe to put into DDL. */
export const newSchemaName = (): string => `qf_${randomBytes(4).toString('hex')}`;

export interface TestDatabase {
  readonly pool: pg.Pool;
  readonly db: ReturnType<typeof drizzle>;
  readonly schema: string;
  /** Drops the schema and closes the pool. Safe to call twice. */
  close(): Promise<void>;
}

/**
 * Connects to DATABASE_URL after TST-3 has passed for the name in the URL and for the database the server
 * reports, then runs `ddl` inside a fresh schema. Start the local database first with `pnpm local:up`.
 */
export async function openTestDatabase(
  schema: string,
  ddl: readonly string[],
): Promise<TestDatabase> {
  if (!/^qf_[0-9a-f]{8}$/.test(schema)) {
    throw new Error(`unexpected schema name ${schema}`);
  }
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set; start the local database with `pnpm local:up`');
  }
  assertTestDatabase(databaseName(url));

  const pool = new pg.Pool({ connectionString: url, max: 4 });
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await pool.query(`drop schema if exists ${schema} cascade`);
    } finally {
      await pool.end();
    }
  };
  try {
    const { rows } = await pool.query<{ name: string }>('select current_database() as name');
    assertTestDatabase(rows[0]?.name ?? '');
    await pool.query(`create schema ${schema}`);
    for (const statement of ddl) await pool.query(statement);
  } catch (error) {
    await close();
    throw error;
  }
  return { pool, db: drizzle(pool), schema, close };
}
