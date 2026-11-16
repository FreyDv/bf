import { describe, expect, it } from 'vitest';
import {
  assertConnectedToTestDatabase,
  assertTestDatabase,
  newSchemaName,
  openSharedTestDatabase,
  openTestSchema,
} from './index.js';

// A server that is not there: a test that reaches the connection step fails with ECONNREFUSED, not with TST-3.
const unreachable = (name: string) => ({
  DB_HOST: '127.0.0.1',
  DB_PORT: '1',
  DB_NAME: name,
  DB_SCHEMA: 'public',
  DB_SSL_MODE: 'disable',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
});

describe('TST-3 guard, step one: the configured name', () => {
  it('accepts a name that marks a test database', () => {
    for (const name of ['bf_test', 'test', 'bf-test-2', 'TEST_db']) {
      expect(() => assertTestDatabase(name), name).not.toThrow();
    }
  });

  it('refuses every other name', () => {
    for (const name of ['bf_dev', 'bfdb', 'defaultdb', 'latest', 'contest', 'bf_testing', '']) {
      expect(() => assertTestDatabase(name), name).toThrow(/TST-3/);
    }
  });

  it('refuses a non-test name before any connection, in both modes', async () => {
    const env = unreachable('bf_dev');
    await expect(openTestSchema({ env, schema: newSchemaName('tdb'), ddl: [] })).rejects.toThrow(
      /TST-3/,
    );
    await expect(openSharedTestDatabase({ env })).rejects.toThrow(/TST-3/);
  });

  it('reaches the connection when the name is a test name', async () => {
    const env = unreachable('bf_test');
    await expect(openSharedTestDatabase({ env })).rejects.toThrow(/ECONNREFUSED|connect/);
  });

  it('names the missing variables and points at pnpm local:up', async () => {
    await expect(openSharedTestDatabase({ env: {} })).rejects.toThrow(/DB_HOST.*pnpm local:up/s);
  });
});

describe('TST-3 guard, step two: the database the server reports', () => {
  const reports = (name: unknown) => ({ query: () => Promise.resolve({ rows: [{ name }] }) });

  it('accepts a test database', async () => {
    await expect(assertConnectedToTestDatabase(reports('bf_test'))).resolves.toBeUndefined();
  });

  it('refuses a database that is not a test database', async () => {
    await expect(assertConnectedToTestDatabase(reports('bf_prod'))).rejects.toThrow(/TST-3/);
  });

  it('refuses an answer that is not a name', async () => {
    await expect(assertConnectedToTestDatabase(reports(undefined))).rejects.toThrow(/TST-3/);
    await expect(
      assertConnectedToTestDatabase({ query: () => Promise.resolve({ rows: [] }) }),
    ).rejects.toThrow(/TST-3/);
  });
});

describe('schema names', () => {
  it('are the prefix and 8 hex digits, different every time', () => {
    const first = newSchemaName('qf');
    expect(first).toMatch(/^qf_[0-9a-f]{8}$/);
    expect(newSchemaName('qf')).not.toBe(first);
  });

  it('refuse a prefix that is not a plain lower-case word', () => {
    for (const prefix of ['', 'Qf', 'q f', 'q;drop', '1qf', 'a'.repeat(17)]) {
      expect(() => newSchemaName(prefix), prefix).toThrow(/prefix/);
    }
  });

  it('are refused by the helper unless the helper could have generated them', async () => {
    await expect(
      openTestSchema({ env: unreachable('bf_test'), schema: 'public', ddl: [] }),
    ).rejects.toThrow(/unexpected schema name/);
  });
});
