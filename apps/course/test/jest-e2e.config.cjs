const base = require('../jest.config.cjs');
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30000,
};
