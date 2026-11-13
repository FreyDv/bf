import { defineConfig } from 'vitest/config';

// Plain Vitest: the toolkit has no decorators, so the SWC preset of the Nest apps is not needed. `*.e2e.test.ts`
// needs Postgres and runs under `test:e2e` (vitest.e2e.config.ts), never here (ADR-039 item 1.2).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e.test.ts'],
  },
});
