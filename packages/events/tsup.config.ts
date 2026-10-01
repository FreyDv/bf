import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', envelope: 'src/envelope.ts', tables: 'src/tables.ts' },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [/^@nestjs\//, /^@bf\//, /^drizzle-/, 'zod'],
});
