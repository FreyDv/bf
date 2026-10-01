import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [/^@nestjs\//, /^@trpc\//, /^@bf\//, 'nestjs-trpc', 'nestjs-cls', 'zod'],
});
