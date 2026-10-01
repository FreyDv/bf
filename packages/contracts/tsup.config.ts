import { defineConfig } from 'tsup';

const services = ['auth', 'order', 'course', 'billing', 'admin', 'ai'] as const;

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'common/index': 'src/common/index.ts',
    ...Object.fromEntries(services.map((s) => [`${s}/index`, `src/${s}/index.ts`])),
  },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['zod', /^@trpc\//],
});
