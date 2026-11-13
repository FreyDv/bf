import { z } from 'zod';
import {
  type FieldSpec,
  type FilterLimits,
  type FilterOf,
  type FilterSpec,
  type Operator,
  checkLimits,
  describeViolation,
  isValueField,
  resolveLimits,
} from '../core/index.js';
import { compareValues, valueSchema } from './values.js';

export interface ToZodOptions {
  /** QRY-16: a query may only tighten the default limits; a larger value throws when the schema is built. */
  readonly limits?: Partial<FilterLimits>;
}

type ValueField = Extract<FieldSpec, { operators: readonly Operator[] }>;

const condition = (field: ValueField): z.ZodType => {
  const value = valueSchema(field);
  const options = field.operators.map((operator): z.ZodType => {
    const operatorKey = z.literal(operator);
    switch (operator) {
      case 'in':
      case 'nin':
        return z.strictObject({ operator: operatorKey, value: z.array(value) });
      case 'between':
      case 'nbetween':
        return z.strictObject({ operator: operatorKey, value: z.tuple([value, value]) }).refine(
          (condition) => {
            const [from, to] = condition.value;
            return compareValues(field.kind, from, to) <= 0;
          },
          { error: 'the start of a range must not be greater than its end', path: ['value'] },
        );
      case 'isnull':
      case 'nisnull':
        // Strict and without `value`: a value on isnull is a validation error (QRY-5).
        return z.strictObject({ operator: operatorKey });
      default:
        return z.strictObject({ operator: operatorKey, value });
    }
  });
  // A discriminated union picks the branch by `operator`, so an error names the failing field of that branch.
  return z.discriminatedUnion(
    'operator',
    options as unknown as [z.core.$ZodTypeDiscriminable, ...z.core.$ZodTypeDiscriminable[]],
  );
};

const isEmptyNode = (node: Record<string, unknown>): boolean =>
  Object.values(node).every((entry) => entry === undefined);

const nodeSchema = (spec: FilterSpec): z.ZodType => {
  const node: z.ZodType = z.lazy(() => {
    const shape: Record<string, z.ZodType> = {};
    for (const [name, field] of Object.entries(spec.fields)) {
      shape[name] = fieldSchema(field).optional();
    }
    shape['AND'] = z.array(node).min(1).optional();
    shape['OR'] = z.array(node).min(1).optional();
    shape['NOT'] = node.optional();
    return z
      .strictObject(shape)
      .refine((value) => !isEmptyNode(value), { error: 'a filter node must not be empty' });
  });
  return node;
};

const fieldSchema = (field: FieldSpec): z.ZodType => {
  if (isValueField(field)) return condition(field);
  const related = nodeSchema(field.spec);
  if (field.kind === 'relation-one') return related;
  // `some`, `none`, `every`: exactly one (ADR-024 item 6).
  return z
    .strictObject({ some: related.optional(), none: related.optional(), every: related.optional() })
    .refine((value) => Object.values(value).filter((entry) => entry !== undefined).length === 1, {
      error: 'a one-to-many relation takes exactly one of some, none, every',
    });
};

/**
 * The request schema of a filter spec (QRY-1). Strict at every level (QRY-3); the conditions are a sum type on
 * `operator`; QRY-5 and QRY-16 violations come back as Zod issues, all together (ADP-8).
 *
 * The limits are measured first, on the raw value, so that a body nested a hundred thousand levels deep is
 * refused before Zod recurses into it. When a limit is crossed, structure is not reported alongside it.
 *
 * The return type is the type of the spec, not what Zod would infer from this generic recursive builder: the
 * schema is checked against `FilterOf<S>` by the tests of this package, accept and reject, and that keeps the
 * type that reaches `RouterInputs` on the frontend cheap to compute.
 */
export function toZod<S extends FilterSpec>(
  spec: S,
  options: ToZodOptions = {},
): z.ZodType<FilterOf<S>, FilterOf<S>> {
  const limits = resolveLimits(options.limits);
  const measured = z.unknown().superRefine((value, context) => {
    for (const violation of checkLimits(spec, value, limits)) {
      context.addIssue({
        code: 'custom',
        message: describeViolation(violation),
        path: [...violation.path],
        params: { limit: violation.limit, max: violation.max },
      });
    }
  });
  return measured.pipe(nodeSchema(spec)) as unknown as z.ZodType<FilterOf<S>, FilterOf<S>>;
}
