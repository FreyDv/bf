import { eq } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { groupFilter, orderFilter, userFilter } from '../core/fixtures.js';
import {
  groupBinding,
  groups,
  orderBinding,
  orders,
  userBinding,
  users,
} from '../../test/schema.js';
import { type FilterBinding, defineBinding, related } from './index.js';

describe('defineBinding: exhaustive by type (QRY-15)', () => {
  it('has an entry for every field and gives back a binding of the same spec', () => {
    expectTypeOf(userBinding).toEqualTypeOf<FilterBinding<typeof userFilter>>();
    expect(userBinding.spec).toBe(userFilter);
  });

  it('does not compile when a field has no column', () => {
    expect(() =>
      // @ts-expect-error the field `title` of the spec has no column
      defineBinding(groupFilter, { legalEntityId: groups.legalEntityId }),
    ).toThrow(/title needs a column/);
  });

  it('does not compile when a column has no field', () => {
    expect(() =>
      defineBinding(groupFilter, {
        legalEntityId: groups.legalEntityId,
        title: groups.title,
        // @ts-expect-error `extra` is not a field of the spec
        extra: groups.id,
      }),
    ).toThrow(/extra is not a field/);
  });

  it('does not compile when a relation field is given a column', () => {
    expect(() =>
      defineBinding(orderFilter, {
        paid: orders.paid,
        total: orders.total,
        status: orders.status,
      }),
    ).not.toThrow();
    expect(() =>
      defineBinding(
        userFilter,
        // @ts-expect-error `group` is a relation, it needs related()
        { ...userBinding.fields, group: groups.id },
      ),
    ).toThrow(/group needs a binding made with related/);
  });

  it('does not compile when a relation is bound to the binding of another spec', () => {
    expect(() =>
      defineBinding(userFilter, {
        ...userBinding.fields,
        // @ts-expect-error the binding of the order spec does not fit the group relation
        group: related(groups, eq(groups.id, users.groupId), orderBinding),
      }),
    ).toThrow(/other than its own/);
    expect(groupBinding.spec).toBe(groupFilter);
  });
});
