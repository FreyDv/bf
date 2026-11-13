// The operator table of ADR-024 / QRY-2. In code an operator is written `Op.<name>`, because `in` is a
// reserved word in JavaScript; on the wire it is the plain string.

export type Operator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'between'
  | 'nbetween'
  | 'isnull'
  | 'nisnull';

/** What `bool`, `uuid` and `oneOf` fields may use: comparison and range operators do not compile on them. */
export type EqualityOperator = 'eq' | 'neq' | 'in' | 'nin' | 'isnull' | 'nisnull';

const set = <const T extends readonly Operator[]>(operators: T): T => Object.freeze(operators);

export const Op = Object.freeze({
  eq: 'eq',
  neq: 'neq',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
  nin: 'nin',
  between: 'between',
  nbetween: 'nbetween',
  isnull: 'isnull',
  nisnull: 'nisnull',

  // QRY-4: a plain list. A module may declare its own; these shared sets do not change for one module.
  String: set(['eq', 'neq']),
  Number: set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'nbetween', 'in', 'nin']),
  Date: set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'nbetween']),
  Id: set(['eq', 'neq', 'in', 'nin']),
  Enum: set(['eq', 'neq', 'in', 'nin']),
  Bool: set(['eq']),
  Null: set(['isnull', 'nisnull']),
} as const);

export const OPERATORS: readonly Operator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'between',
  'nbetween',
  'isnull',
  'nisnull',
];

const EQUALITY: ReadonlySet<string> = new Set<EqualityOperator>([
  'eq',
  'neq',
  'in',
  'nin',
  'isnull',
  'nisnull',
]);

export const isEqualityOperator = (operator: string): operator is EqualityOperator =>
  EQUALITY.has(operator);
