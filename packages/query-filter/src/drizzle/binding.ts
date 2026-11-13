// A binding maps the fields of a filter spec to the columns of Drizzle tables (QRY-15). It is the only place
// where a column name enters a filter query: `compile` never builds an identifier from a request.
import { Column, SQL, Table, is } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import type { FieldSpec, FilterSpec, RelationManyField, RelationOneField } from '../core/index.js';

/**
 * How a relation field reaches its table: `table` is the related table, `on` correlates it with the table of the
 * node that holds the relation, written with the columns of both (`eq(orders.userId, users.id)`). The foreign
 * key `on` uses MUST be indexed (QRY-11): Postgres does not create that index, and EXISTS inside OR stays a
 * per-row subquery.
 */
export interface RelationBinding<S extends FilterSpec = FilterSpec> {
  readonly table: Table;
  readonly on: SQL;
  readonly binding: FilterBinding<S>;
}

/** A column for a value field, a `RelationBinding` for a relation. */
export type BindingOf<F extends FieldSpec> =
  F extends RelationOneField<infer R>
    ? RelationBinding<R>
    : F extends RelationManyField<infer R>
      ? RelationBinding<R>
      : AnyColumn;

/** Exhaustive by type: a field of the spec without an entry, or an entry without a field, does not compile. */
export type BindingFields<S extends FilterSpec> = {
  readonly [K in keyof S['fields']]: BindingOf<S['fields'][K]>;
};

export interface FilterBinding<S extends FilterSpec = FilterSpec> {
  readonly spec: S;
  readonly fields: BindingFields<S>;
}

const isRelationBinding = (value: unknown): value is RelationBinding =>
  typeof value === 'object' &&
  value !== null &&
  is((value as RelationBinding).table, Table) &&
  is((value as RelationBinding).on, SQL);

/**
 * Binds every field of `spec`. The type already refuses a missing or an extra field; the same is checked at run
 * time for a caller that does not go through the compiler.
 */
export function defineBinding<S extends FilterSpec>(
  spec: S,
  fields: BindingFields<S>,
): FilterBinding<S> {
  const given = fields as Readonly<Record<string, unknown>>;
  for (const name of Object.keys(given)) {
    if (!Object.hasOwn(spec.fields, name)) {
      throw new TypeError(`defineBinding: ${name} is not a field of the spec`);
    }
  }
  for (const [name, field] of Object.entries(spec.fields)) {
    const bound = Object.hasOwn(given, name) ? given[name] : undefined;
    if (field.kind === 'relation-one' || field.kind === 'relation-many') {
      if (!isRelationBinding(bound)) {
        throw new TypeError(`defineBinding: ${name} needs a binding made with related()`);
      }
      if (bound.binding.spec !== field.spec) {
        throw new TypeError(`defineBinding: ${name} is bound to a spec other than its own`);
      }
    } else if (!is(bound, Column)) {
      throw new TypeError(`defineBinding: ${name} needs a column`);
    }
  }
  return Object.freeze({ spec, fields: Object.freeze({ ...fields }) });
}

/** The binding of a relation field: the related table, how it is correlated, and the binding of its own spec. */
export function related<S extends FilterSpec>(
  table: Table,
  on: SQL,
  binding: FilterBinding<S>,
): RelationBinding<S> {
  return Object.freeze({ table, on, binding });
}
