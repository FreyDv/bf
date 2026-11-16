// A relation to the table of the node itself and one table on two levels of one path (ADR-069), on a real Postgres:
// QRY-11 (EXISTS, indexed foreign key) and QRY-13 (every is true on an empty relation, NULL is a violation).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FilterOf } from '../src/core/index.js';
import { compile } from '../src/drizzle/index.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { type TestDatabase, openTestSchema } from '@bf/test-db';
import { TREE_SCHEMA, categories, categoryBinding, categoryFilter, treeDdl } from './tree.js';

type CategoryFilter = FilterOf<typeof categoryFilter>;

// 1 A
// +- 2 B
// |  +- 4 D
// |  |  +- 6 F
// |  +- 5 E
// +- 3 C
//    +- 7 (no name)
const A = 1;
const B = 2;
const C = 3;
const D = 4;
const E = 5;
const F = 6;
const G = 7;

let database: TestDatabase;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  database = await openTestSchema({ schema: TREE_SCHEMA, ddl: treeDdl });
  db = drizzle(database.pool);
  await db.insert(categories).values([
    { id: A, name: 'A', parentId: null },
    { id: B, name: 'B', parentId: A },
    { id: C, name: 'C', parentId: A },
    { id: D, name: 'D', parentId: B },
    { id: E, name: 'E', parentId: B },
    { id: F, name: 'F', parentId: D },
    { id: G, name: null, parentId: C },
  ]);
});

afterAll(async () => {
  await database?.close();
});

const find = async (filter: CategoryFilter): Promise<number[]> => {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(compile(categoryBinding, filter))
    .orderBy(categories.id);
  return rows.map((row) => row.id);
};

const name = (value: string) => ({ name: { operator: 'eq', value } }) as const;

describe('a relation to the table of the node (parent, children)', () => {
  it('some: a child with the name', async () => {
    expect(await find({ children: { some: name('D') } })).toEqual([B]);
    expect(await find({ children: { some: { OR: [name('D'), name('C')] } } })).toEqual([A, B]);
  });

  it('none: no child with the name; leaves match', async () => {
    expect(await find({ children: { none: name('D') } })).toEqual([A, C, D, E, F, G]);
  });

  it('every is true without children and false when a child has a NULL name (QRY-13)', async () => {
    // B: D and E pass. C: its only child has no name, so the condition is NULL, a violation. A: B is a child.
    // D has F; E, F, G have no children.
    expect(await find({ children: { every: { name: { operator: 'neq', value: 'B' } } } })).toEqual([
      B,
      D,
      E,
      F,
      G,
    ]);
  });

  it('the parent: one-to-one, a root has none', async () => {
    expect(await find({ parent: name('B') })).toEqual([D, E]);
    expect(await find({ NOT: { parent: name('B') } })).toEqual([A, B, C, F, G]);
  });

  it('never multiplies the root', async () => {
    const rows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        compile(categoryBinding, { children: { some: { name: { operator: 'neq', value: 'x' } } } }),
      )
      .limit(10);
    expect(rows.map((row) => row.id).sort()).toEqual([A, B, D]);
  });
});

describe('one table on two levels of one path (parent.parent)', () => {
  it('the grandparent', async () => {
    expect(await find({ parent: { parent: name('A') } })).toEqual([D, E, G]);
    expect(await find({ parent: { parent: name('B') } })).toEqual([F]);
  });

  it('both levels and the children in one filter', async () => {
    expect(await find({ parent: { ...name('B'), parent: name('A') } })).toEqual([D, E]);
    expect(await find({ parent: name('B'), children: { some: name('F') } })).toEqual([D]);
  });

  it('NOT over the grandparent: rows without one match', async () => {
    expect(await find({ NOT: { parent: { parent: name('A') } } })).toEqual([A, B, C, F]);
  });
});
