import swc from 'unplugin-swc';
import { defineConfig, mergeConfig } from 'vitest/config';

/** esbuild cannot emit decorator metadata, which Nest needs (ADR-016), so SWC compiles tests. */
export function nestVitest(overrides = {}) {
  return mergeConfig(
    defineConfig({
      plugins: [
        swc.vite({
          module: { type: 'es6' },
          jsc: {
            target: 'es2023',
            parser: { syntax: 'typescript', decorators: true },
            transform: { legacyDecorator: true, decoratorMetadata: true },
          },
        }),
      ],
      test: { include: ['src/**/*.test.ts'] },
    }),
    overrides,
  );
}
