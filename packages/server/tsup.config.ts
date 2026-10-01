import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [
    /^@nestjs\//,
    /^@bf\//,
    'nestjs-cls',
    'nestjs-pino',
    'helmet',
    'rxjs',
    'zod',
    'class-validator',
    'class-transformer',
    'express',
  ],
});
