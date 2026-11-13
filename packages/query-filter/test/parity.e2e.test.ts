// What `toZod(S)` accepts, `compile` accepts, and the other way round on the limits: the schema and the compiler
// read the same spec and the same limit code (ADR-050 item 6).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userFilter } from '../src/core/fixtures.js';
import { compile } from '../src/drizzle/index.js';
import { toZod } from '../src/zod/index.js';
import { type TestDatabase, openTestDatabase } from './db.js';
import { SCHEMA, ddl, users, userBinding } from './schema.js';

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase(SCHEMA, ddl);
});

afterAll(async () => {
  await database?.close();
});

const schema = toZod(userFilter);

const accepted: Array<[string, unknown]> = [
  ['a condition', { age: { operator: 'between', value: [1, 5] } }],
  [
    'dates and ids',
    {
      birthday: { operator: 'gte', value: '2000-01-31' },
      createdAt: { operator: 'lt', value: '2026-11-13T10:00:00Z' },
      ref: { operator: 'in', value: ['6f1f3b0e-6a0e-4b1d-8d4e-2f9a5c1d7b10'] },
    },
  ],
  [
    'logic and relations',
    {
      OR: [
        { middleName: { operator: 'isnull' } },
        { NOT: { name: { operator: 'eq', value: 'x' } } },
      ],
      group: { legalEntityId: { operator: 'eq', value: 123 } },
      orders: { every: { paid: { operator: 'eq', value: true } } },
    },
  ],
  ['an empty list', { age: { operator: 'nin', value: [] } }],
];

describe('toZod and compile agree', () => {
  for (const [label, filter] of accepted) {
    it(`${label}: parsed by the schema, compiled, and run by Postgres`, async () => {
      const parsed = schema.safeParse(filter);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const rows = await database.db
        .select({ id: users.id })
        .from(users)
        .where(compile(userBinding, parsed.data));
      expect(rows).toEqual([]);
    });
  }

  it('what the schema rejects as too deep, compile rejects too', () => {
    let node: unknown = { age: { operator: 'eq', value: 1 } };
    for (let level = 0; level < 6; level += 1) node = { NOT: node };
    expect(schema.safeParse(node).success).toBe(false);
    expect(() => compile(userBinding, node as never)).toThrow(RangeError);
  });
});
