import swc from 'unplugin-swc';
import { defineConfig, mergeConfig } from 'vitest/config';

// esbuild cannot emit decorator metadata, which Nest needs (ADR-016), so SWC compiles tests.
const swcPlugin = () =>
  swc.vite({
    module: { type: 'es6' },
    jsc: {
      target: 'es2023',
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  });

/**
 * Unit preset for a Nest app: `src/**\/*.test.ts` without `*.e2e.test.ts`, which needs Postgres and runs under
 * `test:e2e` (nestVitestE2e, ADR-039 item 1.1, ADR-071).
 */
export function nestVitest(overrides = {}) {
  return mergeConfig(
    defineConfig({
      plugins: [swcPlugin()],
      test: {
        include: ['src/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e.test.ts'],
      },
    }),
    overrides,
  );
}

/**
 * End-to-end preset for a Nest app: only `*.e2e.test.ts`, files one after another because they share the schema of
 * `bf_test` (ADR-039 item 5.2), and timeouts that fit a database round trip (ADR-071).
 */
export function nestVitestE2e(overrides = {}) {
  return mergeConfig(
    defineConfig({
      plugins: [swcPlugin()],
      test: {
        include: ['src/**/*.e2e.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        fileParallelism: false,
        testTimeout: 20_000,
        hookTimeout: 20_000,
      },
    }),
    overrides,
  );
}
