import { describe, expect, expectTypeOf, it } from 'vitest';
import { OrderStatus, groupFilter, orderFilter, userFilter } from './fixtures.js';
import {
  DEFAULT_LIMITS,
  Op,
  type FilterOf,
  bool,
  checkLimits,
  date,
  decimal,
  defineFilter,
  int,
  oneOf,
  relation,
  resolveLimits,
  str,
  uuid,
} from './index.js';

type UserFilter = FilterOf<typeof userFilter>;

/** The body is compiled, never run: a line that must not compile would otherwise also throw at runtime. */
const typeOnly = (body: () => void): void => {
  void body;
};

describe('operators', () => {
  it('spells an operator as the plain string the wire carries', () => {
    expect(Op.in).toBe('in');
    expect(Op.nbetween).toBe('nbetween');
  });

  it('keeps the shared sets of the contract table', () => {
    expect(Op.String).toEqual(['eq', 'neq']);
    expect(Op.Bool).toEqual(['eq']);
    expect(Op.Null).toEqual(['isnull', 'nisnull']);
    expect(Op.Number).toContain('between');
    expect(Op.Number).toContain('in');
    expect(Op.Date).not.toContain('in');
    expect(Op.Id).toEqual(['eq', 'neq', 'in', 'nin']);
    expect(Op.Enum).toEqual(Op.Id);
  });

  it('freezes the sets, so one module cannot change them for the others (QRY-4)', () => {
    expect(Object.isFrozen(Op)).toBe(true);
    expect(Object.isFrozen(Op.String)).toBe(true);
  });
});

describe('value builders', () => {
  it('mix sets and single operators and drop repeats', () => {
    const field = str(Op.String, Op.isnull, Op.nisnull, Op.eq);
    expect(field).toEqual({ kind: 'str', operators: ['eq', 'neq', 'isnull', 'nisnull'] });
  });

  it('build plain data with no function in it', () => {
    expect(JSON.parse(JSON.stringify(userFilter))).toMatchObject({
      fields: { age: { kind: 'int' }, group: { kind: 'relation-one' } },
    });
  });

  it('read the values of a string enum and of an array', () => {
    expect(orderFilter.fields.status.values).toEqual(['new', 'paid', 'cancelled']);
    expect(userFilter.fields.status.values).toEqual(['new', 'paid']);
  });

  it('refuse an empty list of values and a numeric enum at runtime too', () => {
    expect(() => oneOf([] as unknown as readonly [string, ...string[]], Op.Enum)).toThrow(
      /at least one value/,
    );
    enum Numeric {
      A,
      B,
    }
    expect(() => oneOf(Numeric as unknown as Record<string, string>, Op.Enum)).toThrow(
      /numeric enum/,
    );
  });

  it('refuse a field with no operator', () => {
    expect(() => (str as (...operators: unknown[]) => unknown)()).toThrow(/at least one operator/);
  });

  it('refuse a name reserved for the logical keys', () => {
    expect(() => defineFilter({ AND: str(Op.eq) } as never)).toThrow(/reserved/);
    expect(() => defineFilter({} as never)).toThrow(/at least one field/);
    expect(() => defineFilter({ name: { kind: 'nope' } } as never)).toThrow(/value builders/);
  });
});

describe('FilterOf (QRY-18, type level)', () => {
  it('types value by the kind of the field, one member per operator', () => {
    type Age = NonNullable<UserFilter['age']>;
    expectTypeOf<Age['operator']>().toEqualTypeOf<
      'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between' | 'nbetween'
    >();
    expectTypeOf<Extract<Age, { operator: 'gt' }>>().toEqualTypeOf<{
      operator: 'gt';
      value: number;
    }>();
    expectTypeOf<Extract<Age, { operator: 'in' }>>().toEqualTypeOf<{
      operator: 'in';
      value: number[];
    }>();
    expectTypeOf<Extract<Age, { operator: 'nbetween' }>>().toEqualTypeOf<{
      operator: 'nbetween';
      value: [number, number];
    }>();

    type Active = NonNullable<UserFilter['active']>;
    expectTypeOf<Active>().toEqualTypeOf<{ operator: 'eq'; value: boolean }>();

    type Middle = NonNullable<UserFilter['middleName']>;
    expectTypeOf<Middle['operator']>().toEqualTypeOf<'eq' | 'neq' | 'isnull' | 'nisnull'>();
    expectTypeOf<Extract<Middle, { operator: 'isnull' }>>().toEqualTypeOf<{ operator: 'isnull' }>();

    type Birthday = NonNullable<UserFilter['birthday']>;
    expectTypeOf<Extract<Birthday, { operator: 'gte' }>['value']>().toEqualTypeOf<string>();
    type Total = NonNullable<FilterOf<typeof orderFilter>['total']>;
    expectTypeOf<Extract<Total, { operator: 'eq' }>['value']>().toEqualTypeOf<string>();
  });

  it('types oneOf by the enum, or by the listed members only', () => {
    type Status = NonNullable<FilterOf<typeof orderFilter>['status']>;
    expectTypeOf<Extract<Status, { operator: 'eq' }>['value']>().toEqualTypeOf<OrderStatus>();

    type Listed = NonNullable<UserFilter['status']>;
    expectTypeOf<Extract<Listed, { operator: 'in' }>['value']>().toEqualTypeOf<
      (OrderStatus.New | OrderStatus.Paid)[]
    >();

    const literal = defineFilter({ kind: oneOf(['a', 'b'] as const, Op.Enum) });
    expect(literal.fields.kind.values).toEqual(['a', 'b']);
    type Kind = NonNullable<FilterOf<typeof literal>['kind']>;
    expectTypeOf<Extract<Kind, { operator: 'eq' }>['value']>().toEqualTypeOf<'a' | 'b'>();
  });

  it('shapes relations: one is a node, many takes exactly one quantifier', () => {
    expectTypeOf<UserFilter['group']>().toEqualTypeOf<FilterOf<typeof groupFilter> | undefined>();
    expectTypeOf<UserFilter['orders']>().toEqualTypeOf<
      | { some: FilterOf<typeof orderFilter> }
      | { none: FilterOf<typeof orderFilter> }
      | { every: FilterOf<typeof orderFilter> }
      | undefined
    >();
  });

  it('accepts the request shape of the contract', () => {
    const filter = {
      status: { operator: 'in', value: [OrderStatus.New] },
      group: { legalEntityId: { operator: 'eq', value: 123 } },
      orders: { some: { paid: { operator: 'eq', value: true } } },
      OR: [{ age: { operator: 'between', value: [0, 5] } }, { middleName: { operator: 'isnull' } }],
      NOT: { name: { operator: 'eq', value: 'x' } },
    } satisfies UserFilter;
    expect(filter).toBeDefined();
  });

  it('does not compile an operator the field does not allow, or a wrong value', () => {
    // @ts-expect-error gt is not in Op.String
    const gt: UserFilter = { sname: { operator: 'gt', value: 'a' } };
    // @ts-expect-error a string is not a number
    const wrong: UserFilter = { age: { operator: 'eq', value: 'x' } };
    // @ts-expect-error isnull takes no value
    const nullValue: UserFilter = { middleName: { operator: 'isnull', value: 1 } };
    // @ts-expect-error a range is a pair
    const range: UserFilter = { age: { operator: 'between', value: [1] } };
    // @ts-expect-error unknown field: the spec is an allowlist (QRY-3)
    const unknown: UserFilter = { password: { operator: 'eq', value: 'x' } };
    // @ts-expect-error a member that was not listed does not reach the API
    const unlisted: UserFilter = { status: { operator: 'eq', value: OrderStatus.Cancelled } };
    // @ts-expect-error a one-to-many relation takes a quantifier
    const bare: UserFilter = { orders: { paid: { operator: 'eq', value: true } } };
    expect([gt, wrong, nullValue, range, unknown, unlisted, bare]).toHaveLength(7);
  });

  it('does not compile comparison operators on bool, uuid and oneOf', () => {
    typeOnly(() => {
      // @ts-expect-error QRY: gt does not compile on bool
      bool(Op.gt);
      // @ts-expect-error QRY: between does not compile on uuid
      uuid(Op.between);
      // @ts-expect-error QRY: a set that holds gt does not compile on oneOf
      oneOf(['a'] as const, Op.Number);
      // @ts-expect-error the Date set holds comparison operators
      bool(Op.Date);
    });
  });

  it('does not compile a field without an operator, a numeric enum, an empty array or a logical field name', () => {
    enum Numeric {
      A,
      B,
    }
    typeOnly(() => {
      // @ts-expect-error a field needs an operator
      str();
      // @ts-expect-error a numeric enum has reverse keys
      oneOf(Numeric, Op.Enum);
      // @ts-expect-error a non-empty array is required
      oneOf([], Op.Enum);
      // @ts-expect-error AND is a logical key, not a field name
      defineFilter({ AND: str(Op.eq) });
      // @ts-expect-error a relation takes a spec, never a field
      relation.one(str(Op.eq));
    });
  });

  it('keeps comparison operators for numbers, decimals and dates', () => {
    expectTypeOf(int(Op.gt)).toEqualTypeOf<ReturnType<typeof int<readonly ['gt']>>>();
    expect(decimal(Op.Number).operators).toContain('between');
    expect(date(Op.Date).operators).not.toContain('in');
  });
});

describe('limits (QRY-16)', () => {
  // Built in a loop: a test input that is 100 000 levels deep must not overflow the test itself.
  const node = (depth: number): Record<string, unknown> => {
    let result: Record<string, unknown> = { name: { operator: 'eq', value: 'x' } };
    for (let level = 0; level < depth; level += 1) result = { NOT: result };
    return result;
  };

  it('keeps the defaults of the contract', () => {
    expect(DEFAULT_LIMITS).toEqual({
      maxLogicalDepth: 5,
      maxRelationDepth: 2,
      maxNodes: 50,
      maxListSize: 1000,
    });
  });

  it('lets a query tighten a limit and refuses to loosen one', () => {
    expect(resolveLimits({ maxNodes: 10 }).maxNodes).toBe(10);
    expect(resolveLimits({ maxNodes: 10 }).maxListSize).toBe(1000);
    expect(() => resolveLimits({ maxNodes: 51 })).toThrow(RangeError);
    expect(() => resolveLimits({ maxNodes: 0 })).toThrow(RangeError);
    expect(() => resolveLimits({ maxNodes: 1.5 })).toThrow(RangeError);
    expect(() => resolveLimits({ nope: 1 } as never)).toThrow(/unknown filter limit/);
  });

  it('counts nesting of AND, OR and NOT', () => {
    expect(checkLimits(userFilter, node(5))).toEqual([]);
    expect(checkLimits(userFilter, node(6))).toMatchObject([{ limit: 'maxLogicalDepth', max: 5 }]);
  });

  it('counts relation levels, through a quantifier too', () => {
    const deep = defineFilter({ a: relation.one(defineFilter({ b: relation.one(userFilter) })) });
    const two = { a: { b: { name: { operator: 'eq', value: 'x' } } } };
    const three = { a: { b: { group: { title: { operator: 'eq', value: 'x' } } } } };
    expect(checkLimits(deep, two)).toEqual([]);
    expect(checkLimits(deep, three)).toMatchObject([{ limit: 'maxRelationDepth', max: 2 }]);

    const quantified = { orders: { some: { paid: { operator: 'eq', value: true } } } };
    expect(checkLimits(userFilter, quantified)).toEqual([]);
    expect(checkLimits(userFilter, quantified, resolveLimits({ maxRelationDepth: 1 }))).toEqual([]);
  });

  it('counts nodes and conditions and stops at the first excess', () => {
    const conditions = Array.from({ length: 60 }, () => ({ name: { operator: 'eq', value: 'x' } }));
    const violations = checkLimits(userFilter, { OR: conditions });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ limit: 'maxNodes', max: 50 });
  });

  it('counts the items of in and nin', () => {
    const list = (length: number) => ({
      age: { operator: 'in', value: Array.from({ length }, (_, index) => index) },
    });
    expect(checkLimits(userFilter, list(1000))).toEqual([]);
    expect(checkLimits(userFilter, list(1001))).toMatchObject([
      { limit: 'maxListSize', path: ['age', 'value'] },
    ]);
  });

  it('does not throw on input it cannot read, and does not recurse past the limit', () => {
    expect(checkLimits(userFilter, null)).toEqual([]);
    expect(checkLimits(userFilter, 'x')).toEqual([]);
    expect(checkLimits(userFilter, { AND: 'x', OR: [null, 1], group: 'x', orders: 1 })).toEqual([]);
    expect(checkLimits(userFilter, { __proto__: { x: 1 }, constructor: {} })).toEqual([]);
    const violations = checkLimits(userFilter, node(100_000));
    expect(violations).toMatchObject([{ limit: 'maxLogicalDepth' }]);
  });
});
