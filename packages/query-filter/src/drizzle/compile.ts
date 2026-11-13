// compile(binding, filter): the SQL fragment of a filter (ADR-024, ADR-050 item 7). Built with the `sql` template
// and `exists()`/`notExists()`: a value is always a parameter (QRY-15), a column and a table come only from the
// binding, and `sql.raw` is not used. Scope is the caller's: `and(scope, compile(...))` (QRY-17).
import { type Column, type SQL, exists, notExists, sql } from 'drizzle-orm';
import {
  type FilterLimits,
  type FilterOf,
  type FilterSpec,
  checkLimits,
  describeViolation,
  resolveLimits,
} from '../core/index.js';
import type { FilterBinding, RelationBinding } from './binding.js';

export interface CompileOptions {
  /** QRY-16: tightens the default limits, never loosens them; the same option as in `toZod`. */
  readonly limits?: Partial<FilterLimits>;
}

type Path = readonly (string | number)[];
type Scalar = string | number | boolean;

const at = (path: Path): string => (path.length === 0 ? 'filter' : `filter.${path.join('.')}`);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const paren = (inner: SQL): SQL => sql`(${inner})`;

const COMPARISON = {
  eq: sql`=`,
  neq: sql`<>`,
  gt: sql`>`,
  gte: sql`>=`,
  lt: sql`<`,
  lte: sql`<=`,
} as const;

type Comparison = keyof typeof COMPARISON;

const isComparison = (operator: string): operator is Comparison =>
  Object.hasOwn(COMPARISON, operator);

type ValueField = Extract<FilterSpec['fields'][string], { operators: readonly string[] }>;

// The request is validated by `toZod` before it gets here. These checks are for a filter built by hand: they
// keep what reaches the database a primitive of the kind the field declares.
const checkScalar = (field: ValueField, value: unknown, path: Path): Scalar => {
  const fail = (): never => {
    throw new TypeError(`${at(path)}: a value of kind ${field.kind} is expected`);
  };
  switch (field.kind) {
    case 'int':
      return typeof value === 'number' && Number.isSafeInteger(value) ? value : fail();
    case 'bool':
      return typeof value === 'boolean' ? value : fail();
    case 'oneOf':
      return typeof value === 'string' && field.values.includes(value) ? value : fail();
    default:
      return typeof value === 'string' ? value : fail();
  }
};

const valueCondition = (field: ValueField, column: Column, condition: unknown, path: Path): SQL => {
  if (!isObject(condition) || typeof condition.operator !== 'string') {
    throw new TypeError(`${at(path)}: a condition with an operator is expected`);
  }
  const { operator } = condition;
  if (!(field.operators as readonly string[]).includes(operator)) {
    throw new TypeError(`${at(path)}: operator ${JSON.stringify(operator)} is not allowed here`);
  }
  const hasValue = Object.hasOwn(condition, 'value') && condition.value !== undefined;

  if (operator === 'isnull' || operator === 'nisnull') {
    if (hasValue) throw new TypeError(`${at(path)}: ${operator} takes no value`);
    return sql`${column} ${operator === 'isnull' ? sql`is null` : sql`is not null`}`;
  }

  const value = condition.value;
  if (isComparison(operator)) {
    return sql`${column} ${COMPARISON[operator]} ${checkScalar(field, value, path)}`;
  }

  if (operator === 'in' || operator === 'nin') {
    if (!Array.isArray(value)) throw new TypeError(`${at(path)}: a list is expected`);
    const items = value.map((item: unknown) => checkScalar(field, item, path));
    if (items.length === 0) {
      // `x in ()` has no SQL spelling. It must still agree with QRY-14 and with `NOT`: nin is the negation of in,
      // and neither returns a row where the field is NULL.
      return operator === 'in'
        ? sql`case when ${column} is null then null else false end`
        : sql`case when ${column} is null then null else true end`;
    }
    const list = sql.join(
      items.map((item) => sql`${item}`),
      sql`, `,
    );
    return sql`${column} ${operator === 'in' ? sql`in` : sql`not in`} (${list})`;
  }

  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${at(path)}: a pair [from, to] is expected`);
  }
  const from = checkScalar(field, value[0], path);
  const to = checkScalar(field, value[1], path);
  return operator === 'between'
    ? sql`${column} between ${from} and ${to}`
    : sql`${column} not between ${from} and ${to}`;
};

const QUANTIFIERS = ['some', 'none', 'every'] as const;

const compileNode = (binding: FilterBinding, value: unknown, path: Path): SQL => {
  if (!isObject(value)) throw new TypeError(`${at(path)}: a filter node must be an object`);
  const parts: SQL[] = [];

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    const keyPath = [...path, key];

    if (key === 'AND' || key === 'OR') {
      if (!Array.isArray(entry) || entry.length === 0) {
        throw new TypeError(`${at(keyPath)}: a non-empty list of nodes is expected`);
      }
      const children = entry.map((child: unknown, index) =>
        compileNode(binding, child, [...keyPath, index]),
      );
      parts.push(paren(sql.join(children, key === 'AND' ? sql` and ` : sql` or `)));
      continue;
    }
    if (key === 'NOT') {
      parts.push(sql`not ${compileNode(binding, entry, keyPath)}`);
      continue;
    }

    if (!Object.hasOwn(binding.spec.fields, key)) {
      throw new TypeError(`${at(keyPath)}: not a field of the filter`);
    }
    const field = binding.spec.fields[key]!;
    const bound = (binding.fields as Readonly<Record<string, unknown>>)[key];

    if (field.kind === 'relation-one') {
      const relation = bound as RelationBinding;
      parts.push(exists(subquery(relation, compileNode(relation.binding, entry, keyPath))));
    } else if (field.kind === 'relation-many') {
      parts.push(compileQuantifier(bound as RelationBinding, entry, keyPath));
    } else {
      parts.push(paren(valueCondition(field, bound as Column, entry, keyPath)));
    }
  }

  if (parts.length === 0) throw new TypeError(`${at(path)}: a filter node must not be empty`);
  return paren(sql.join(parts, sql` and `));
};

/** `select 1 from <related> where <on> and <inner>`; the inner condition is already parenthesised. */
const subquery = (relation: RelationBinding, inner: SQL): SQL =>
  sql`(select 1 from ${relation.table} where ${paren(relation.on)} and ${inner})`;

const compileQuantifier = (relation: RelationBinding, entry: unknown, path: Path): SQL => {
  const keys = isObject(entry) ? Object.keys(entry).filter((key) => entry[key] !== undefined) : [];
  const quantifier = keys[0];
  if (keys.length !== 1 || !QUANTIFIERS.some((name) => name === quantifier)) {
    throw new TypeError(`${at(path)}: exactly one of some, none, every is expected`);
  }
  const inner = compileNode(relation.binding, (entry as Record<string, unknown>)[quantifier!], [
    ...path,
    quantifier!,
  ]);
  switch (quantifier) {
    case 'some':
      return exists(subquery(relation, inner));
    case 'none':
      return notExists(subquery(relation, inner));
    default:
      // QRY-13: true on an empty relation; a NULL in the condition counts as a violation.
      return notExists(subquery(relation, sql`${inner} is not true`));
  }
};

/**
 * The SQL of a filter, to be put under `where` as `and(scope, compile(...))`. Throws on a filter that breaks a
 * limit of QRY-16 (checked again here, ADR-050 item 6) or does not fit the spec, which `toZod` would have
 * rejected: reaching this point with one is a programming error (ERR-3), not a business outcome.
 */
export function compile<S extends FilterSpec>(
  binding: FilterBinding<S>,
  filter: FilterOf<S>,
  options: CompileOptions = {},
): SQL {
  const limits = resolveLimits(options.limits);
  const violations = checkLimits(binding.spec, filter, limits);
  if (violations.length > 0) {
    throw new RangeError(
      `filter limit exceeded: ${violations.map((violation) => `${describeViolation(violation)} (at ${at(violation.path)})`).join('; ')}`,
    );
  }
  return compileNode(binding, filter, []);
}
