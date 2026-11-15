import { describe, expect, it } from 'vitest';
import { assertTestDatabase, newSchemaName } from './db.js';

describe('TST-3 test database guard', () => {
  it('accepts a name that marks a test database', () => {
    for (const name of ['bf_test', 'test', 'bf-test-2', 'TEST_db']) {
      expect(() => assertTestDatabase(name), name).not.toThrow();
    }
  });

  it('refuses every other name', () => {
    for (const name of ['bf_dev', 'bfdb', 'defaultdb', 'latest', 'contest', 'bf_testing', '']) {
      expect(() => assertTestDatabase(name), name).toThrow(/TST-3/);
    }
  });

  it('generates schema names the helper accepts', () => {
    expect(newSchemaName()).toMatch(/^qf_[0-9a-f]{8}$/);
  });
});
