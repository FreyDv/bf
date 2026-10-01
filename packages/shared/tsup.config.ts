import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'ddd/index': 'src/ddd/index.ts',
    'interfaces/index': 'src/interfaces/index.ts',
    'constants/index': 'src/constants/index.ts',
    'decorators/index': 'src/decorators/index.ts',
    'guards/index': 'src/guards/index.ts',
    'filters/index': 'src/filters/index.ts',
    'interceptors/index': 'src/interceptors/index.ts',
    'middleware/index': 'src/middleware/index.ts',
    'logger/index': 'src/logger/index.ts',
  },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  external: [/^@nestjs\//, 'nestjs-cls', 'nestjs-pino', 'rxjs', 'drizzle-orm', 'pg', 'express'],
});
