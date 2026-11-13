import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { Op, bool, defineFilter, int, relation, str } from '../core/index.js';
import type { FilterOf } from '../core/index.js';
import { OrderStatus, groupFilter, orderFilter, userFilter } from '../core/fixtures.js';
import { toZod } from './index.js';

const schema = toZod(userFilter);
const request = z.object({ filter: schema.optional() }).strict();

const eq = (value: unknown) => ({ operator: 'eq', value });
const paths = (input: unknown, target = schema) => {
  const result = target.safeParse(input);
  return result.success ? null : result.error.issues.map((issue) => issue.path.join('.'));
};
const accepts = (input: unknown, target = schema) => target.safeParse(input).success;

describe('toZod, types (QRY-18)', () => {
  it('infers exactly the type of the spec, for the request and for the router input', () => {
    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<FilterOf<typeof userFilter>>();
    expectTypeOf<z.input<typeof schema>>().toEqualTypeOf<FilterOf<typeof userFilter>>();
    expectTypeOf<z.infer<typeof request>>().toEqualTypeOf<{
      filter?: FilterOf<typeof userFilter> | undefined;
    }>();
    expectTypeOf<z.input<typeof request>>().toEqualTypeOf<z.infer<typeof request>>();
  });

  it('is a Standard Schema with the same input and output, which is what a tRPC procedure reads', () => {
    expectTypeOf<NonNullable<(typeof schema)['~standard']['types']>['input']>().toEqualTypeOf<
      FilterOf<typeof userFilter>
    >();
  });
});

describe('toZod, accepts what the type promises', () => {
  it('takes the request shape of the contract', () => {
    expect(
      accepts({
        status: { operator: 'in', value: [OrderStatus.New] },
        group: { legalEntityId: eq(123) },
        orders: { some: { paid: eq(true) } },
        OR: [
          { age: { operator: 'between', value: [0, 5] } },
          { middleName: { operator: 'isnull' } },
        ],
        NOT: { name: eq('x') },
      }),
    ).toBe(true);
  });

  it('parses a request with and without a filter', () => {
    expect(request.safeParse({}).success).toBe(true);
    expect(request.safeParse({ filter: { name: eq('x') } }).success).toBe(true);
    expect(request.safeParse({ filter: { name: eq('x') }, sort: 'name' }).success).toBe(false);
  });

  it('takes every value builder in its wire form', () => {
    expect(accepts({ birthday: eq('2026-11-13') })).toBe(true);
    expect(accepts({ createdAt: eq('2026-11-13T10:00:00Z') })).toBe(true);
    expect(accepts({ createdAt: eq('2026-11-13T10:00:00.123+02:00') })).toBe(true);
    expect(accepts({ ref: eq('0b6f2f8e-8f0e-4c6f-9a55-3d6f5e1d5b2a') })).toBe(true);
    expect(accepts({ orders: { every: { total: eq('10.50') } } })).toBe(true);
    expect(accepts({ active: eq(false) })).toBe(true);
  });

  it('keeps the parsed value as it came', () => {
    const input = { NOT: { name: eq('x') }, age: { operator: 'in', value: [1, 2] } };
    expect(schema.parse(input)).toEqual(input);
  });

  it('allows every operator of its set and only those (QRY-3)', () => {
    for (const operator of Op.String)
      expect(accepts({ sname: { operator, value: 'a' } })).toBe(true);
    for (const operator of ['gt', 'gte', 'lt', 'lte', 'in', 'nin', 'isnull']) {
      expect(accepts({ sname: { operator, value: 'a' } })).toBe(false);
    }
    expect(accepts({ middleName: { operator: 'nisnull' } })).toBe(true);
    expect(accepts({ active: { operator: 'neq', value: true } })).toBe(false);
  });
});

describe('toZod, rejects what the type forbids', () => {
  it.each([
    ['an unknown field', { password: eq('x') }],
    [
      'an unknown key in a condition',
      { name: { operator: 'eq', value: 'x', mode: 'insensitive' } },
    ],
    ['an unknown operator', { name: { operator: 'like', value: 'x' } }],
    ['no operator', { name: { value: 'x' } }],
    ['a wrong type of value', { age: eq('x') }],
    ['a float where an integer is due', { age: eq(1.5) }],
    ['a number where a string is due', { name: eq(1) }],
    ['a float for a decimal', { orders: { some: { total: eq(10.5) } } }],
    ['a decimal with an exponent', { orders: { some: { total: eq('1e3') } } }],
    ['a date with a time', { birthday: eq('2026-11-13T10:00:00Z') }],
    ['a datetime without a zone', { createdAt: eq('2026-11-13T10:00:00') }],
    ['a bad uuid', { ref: eq('not-a-uuid') }],
    ['an enum member that is not listed', { status: eq(OrderStatus.Cancelled) }],
    ['a list where one value is due', { age: eq([1]) }],
    ['one value where a list is due', { age: { operator: 'in', value: 1 } }],
    ['a range with one bound', { age: { operator: 'between', value: [1] } }],
    ['a range with three bounds', { age: { operator: 'between', value: [1, 2, 3] } }],
    ['a node that is not an object', 'x'],
    ['null', null],
    ['a field that is an array', [{ name: eq('x') }]],
  ])('rejects %s', (_name, input) => {
    expect(accepts(input)).toBe(false);
  });
});

describe('toZod, validation errors of QRY-5', () => {
  it('rejects an empty node, at the root and inside a relation or a logical key', () => {
    expect(accepts({})).toBe(false);
    expect(accepts({ group: {} })).toBe(false);
    expect(accepts({ NOT: {} })).toBe(false);
    expect(accepts({ OR: [{}] })).toBe(false);
    expect(accepts({ orders: { some: {} } })).toBe(false);
  });

  it('rejects an empty AND or OR', () => {
    expect(accepts({ AND: [] })).toBe(false);
    expect(accepts({ OR: [] })).toBe(false);
    expect(accepts({ AND: [{ name: eq('x') }], OR: [{ name: eq('y') }] })).toBe(true);
  });

  it('rejects a value on isnull and nisnull', () => {
    expect(accepts({ middleName: { operator: 'isnull', value: null } })).toBe(false);
    expect(accepts({ middleName: { operator: 'nisnull', value: true } })).toBe(false);
  });

  it('rejects a range whose start is greater than its end, for every kind that is ordered', () => {
    expect(accepts({ age: { operator: 'between', value: [1, 1] } })).toBe(true);
    expect(accepts({ age: { operator: 'between', value: [2, 1] } })).toBe(false);
    expect(accepts({ age: { operator: 'nbetween', value: [2, 1] } })).toBe(false);
    expect(
      accepts({ birthday: { operator: 'between', value: ['2026-02-01', '2026-01-01'] } }),
    ).toBe(false);
    expect(
      accepts({ orders: { some: { total: { operator: 'between', value: ['9.5', '10.25'] } } } }),
    ).toBe(true);
    expect(
      accepts({ orders: { some: { total: { operator: 'between', value: ['10.25', '9.5'] } } } }),
    ).toBe(false);
    expect(
      accepts({ orders: { some: { total: { operator: 'between', value: ['-1', '-0.5'] } } } }),
    ).toBe(true);
    expect(
      accepts({ orders: { some: { total: { operator: 'between', value: ['-0.5', '-1'] } } } }),
    ).toBe(false);
  });

  it('orders datetimes by time, not by text', () => {
    const range = (from: string, to: string) => ({
      createdAt: { operator: 'between', value: [from, to] },
    });
    // 10:00+02:00 is 08:00Z, earlier than 09:00Z although it sorts after it as text.
    expect(accepts(range('2026-11-13T10:00:00+02:00', '2026-11-13T09:00:00Z'))).toBe(true);
    expect(accepts(range('2026-11-13T09:00:00Z', '2026-11-13T10:00:00+02:00'))).toBe(false);
  });

  it('takes exactly one quantifier on a one-to-many relation', () => {
    expect(accepts({ orders: { some: { paid: eq(true) } } })).toBe(true);
    expect(accepts({ orders: { none: { paid: eq(true) } } })).toBe(true);
    expect(accepts({ orders: { every: { paid: eq(true) } } })).toBe(true);
    expect(accepts({ orders: {} })).toBe(false);
    expect(accepts({ orders: { paid: eq(true) } })).toBe(false);
    expect(accepts({ orders: { some: { paid: eq(true) }, none: { paid: eq(true) } } })).toBe(false);
    expect(accepts({ orders: { any: { paid: eq(true) } } })).toBe(false);
  });

  it('returns every violation together, with the path of each (ADP-8)', () => {
    const found = paths({
      age: { operator: 'between', value: [2, 1] },
      middleName: { operator: 'isnull', value: 1 },
      name: eq(5),
      group: {},
    });
    expect(found).toHaveLength(4);
    expect(found).toEqual(
      expect.arrayContaining(['age.value', 'middleName', 'name.value', 'group']),
    );
  });

  it('names an unknown key once, without a second error that the node is empty', () => {
    const result = schema.safeParse({ password: eq('x') });
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['unrecognized_keys']);
    const quantifier = schema.safeParse({ orders: { any: {} } });
    expect(quantifier.error?.issues.map((issue) => issue.code)).toEqual(['unrecognized_keys']);
  });

  it('names the failing branch, not the whole union', () => {
    expect(paths({ age: { operator: 'between', value: ['a', 'b'] } })).toEqual([
      'age.value.0',
      'age.value.1',
    ]);
  });
});

describe('toZod, limits (QRY-16)', () => {
  const not = (depth: number): Record<string, unknown> => {
    let result: Record<string, unknown> = { name: eq('x') };
    for (let level = 0; level < depth; level += 1) result = { NOT: result };
    return result;
  };

  it('accepts a filter at each default limit and rejects one beyond it', () => {
    expect(accepts(not(5))).toBe(true);
    expect(accepts(not(6))).toBe(false);

    const list = (length: number) => ({
      age: { operator: 'in', value: Array.from({ length }, (_, index) => index) },
    });
    expect(accepts(list(1000))).toBe(true);
    expect(accepts(list(1001))).toBe(false);

    expect(accepts({ OR: Array.from({ length: 24 }, () => ({ name: eq('x') })) })).toBe(true);
    expect(accepts({ OR: Array.from({ length: 25 }, () => ({ name: eq('x') })) })).toBe(false);
  });

  it('counts relation levels', () => {
    const middle = defineFilter({ owner: relation.one(userFilter), code: str(Op.eq) });
    const top = defineFilter({ middle: relation.one(middle) });
    const deep = toZod(top);
    expect(accepts({ middle: { owner: { name: eq('x') } } }, deep as never)).toBe(true);
    expect(accepts({ middle: { owner: { group: { title: eq('x') } } } }, deep as never)).toBe(
      false,
    );
    expect(accepts({ middle: { code: eq('x') } }, deep as never)).toBe(true);
  });

  it('reports a limit as an issue with its path, so the caller can tell which one', () => {
    const result = schema.safeParse(not(6));
    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect(issue).toMatchObject({ code: 'custom', params: { limit: 'maxLogicalDepth', max: 5 } });
  });

  it('lets a query tighten a limit and refuses to loosen one', () => {
    const tight = toZod(userFilter, { limits: { maxNodes: 3, maxListSize: 2 } });
    expect(accepts({ name: eq('x') }, tight)).toBe(true);
    expect(accepts({ OR: [{ name: eq('x') }, { name: eq('y') }] }, tight)).toBe(false);
    expect(accepts({ age: { operator: 'in', value: [1, 2, 3] } }, tight)).toBe(false);
    expect(() => toZod(userFilter, { limits: { maxNodes: 51 } })).toThrow(RangeError);
  });

  it('refuses a body nested far beyond the limit without recursing into it', () => {
    const result = schema.safeParse(not(100_000));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
  });

  it('reports a limit and not the structure when both are wrong', () => {
    const result = schema.safeParse({ ...not(6), password: 1 });
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['custom']);
  });
});

describe('toZod, building the schema', () => {
  it('works for a spec with one relation level and one operator per field', () => {
    const small = defineFilter({
      done: bool(Op.Bool),
      n: int(Op.eq),
      group: relation.one(groupFilter),
    });
    const result = toZod(small);
    expect(accepts({ done: eq(true), group: { title: eq('x') } }, result as never)).toBe(true);
    expect(accepts({ done: eq(1) }, result as never)).toBe(false);
  });

  it('shares a relation spec between two fields', () => {
    const twice = defineFilter({
      first: relation.many(orderFilter),
      second: relation.many(orderFilter),
    });
    expect(accepts({ second: { none: { paid: eq(true) } } }, toZod(twice) as never)).toBe(true);
  });
});
