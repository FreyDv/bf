import { defineConfig } from 'vitest/config';

// The helper against a real Postgres. The database comes from the DB_* variables (@bf/db-utils) and DB_NAME must be
// a test database (TST-3). Each file uses a schema of its own, so files may run side by side.
export default defineConfig({
  test: {
    include: ['src/**/*.e2e.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
