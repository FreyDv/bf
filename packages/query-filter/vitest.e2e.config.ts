import { defineConfig } from 'vitest/config';

// Tests on a real Postgres (QRY-18). The database comes from DATABASE_URL and must be a test database (TST-3).
export default defineConfig({
  test: {
    include: ['src/**/*.e2e.test.ts', 'test/**/*.e2e.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // One schema per test file, so files may run side by side.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
