import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FilterOf } from '../core/index.js';
import type { userFilter } from '../core/fixtures.js';
import { SCHEMA, userBinding } from '../../test/schema.js';
import { compile } from './index.js';

type UserFilter = FilterOf<typeof userFilter>;

const render = (filter: UserFilter, options?: Parameters<typeof compile>[2]) =>
  new PgDialect().sqlToQuery(compile(userBinding, filter, options));

const u = (column: string) => `"${SCHEMA}"."users"."${column}"`;
const o = (column: string) => `"${SCHEMA}"."orders"."${column}"`;

describe('compile: operators', () => {
  it('writes a comparison with the value as a parameter', () => {
    expect(render({ age: { operator: 'gte', value: 18 } })).toMatchObject({
      sql: `((${u('age')} >= $1))`,
      params: [18],
    });
  });

  it('writes in, nin, between and nbetween', () => {
    expect(render({ age: { operator: 'in', value: [1, 2] } }).sql).toBe(
      `((${u('age')} in ($1, $2)))`,
    );
    expect(render({ age: { operator: 'nin', value: [1, 2] } }).sql).toBe(
      `((${u('age')} not in ($1, $2)))`,
    );
    expect(render({ age: { operator: 'between', value: [1, 5] } })).toMatchObject({
      sql: `((${u('age')} between $1 and $2))`,
      params: [1, 5],
    });
    expect(render({ age: { operator: 'nbetween', value: [1, 5] } }).sql).toBe(
      `((${u('age')} not between $1 and $2))`,
    );
  });

  it('writes isnull and nisnull without a parameter', () => {
    expect(render({ middleName: { operator: 'isnull' } })).toMatchObject({
      sql: `((${u('middle_name')} is null))`,
      params: [],
    });
    expect(render({ middleName: { operator: 'nisnull' } }).sql).toBe(
      `((${u('middle_name')} is not null))`,
    );
  });

  it('keeps a value out of the text, whatever it holds', () => {
    const attack = `x'); drop table users; --`;
    const query = render({ name: { operator: 'eq', value: attack } });
    expect(query.sql).not.toContain('drop');
    expect(query.params).toEqual([attack]);
  });

  it('turns an empty list into a condition that agrees with NULL and NOT', () => {
    expect(render({ age: { operator: 'in', value: [] } }).sql).toContain(
      `case when ${u('age')} is null then null else false end`,
    );
    expect(render({ age: { operator: 'nin', value: [] } }).sql).toContain(
      `case when ${u('age')} is null then null else true end`,
    );
  });
});

describe('compile: logic', () => {
  it('combines the keys of a node with and, and nests AND, OR and NOT', () => {
    const query = render({
      age: { operator: 'eq', value: 1 },
      OR: [
        { name: { operator: 'eq', value: 'a' } },
        { NOT: { name: { operator: 'eq', value: 'b' } } },
      ],
    });
    expect(query.sql).toBe(
      `((${u('age')} = $1) and (((${u('name')} = $2)) or (not ((${u('name')} = $3)))))`,
    );
    expect(query.params).toEqual([1, 'a', 'b']);
  });
});

describe('compile: relations (QRY-11, QRY-13)', () => {
  const orderOn = `("${SCHEMA}"."orders"."user_id" = "${SCHEMA}"."users"."id")`;

  it('writes some as exists, none as not exists, one-to-one as exists', () => {
    const paid = { paid: { operator: 'eq', value: true } } as const;
    expect(render({ orders: { some: paid } }).sql).toBe(
      `(exists (select 1 from "${SCHEMA}"."orders" where ${orderOn} and ((${o('paid')} = $1))))`,
    );
    expect(render({ orders: { none: paid } }).sql).toBe(
      `(not exists (select 1 from "${SCHEMA}"."orders" where ${orderOn} and ((${o('paid')} = $1))))`,
    );
    expect(render({ group: { title: { operator: 'eq', value: 'g' } } }).sql).toMatch(
      /^\(exists \(select 1 from ".*"."groups" where /,
    );
  });

  it('writes every as not exists of the rows where the condition is not true', () => {
    expect(render({ orders: { every: { paid: { operator: 'eq', value: true } } } }).sql).toBe(
      `(not exists (select 1 from "${SCHEMA}"."orders" where ${orderOn} and ((${o('paid')} = $1)) is not true))`,
    );
  });

  it('writes NOT over a relation as not exists', () => {
    expect(
      render({ NOT: { orders: { some: { paid: { operator: 'eq', value: true } } } } }).sql,
    ).toMatch(/^\(not \(exists \(select 1 /);
  });
});

describe('compile: a filter that does not fit', () => {
  it('rejects what a hand-built filter may get wrong, before any SQL', () => {
    const bad: Array<[string, unknown]> = [
      ['an empty node', {}],
      ['an unknown field', { nope: { operator: 'eq', value: 1 } }],
      ['a prototype key', JSON.parse('{"constructor": {"operator": "eq", "value": 1}}')],
      ['an operator the field does not allow', { name: { operator: 'gt', value: 'a' } }],
      ['a value of another kind', { age: { operator: 'eq', value: '1' } }],
      ['a value of oneOf outside the list', { status: { operator: 'eq', value: 'cancelled' } }],
      ['a value on isnull', { middleName: { operator: 'isnull', value: 1 } }],
      ['a pair of three', { age: { operator: 'between', value: [1, 2, 3] } }],
      ['an empty AND', { AND: [] }],
      [
        'a relation with two quantifiers',
        {
          orders: {
            some: { paid: { operator: 'eq', value: true } },
            none: { paid: { operator: 'eq', value: true } },
          },
        },
      ],
      ['a relation with none', { orders: {} }],
    ];
    for (const [label, filter] of bad) {
      expect(() => render(filter as UserFilter), label).toThrow(TypeError);
    }
  });
});

describe('compile: limits (QRY-16)', () => {
  const nested = (depth: number): UserFilter => {
    let node: UserFilter = { age: { operator: 'eq', value: 1 } };
    for (let i = 0; i < depth; i += 1) node = { NOT: node };
    return node;
  };

  it('accepts the default and refuses one level more', () => {
    expect(() => render(nested(5))).not.toThrow();
    expect(() => render(nested(6))).toThrow(RangeError);
  });

  it('refuses a list longer than the limit, and a tighter limit of the query', () => {
    const list = Array.from({ length: 1001 }, (_, index) => index);
    expect(() => render({ age: { operator: 'in', value: list } })).toThrow(RangeError);
    expect(() => render(nested(3), { limits: { maxLogicalDepth: 2 } })).toThrow(RangeError);
  });

  it('never loosens a limit', () => {
    expect(() => render(nested(1), { limits: { maxLogicalDepth: 6 } })).toThrow(RangeError);
  });
});

describe('QRY-15: no raw SQL', () => {
  it('does not use sql.raw or sql.identifier in the entry', () => {
    const dir = join(import.meta.dirname);
    const sources = readdirSync(dir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      // comments may name what is forbidden
      const text = readFileSync(join(dir, name), 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
      expect(text, name).not.toMatch(/\.raw\(|\.identifier\(|\bsql\.raw\b/);
    }
  });
});
