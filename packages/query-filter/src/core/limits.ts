// QRY-16: default limits, which a query may only tighten. They are checked twice (ADR-050): by `toZod` on the
// request, so a caller learns about it as a validation error, and again by `compile`, so code that builds a
// filter by hand cannot skip them. Both use this walker.
import type { FilterSpec } from './fields.js';

export interface FilterLimits {
  /** Nesting of `AND`, `OR` and `NOT` along one path. */
  readonly maxLogicalDepth: number;
  /** Relation levels along one path. */
  readonly maxRelationDepth: number;
  /** Node objects plus conditions in the whole filter. */
  readonly maxNodes: number;
  /** Length of the list of an `in` or `nin` condition. */
  readonly maxListSize: number;
}

export const DEFAULT_LIMITS: FilterLimits = Object.freeze({
  maxLogicalDepth: 5,
  maxRelationDepth: 2,
  maxNodes: 50,
  maxListSize: 1000,
});

/** A query tightens the defaults and never loosens them (QRY-16): a larger value throws when the schema is built. */
export function resolveLimits(overrides: Partial<FilterLimits> = {}): FilterLimits {
  const resolved: Record<string, number> = { ...DEFAULT_LIMITS };
  for (const [name, value] of Object.entries(overrides)) {
    const max = DEFAULT_LIMITS[name as keyof FilterLimits] as number | undefined;
    if (max === undefined) {
      throw new RangeError(`unknown filter limit ${name}`);
    }
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new RangeError(
        `filter limit ${name} must be an integer from 1 to ${max}, got ${value}`,
      );
    }
    resolved[name] = value;
  }
  return Object.freeze(resolved) as unknown as FilterLimits;
}

export interface LimitViolation {
  readonly limit: keyof FilterLimits;
  readonly max: number;
  readonly path: readonly (string | number)[];
}

export const describeViolation = (violation: LimitViolation): string => {
  switch (violation.limit) {
    case 'maxLogicalDepth':
      return `AND, OR and NOT are nested deeper than ${violation.max} levels`;
    case 'maxRelationDepth':
      return `relations are nested deeper than ${violation.max} levels`;
    case 'maxNodes':
      return `the filter has more than ${violation.max} nodes`;
    case 'maxListSize':
      return `a list of in or nin has more than ${violation.max} items`;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RELATION_QUANTIFIERS = ['some', 'none', 'every'] as const;

/**
 * Measures a filter that may still be malformed: it looks only at what it can count, never throws, and stops
 * descending where a limit is crossed, so its own recursion stays within the limits. Structure is the
 * business of the schema (`toZod`), which runs after this check.
 */
export function checkLimits(
  spec: FilterSpec,
  filter: unknown,
  limits: FilterLimits = DEFAULT_LIMITS,
): LimitViolation[] {
  const violations: LimitViolation[] = [];
  let nodes = 0;
  let halted = false;

  const report = (limit: keyof FilterLimits, path: (string | number)[]): void => {
    violations.push({ limit, max: limits[limit], path: [...path] });
  };

  const count = (path: (string | number)[]): boolean => {
    nodes += 1;
    if (nodes > limits.maxNodes) {
      report('maxNodes', path);
      halted = true;
    }
    return !halted;
  };

  const node = (
    current: FilterSpec,
    value: unknown,
    logical: number,
    relations: number,
    path: (string | number)[],
  ): void => {
    if (!isObject(value) || !count(path)) return;

    const logicalChild = (child: unknown, childPath: (string | number)[]): void => {
      if (logical + 1 > limits.maxLogicalDepth) {
        report('maxLogicalDepth', childPath);
        return;
      }
      node(current, child, logical + 1, relations, childPath);
    };

    const relationChild = (
      related: FilterSpec,
      child: unknown,
      childPath: (string | number)[],
    ): void => {
      if (relations + 1 > limits.maxRelationDepth) {
        report('maxRelationDepth', childPath);
        return;
      }
      node(related, child, logical, relations + 1, childPath);
    };

    for (const [key, entry] of Object.entries(value)) {
      if (halted) return;
      const keyPath = [...path, key];

      if (key === 'AND' || key === 'OR') {
        if (Array.isArray(entry)) {
          entry.forEach((child: unknown, index) => {
            if (!halted) logicalChild(child, [...keyPath, index]);
          });
        }
        continue;
      }
      if (key === 'NOT') {
        logicalChild(entry, keyPath);
        continue;
      }

      const field = Object.hasOwn(current.fields, key) ? current.fields[key] : undefined;
      if (!field) continue;

      if (field.kind === 'relation-one') {
        relationChild(field.spec, entry, keyPath);
      } else if (field.kind === 'relation-many') {
        if (!isObject(entry)) continue;
        for (const quantifier of RELATION_QUANTIFIERS) {
          if (entry[quantifier] !== undefined && !halted) {
            relationChild(field.spec, entry[quantifier], [...keyPath, quantifier]);
          }
        }
      } else {
        if (!count(keyPath)) return;
        if (
          isObject(entry) &&
          (entry.operator === 'in' || entry.operator === 'nin') &&
          Array.isArray(entry.value) &&
          entry.value.length > limits.maxListSize
        ) {
          report('maxListSize', [...keyPath, 'value']);
        }
      }
    }
  };

  node(spec, filter, 0, 0, []);
  return violations;
}
