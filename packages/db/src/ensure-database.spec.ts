import { ensureDatabase } from './ensure-database';

function fakeClient(existing: string[]) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  return {
    calls,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT 1 FROM pg_database'))
        return { rowCount: existing.includes(String(params?.[0])) ? 1 : 0 };
      return { rowCount: null };
    },
  };
}

describe('ensureDatabase', () => {
  it('creates the database when it is missing, with a quoted identifier', async () => {
    const client = fakeClient(['auth']);
    await expect(ensureDatabase(client, 'order', () => {})).resolves.toBe('created');
    expect(client.calls.map((c) => c.sql)).toEqual([
      'SELECT 1 FROM pg_database WHERE datname = $1',
      'CREATE DATABASE "order"',
    ]);
  });

  it('does nothing when it exists', async () => {
    const client = fakeClient(['auth']);
    await expect(ensureDatabase(client, 'auth', () => {})).resolves.toBe('exists');
    expect(client.calls).toHaveLength(1);
  });

  it('rejects names that are not plain identifiers', async () => {
    await expect(ensureDatabase(fakeClient([]), 'x; drop', () => {})).rejects.toThrow(/invalid/);
  });
});
