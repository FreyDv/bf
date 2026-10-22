import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    config: 'src/config.ts',
    'ensure-database': 'src/ensure-database.ts',
    'cli/migrate': 'src/cli/migrate.ts',
  },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [/^@nestjs\//, /^drizzle-/, 'pg', 'dotenv'],
});
