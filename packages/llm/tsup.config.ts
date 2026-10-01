import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', port: 'src/port.ts' },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [/^@nestjs\//, 'openai', 'zod'],
});
