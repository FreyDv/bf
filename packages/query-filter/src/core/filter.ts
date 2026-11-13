import type {
  FieldMap,
  FilterSpec,
  OneOfField,
  RelationManyField,
  RelationOneField,
  ScalarField,
  ScalarValueMap,
} from './fields.js';
import type { Operator } from './operators.js';

/** The condition on one field: a sum type on `operator`, holding only the operators the field allows. */
type ConditionOf<V, O extends Operator> = O extends 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  ? { operator: O; value: V }
  : O extends 'in' | 'nin'
    ? { operator: O; value: V[] }
    : O extends 'between' | 'nbetween'
      ? { operator: O; value: [V, V] }
      : O extends 'isnull' | 'nisnull'
        ? { operator: O }
        : never;

type ValueOf<F> =
  F extends ScalarField<infer K> ? ScalarValueMap[K] : F extends OneOfField<infer V> ? V : never;

type OperatorsOf<F> = F extends { readonly operators: readonly (infer O)[] }
  ? Extract<O, Operator>
  : never;

/** A one-to-many relation takes exactly one of `some`, `none`, `every` (ADR-024 item 6). */
export type RelationManyFilter<N> = { some: N } | { none: N } | { every: N };

type FieldFilter<F> =
  F extends RelationOneField<infer R>
    ? FilterOf<R>
    : F extends RelationManyField<infer R>
      ? RelationManyFilter<FilterOf<R>>
      : ConditionOf<ValueOf<F>, OperatorsOf<F>>;

/**
 * The keys of one node combine with AND. `AND` and `OR` are non-empty arrays of nodes, `NOT` is one node;
 * upper case keeps them apart from field names. An empty node is a validation error, not a type error.
 */
export type FilterOf<S extends FilterSpec> = {
  [K in keyof S['fields']]?: FieldFilter<S['fields'][K]>;
} & {
  AND?: FilterOf<S>[];
  OR?: FilterOf<S>[];
  NOT?: FilterOf<S>;
};

type LogicalKeys = { AND?: never; OR?: never; NOT?: never };

const KINDS = new Set(['str', 'int', 'decimal', 'bool', 'date', 'datetime', 'uuid', 'oneOf']);
const RELATIONS = new Set(['relation-one', 'relation-many']);

/** QRY-1: the only way to declare a filter. The result is plain data. */
export function defineFilter<F extends FieldMap>(fields: F & LogicalKeys): FilterSpec<F> {
  const names = Object.keys(fields);
  if (names.length === 0) {
    throw new TypeError('defineFilter: at least one field is required');
  }
  for (const name of names) {
    if (name === 'AND' || name === 'OR' || name === 'NOT') {
      throw new TypeError(`defineFilter: ${name} is reserved for logical operators`);
    }
    const field = fields[name] as { kind?: unknown } | undefined;
    if (
      !field ||
      typeof field.kind !== 'string' ||
      !(KINDS.has(field.kind) || RELATIONS.has(field.kind))
    ) {
      throw new TypeError(`defineFilter: ${name} is not a field built with the value builders`);
    }
  }
  return Object.freeze({ fields: Object.freeze({ ...fields }) });
}

/** True for a field that holds a value (not a relation). */
export const isValueField = (field: FieldMap[string]): field is ScalarField | OneOfField =>
  !RELATIONS.has(field.kind);
