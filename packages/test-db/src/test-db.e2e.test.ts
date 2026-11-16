// The helper on a real Postgres: DB_* from the environment, DB_NAME a test database (`pnpm local:up`).
import { afterAll, describe, expect, it } from 'vitest';
import {
  newSchemaName,
  openSharedTestDatabase,
  openTestSchema,
  type TestDatabase,
} from './index.js';

const open: TestDatabase[] = [];
afterAll(async () => {
  await Promise.all(open.map((database) => database.close()));
});

const track = (database: TestDatabase): TestDatabase => {
  open.push(database);
  return database;
};

async function schemaExists(observer: TestDatabase, name: string): Promise<boolean> {
  const { rows } = await observer.pool.query('select 1 from pg_namespace where nspname = $1', [
    name,
  ]);
  return rows.length === 1;
}

describe('schema per file', () => {
  it('creates the schema, points search_path at it, runs the DDL and drops it on close', async () => {
    const observer = track(await openSharedTestDatabase());
    const schema = newSchemaName('tdb');
    const database = await openTestSchema({
      schema,
      ddl: ['create table things (id integer primary key, title text)'],
    });
    expect(database.schema).toBe(schema);
    expect(await schemaExists(observer, schema)).toBe(true);

    // unqualified: the table is found through search_path alone
    await database.pool.query("insert into things values (1, 'a')");
    const { rows } = await database.pool.query<{ title: string }>('select title from things');
    expect(rows).toEqual([{ title: 'a' }]);
    const owner = await observer.pool.query<{ table_schema: string }>(
      "select table_schema from information_schema.tables where table_name = 'things' and table_schema = $1",
      [schema],
    );
    expect(owner.rows).toHaveLength(1);

    await database.close();
    expect(await schemaExists(observer, schema)).toBe(false);
    await expect(database.close()).resolves.toBeUndefined();
  });

  it('drops the schema when the DDL fails and reports the failure', async () => {
    const observer = track(await openSharedTestDatabase());
    const schema = newSchemaName('tdb');
    await expect(openTestSchema({ schema, ddl: ['create table broken ('] })).rejects.toThrow(
      /syntax/,
    );
    expect(await schemaExists(observer, schema)).toBe(false);
  });

  it('gives two files two separate schemas', async () => {
    const a = track(
      await openTestSchema({ schema: newSchemaName('tdb'), ddl: ['create table t (x int)'] }),
    );
    const b = track(
      await openTestSchema({ schema: newSchemaName('tdb'), ddl: ['create table t (x int)'] }),
    );
    await a.pool.query('insert into t values (1)');
    const { rows } = await b.pool.query('select x from t');
    expect(rows).toEqual([]);
  });
});

describe('shared schema', () => {
  it('connects to the DB_SCHEMA of the test database and creates and drops nothing', async () => {
    const database = track(await openSharedTestDatabase());
    const { rows } = await database.pool.query<{ db: string; path: string }>(
      'select current_database() as db, current_schema() as path',
    );
    expect(rows[0]?.db).toMatch(/test/);
    expect(rows[0]?.path).toBe(database.schema);
    await database.close();
    await expect(database.close()).resolves.toBeUndefined();
  });
});
