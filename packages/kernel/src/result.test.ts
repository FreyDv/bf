import { describe, expect, it } from 'vitest';
import { err, ok } from './index.js';
import type { Result } from './index.js';

describe('Result', () => {
  it('carries a value or an error as a typed sum', () => {
    const parse = (raw: string): Result<number, 'INVALID.NUMBER'> =>
      Number.isNaN(Number(raw)) ? err('INVALID.NUMBER') : ok(Number(raw));

    const parsed = parse('4');
    expect(parsed.isOk()).toBe(true);
    expect(parsed._unsafeUnwrap()).toBe(4);

    const failed = parse('x');
    expect(failed.isErr()).toBe(true);
    expect(failed._unsafeUnwrapErr()).toBe('INVALID.NUMBER');
  });
});
