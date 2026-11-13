// QRY-18: NULL, the quantifiers and the limits on a real Postgres. The tables are made by the test in a schema of
// its own and dropped afterwards (ADR-050 item 12).
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FilterOf } from '../src/core/index.js';
import { OrderStatus, type userFilter } from '../src/core/fixtures.js';
import { compile } from '../src/drizzle/index.js';
import { type TestDatabase, openTestDatabase } from './db.js';
import { SCHEMA, ddl, groups, orders, userBinding, users } from './schema.js';

type UserFilter = FilterOf<typeof userFilter>;

// Ann (1) has a middle name, a group of legal entity 123 and a paid and an unpaid order.
// Bob (2) has no middle name, the same group and one paid order.
// Cat (3) has a middle name, no age, no group and no orders.
// Dan (4) has no middle name, another group and one order whose `paid` is NULL.
const ANN = 1;
const BOB = 2;
const CAT = 3;
const DAN = 4;

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase(SCHEMA, ddl);
  const { db } = database;
  await db.insert(groups).values([
    { id: 1, title: 'g1', legalEntityId: 123 },
    { id: 2, title: 'g2', legalEntityId: 456 },
  ]);
  await db.insert(users).values([
    { id: ANN, name: 'Ann', middleName: 'M', age: 10, groupId: 1, active: true, status: 'new' },
    { id: BOB, name: 'Bob', middleName: null, age: 20, groupId: 1, active: false, status: 'paid' },
    { id: CAT, name: 'Cat', middleName: 'X', age: null, groupId: null, active: null, status: null },
    { id: DAN, name: 'Dan', middleName: null, age: 30, groupId: 2, active: true, status: 'new' },
  ]);
  await db.insert(orders).values([
    { id: 1, userId: ANN, paid: true, total: '10.50' },
    { id: 2, userId: ANN, paid: false, total: '5' },
    { id: 3, userId: BOB, paid: true, total: '7' },
    { id: 4, userId: DAN, paid: null, total: '1' },
  ]);
});

afterAll(async () => {
  await database?.close();
});

const find = async (filter: UserFilter): Promise<number[]> => {
  const rows = await database.db
    .select({ id: users.id })
    .from(users)
    .where(compile(userBinding, filter))
    .orderBy(users.id);
  return rows.map((row) => row.id);
};

describe('NULL follows plain SQL (QRY-14)', () => {
  it('eq and neq skip rows with NULL', async () => {
    expect(await find({ middleName: { operator: 'eq', value: 'M' } })).toEqual([ANN]);
    expect(await find({ middleName: { operator: 'neq', value: 'M' } })).toEqual([CAT]);
  });

  it('isnull and nisnull find them; OR isnull brings them back', async () => {
    expect(await find({ middleName: { operator: 'isnull' } })).toEqual([BOB, DAN]);
    expect(await find({ middleName: { operator: 'nisnull' } })).toEqual([ANN, CAT]);
    expect(
      await find({
        OR: [
          { middleName: { operator: 'neq', value: 'M' } },
          { middleName: { operator: 'isnull' } },
        ],
      }),
    ).toEqual([BOB, CAT, DAN]);
  });

  it('in and nin skip rows with NULL, nin of an empty list too', async () => {
    const { New, Paid } = OrderStatus;
    expect(await find({ status: { operator: 'in', value: [New, Paid] } })).toEqual([ANN, BOB, DAN]);
    expect(await find({ status: { operator: 'nin', value: [New] } })).toEqual([BOB]);
    expect(await find({ status: { operator: 'in', value: [] } })).toEqual([]);
    expect(await find({ status: { operator: 'nin', value: [] } })).toEqual([ANN, BOB, DAN]);
    expect(await find({ NOT: { status: { operator: 'in', value: [] } } })).toEqual([ANN, BOB, DAN]);
  });

  it('between includes both bounds, nbetween skips them and rows with NULL', async () => {
    expect(await find({ age: { operator: 'between', value: [10, 20] } })).toEqual([ANN, BOB]);
    expect(await find({ age: { operator: 'nbetween', value: [10, 20] } })).toEqual([DAN]);
    expect(await find({ age: { operator: 'nbetween', value: [15, 25] } })).toEqual([ANN, DAN]);
  });

  it('comparison operators and NOT skip rows with NULL', async () => {
    expect(await find({ age: { operator: 'gt', value: 10 } })).toEqual([BOB, DAN]);
    expect(await find({ age: { operator: 'lte', value: 20 } })).toEqual([ANN, BOB]);
    expect(await find({ NOT: { age: { operator: 'eq', value: 10 } } })).toEqual([BOB, DAN]);
  });

  it('compares booleans, enums, decimals and dates by the column type', async () => {
    expect(await find({ active: { operator: 'eq', value: true } })).toEqual([ANN, DAN]);
    expect(await find({ status: { operator: 'in', value: [OrderStatus.New] } })).toEqual([
      ANN,
      DAN,
    ]);
    expect(
      await find({ orders: { some: { total: { operator: 'between', value: ['6', '10.5'] } } } }),
    ).toEqual([ANN, BOB]);
  });
});

describe('relations compile to EXISTS (QRY-11, QRY-13)', () => {
  const paid = { paid: { operator: 'eq', value: true } } as const;

  it('some', async () => {
    expect(await find({ orders: { some: paid } })).toEqual([ANN, BOB]);
  });

  it('none: a NULL condition does not make a row match', async () => {
    expect(await find({ orders: { none: paid } })).toEqual([CAT, DAN]);
  });

  it('every is true on an empty relation and false when the condition is NULL', async () => {
    // Ann has an unpaid order, Bob has only paid ones, Cat has none, Dan's only order has paid = NULL.
    expect(await find({ orders: { every: paid } })).toEqual([BOB, CAT]);
  });

  it('NOT over a relation is NOT EXISTS, so rows without a related record match', async () => {
    expect(await find({ NOT: { orders: { some: paid } } })).toEqual([CAT, DAN]);
    expect(
      await find({ NOT: { group: { legalEntityId: { operator: 'eq', value: 123 } } } }),
    ).toEqual([CAT, DAN]);
  });

  it('a one-to-one relation filters by the related row and never multiplies the root', async () => {
    expect(await find({ group: { legalEntityId: { operator: 'eq', value: 123 } } })).toEqual([
      ANN,
      BOB,
    ]);
    const rows = await database.db
      .select({ id: users.id })
      .from(users)
      .where(compile(userBinding, { orders: { some: { total: { operator: 'gte', value: '0' } } } }))
      .limit(10);
    expect(rows.map((row) => row.id).sort()).toEqual([ANN, BOB, DAN]);
  });

  it('nests logic inside a relation', async () => {
    expect(
      await find({
        orders: {
          some: {
            OR: [paid, { total: { operator: 'lt', value: '2' } }],
          },
        },
      }),
    ).toEqual([ANN, BOB, DAN]);
  });
});

describe('scope stays outside the filter (QRY-17)', () => {
  it('and(scope, filter): a filter cannot widen the scope', async () => {
    const scope = eq(users.groupId, 1);
    const filter = compile(userBinding, {
      OR: [{ name: { operator: 'eq', value: 'Ann' } }, { name: { operator: 'eq', value: 'Dan' } }],
    });
    const rows = await database.db
      .select({ id: users.id })
      .from(users)
      .where(and(scope, filter))
      .orderBy(users.id);
    expect(rows.map((row) => row.id)).toEqual([ANN]);
  });
});

describe('values are parameters (QRY-15)', () => {
  it('a value that looks like SQL matches nothing and breaks nothing', async () => {
    expect(await find({ name: { operator: 'eq', value: `x' or '1'='1` } })).toEqual([]);
    expect(
      await find({ name: { operator: 'eq', value: `Ann'; drop table ${SCHEMA}.users; --` } }),
    ).toEqual([]);
    const { rows } = await database.pool.query<{ n: number }>(
      `select count(*)::int as n from ${SCHEMA}.users`,
    );
    expect(rows[0]?.n).toBe(4);
  });
});

describe('limits are checked again by compile (QRY-16)', () => {
  it('refuses a filter nested too deep before it reaches the database', () => {
    let node: UserFilter = { age: { operator: 'eq', value: 1 } };
    for (let level = 0; level < 6; level += 1) node = { NOT: node };
    expect(() => compile(userBinding, node)).toThrow(RangeError);
  });

  it('refuses a list that is too long', () => {
    const value = Array.from({ length: 1001 }, (_, index) => index);
    expect(() => compile(userBinding, { age: { operator: 'in', value } })).toThrow(RangeError);
  });

  it('accepts a list at the limit', async () => {
    const value = Array.from({ length: 1000 }, (_, index) => 1000 + index);
    expect(await find({ age: { operator: 'in', value } })).toEqual([]);
  });
});

describe('the database', () => {
  it('is a test database and the tables are in a schema of their own', async () => {
    const { rows } = await database.pool.query<{ name: string }>(
      'select current_database() as name',
    );
    expect(rows[0]?.name).toMatch(/test/);
  });
});
