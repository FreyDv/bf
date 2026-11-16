import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_LEVEL, LOG_LEVELS, readLogLevel } from './log-level.js';

describe('readLogLevel', () => {
  it('defaults to info when LOG_LEVEL is absent or empty', () => {
    expect(readLogLevel({})).toBe(DEFAULT_LOG_LEVEL);
    expect(readLogLevel({ LOG_LEVEL: '' })).toBe('info');
  });

  it.each(LOG_LEVELS)('accepts the pino level %s', (level) => {
    expect(readLogLevel({ LOG_LEVEL: level })).toBe(level);
  });

  it('fails at startup on a value that is not a pino level', () => {
    expect(() => readLogLevel({ LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL must be one of/);
    expect(() => readLogLevel({ LOG_LEVEL: 'INFO' })).toThrow(/LOG_LEVEL/);
  });
});
