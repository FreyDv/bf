import { z } from 'zod';
import type { OneOfField, ScalarField, ScalarKind } from '../core/index.js';

// What a `value` may be on the wire (ADR-050): only JSON primitives, a date is an ISO 8601 string.
const DECIMAL = /^-?\d+(\.\d+)?$/;

type ValueField = ScalarField | OneOfField;

const scalarSchema = (kind: ScalarKind): z.ZodType => {
  switch (kind) {
    case 'str':
      return z.string();
    case 'int':
      return z.int();
    case 'decimal':
      return z
        .string()
        .regex(DECIMAL, 'a decimal is a string of digits with an optional sign and fraction');
    case 'bool':
      return z.boolean();
    case 'date':
      return z.iso.date();
    case 'datetime':
      return z.iso.datetime({ offset: true });
    case 'uuid':
      return z.uuid();
  }
};

export const valueSchema = (field: ValueField): z.ZodType => {
  if (field.kind !== 'oneOf') return scalarSchema(field.kind);
  const [first, ...rest] = field.values;
  if (first === undefined) throw new TypeError('oneOf: at least one value is required');
  return z.enum([first, ...rest]);
};

const scale = (value: string, digits: number): bigint => {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const scaled = BigInt(whole + fraction.padEnd(digits, '0'));
  return negative ? -scaled : scaled;
};

const sign = (difference: number | bigint): number =>
  difference < 0 ? -1 : difference > 0 ? 1 : 0;

/** Orders two values of one kind, for the rule `v1 <= v2` of `between` and `nbetween` (QRY-5). */
export const compareValues = (kind: ValueField['kind'], a: unknown, b: unknown): number => {
  switch (kind) {
    case 'int':
      return sign((a as number) - (b as number));
    case 'decimal': {
      const left = a as string;
      const right = b as string;
      const digits = Math.max(left.split('.')[1]?.length ?? 0, right.split('.')[1]?.length ?? 0);
      return sign(scale(left, digits) - scale(right, digits));
    }
    case 'datetime':
      // Offsets differ, so text order is not time order.
      return sign(Date.parse(a as string) - Date.parse(b as string));
    default:
      return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  }
};
