// Test database access shared by every package (ADR-071, ADR-039 item 5, TST-3). A test never reaches a database
// before the guard has passed twice: the configured DB_NAME must name a test database, and so must the database the
// server reports once connected. The helper returns a pg Pool; a consumer wraps Drizzle around it itself.
//
// Consumed as a devDependency only and imported only from test files (`.dependency-cruiser.mjs`, rule
// `test-db-only-from-tests`), so it is never part of an image.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildConnectionUrl, readDbConfig, type DbConfig, type Env } from '@bf/db-utils';

const TEST_NAME = /(^|[^a-z0-9])test($|[^a-z0-9])/i;

/** TST-3: throws unless the name has `test` as a word of its own (`bf_test`, `test`, `qa-test-2`). */
export function assertTestDatabase(name: string): void {
  if (!TEST_NAME.test(name)) {
    throw new Error(
      `TST-3: refusing to run against database "${name}": its name must mark it as a test database (for example bf_test)`,
    );
  }
}

/** The one thing the second step of the guard needs from a connection. */
export interface Queryable {
  query(text: string): Promise<{ rows: { name?: unknown }[] }>;
}

/** TST-3, second step: the database the server reports (ADR-051 item 6), checked before any other statement. */
export async function assertConnectedToTestDatabase(connection: Queryable): Promise<void> {
  const { rows } = await connection.query('select current_database() as name');
  const name = rows[0]?.name;
  assertTestDatabase(typeof name === 'string' ? name : '');
}

const PREFIX = /^[a-z][a-z0-9]{0,15}$/;
const SCHEMA = /^[a-z][a-z0-9]{0,15}_[0-9a-f]{8}$/;

/** A schema name no other run uses (`<prefix>_<8 hex>`); generated, so it is safe to put into DDL. */
export function newSchemaName(prefix: string): string {
  if (!PREFIX.test(prefix)) {
    throw new Error(`schema prefix must match ${PREFIX.source}, got "${prefix}"`);
  }
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

export interface TestDatabaseOptions {
  /** The variables to read; `process.env` by default. */
  readonly env?: Env;
}

export interface TestSchemaOptions extends TestDatabaseOptions {
  /** From `newSchemaName`; a test that defines its tables at module level needs the name before it connects. */
  readonly schema: string;
  /** DDL run inside the new schema, in order. */
  readonly ddl: readonly string[];
}

export interface TestDatabase {
  readonly pool: pg.Pool;
  /** The schema the pool's `search_path` points at. */
  readonly schema: string;
  /** Closes the pool; for a schema per file it drops the schema first. Safe to call twice. */
  close(): Promise<void>;
}

function readConfig(env: Env): DbConfig {
  // readDbConfig names every missing variable; the hint is for the usual cause, a database that is not up.
  try {
    return readDbConfig(env);
  } catch (error) {
    throw new Error(
      `${(error as Error).message}; start the local database with \`pnpm local:up\``,
      { cause: error },
    );
  }
}

/**
 * Mode 1, a schema per file, for packages without migrations of their own (a toolkit): creates the schema, points
 * `search_path` at it, runs the DDL and drops the schema on `close()`. Files may run in parallel, each has its own
 * schema. Start the local database first with `pnpm local:up`.
 */
export async function openTestSchema(options: TestSchemaOptions): Promise<TestDatabase> {
  if (!SCHEMA.test(options.schema)) {
    throw new Error(`unexpected schema name ${options.schema}`);
  }
  const config = readConfig(options.env ?? process.env);
  assertTestDatabase(config.name);

  const { schema } = options;
  const pool = new pg.Pool({
    connectionString: buildConnectionUrl({ ...config, schema }),
    max: 4,
  });
  try {
    await assertConnectedToTestDatabase(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }

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
    await pool.query(`create schema ${schema}`);
    for (const statement of options.ddl) await pool.query(statement);
  } catch (error) {
    await close();
    throw error;
  }
  return { pool, schema, close };
}

/**
 * Mode 2, the shared schema of `bf_test` (ADR-039 item 5.1): the schema `DB_SCHEMA` names, already filled by the
 * app's real migrations before the run (`pnpm test:e2e` applies them, ADR-071). Creates and drops nothing: the test
 * removes the rows it made (TST-3), and files run one after another (ADR-039 item 5.2, the e2e preset of
 * `@bf/config/vitest`). This is the contract of the mode; its first user comes with the first migration.
 */
export async function openSharedTestDatabase(
  options: TestDatabaseOptions = {},
): Promise<TestDatabase> {
  const config = readConfig(options.env ?? process.env);
  assertTestDatabase(config.name);

  const pool = new pg.Pool({ connectionString: buildConnectionUrl(config), max: 4 });
  try {
    await assertConnectedToTestDatabase(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await pool.end();
  };
  return { pool, schema: config.schema, close };
}
