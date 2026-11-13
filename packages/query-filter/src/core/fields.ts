// Value builders (ADR-024 item 1). A field description is plain data: no Zod, no Drizzle (QRY-6, QRY-7),
// so the application layer can read it.
import {
  type EqualityOperator,
  type Operator,
  OPERATORS,
  isEqualityOperator,
} from './operators.js';

/** The TS type of `value` per scalar kind. `decimal` is a string, never a float; dates are ISO 8601 strings. */
export interface ScalarValueMap {
  str: string;
  int: number;
  decimal: string;
  bool: boolean;
  date: string;
  datetime: string;
  uuid: string;
}

export type ScalarKind = keyof ScalarValueMap;

export interface ScalarField<K extends ScalarKind = ScalarKind, O extends Operator = Operator> {
  readonly kind: K;
  readonly operators: readonly O[];
}

export interface OneOfField<V extends string = string, O extends Operator = Operator> {
  readonly kind: 'oneOf';
  readonly values: readonly V[];
  readonly operators: readonly O[];
}

export interface RelationOneField<S extends FilterSpec = FilterSpec> {
  readonly kind: 'relation-one';
  readonly spec: S;
}

export interface RelationManyField<S extends FilterSpec = FilterSpec> {
  readonly kind: 'relation-many';
  readonly spec: S;
}

export type FieldSpec = ScalarField | OneOfField | RelationOneField | RelationManyField;

export type FieldMap = { readonly [name: string]: FieldSpec };

export interface FilterSpec<F extends FieldMap = FieldMap> {
  readonly fields: F;
}

type OperatorArg<O extends Operator> = O | readonly O[];
type Flatten<T> = T extends readonly (infer U)[] ? U : T;
type OperatorsOf<A extends readonly unknown[]> = Extract<Flatten<A[number]>, Operator>;

/** At least one operator or set: a field with no operator is not filterable, so it is not declared. */
type OperatorArgs<O extends Operator> = readonly [OperatorArg<O>, ...OperatorArg<O>[]];

const flatten = (args: readonly (Operator | readonly Operator[])[], field: string): Operator[] => {
  const operators = new Set<Operator>();
  for (const arg of args.flat()) {
    if (!OPERATORS.includes(arg)) {
      throw new TypeError(`${field}: unknown operator ${JSON.stringify(arg)}`);
    }
    operators.add(arg);
  }
  if (operators.size === 0) {
    throw new TypeError(`${field}: at least one operator is required`);
  }
  return [...operators];
};

const scalar = <K extends ScalarKind, O extends Operator>(
  kind: K,
  args: readonly (Operator | readonly Operator[])[],
): ScalarField<K, O> =>
  Object.freeze({ kind, operators: Object.freeze(flatten(args, kind)) as readonly O[] });

/** Kinds with an order: comparison and range operators make sense. */
type OrderedArgs = OperatorArgs<Operator>;
/** Kinds without an order: `gt`, `gte`, `lt`, `lte`, `between`, `nbetween` do not compile. */
type UnorderedArgs = OperatorArgs<EqualityOperator>;

export const str = <const A extends OrderedArgs>(
  ...operators: A
): ScalarField<'str', OperatorsOf<A>> => scalar('str', operators);

export const int = <const A extends OrderedArgs>(
  ...operators: A
): ScalarField<'int', OperatorsOf<A>> => scalar('int', operators);

export const decimal = <const A extends OrderedArgs>(
  ...operators: A
): ScalarField<'decimal', OperatorsOf<A>> => scalar('decimal', operators);

export const date = <const A extends OrderedArgs>(
  ...operators: A
): ScalarField<'date', OperatorsOf<A>> => scalar('date', operators);

export const datetime = <const A extends OrderedArgs>(
  ...operators: A
): ScalarField<'datetime', OperatorsOf<A>> => scalar('datetime', operators);

export const bool = <const A extends UnorderedArgs>(
  ...operators: A
): ScalarField<'bool', OperatorsOf<A>> => scalar('bool', operators);

export const uuid = <const A extends UnorderedArgs>(
  ...operators: A
): ScalarField<'uuid', OperatorsOf<A>> => scalar('uuid', operators);

type NonEmptyValues = readonly [string, ...string[]];

/**
 * A string TS enum or a non-empty array (ADR-024 item 3). A numeric enum does not compile: its runtime object
 * carries reverse keys. An array publishes only the listed values; an enum publishes every value it will ever get.
 */
export function oneOf<const V extends NonEmptyValues, const A extends UnorderedArgs>(
  values: V,
  ...operators: A
): OneOfField<V[number], OperatorsOf<A>>;
export function oneOf<E extends Record<string, string>, const A extends UnorderedArgs>(
  values: E,
  ...operators: A
): OneOfField<E[keyof E], OperatorsOf<A>>;
export function oneOf(
  source: readonly string[] | Record<string, string>,
  ...operators: readonly (Operator | readonly Operator[])[]
): OneOfField {
  const values = Array.isArray(source) ? [...(source as string[])] : Object.values(source);
  if (values.length === 0) {
    throw new TypeError('oneOf: at least one value is required');
  }
  if (!values.every((value) => typeof value === 'string')) {
    throw new TypeError('oneOf: only string values are allowed, a numeric enum has reverse keys');
  }
  const flat = flatten(operators, 'oneOf');
  if (!flat.every(isEqualityOperator)) {
    throw new TypeError('oneOf: only equality operators are allowed');
  }
  return Object.freeze({
    kind: 'oneOf',
    values: Object.freeze([...new Set(values)]),
    operators: Object.freeze(flat),
  });
}

/**
 * A relation takes a spec that is already declared, never a lazy reference, so the relation graph is
 * acyclic and finite (ADR-024). A two-way relation uses a base spec that holds only scalar fields.
 */
export const relation = Object.freeze({
  one: <S extends FilterSpec>(spec: S): RelationOneField<S> =>
    Object.freeze({ kind: 'relation-one', spec }),
  many: <S extends FilterSpec>(spec: S): RelationManyField<S> =>
    Object.freeze({ kind: 'relation-many', spec }),
});
