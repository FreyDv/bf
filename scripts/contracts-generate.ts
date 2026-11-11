// Builds packages/contracts/src/generated/server.ts, the `AppRouter` type the frontend imports (ADR-035).
// `--check` writes nothing and fails when the committed file differs from what the routers produce.
import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'packages/contracts/src/generated');
const outFile = `${outDir}/server.ts`;
const check = process.argv.includes('--check');

// The generator refuses to run without a router, so the empty router is written here, in its form.
const EMPTY = `import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
const appRouter = t.router({});

export type AppRouter = typeof appRouter;
`;

const read = (file: string) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });

const before = read(outFile);
const routers = globSync('apps/backend/src/**/*.router.ts', { cwd: root });

if (routers.length === 0) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, EMPTY);
} else {
  run('pnpm', [
    '--filter',
    '@bf/backend',
    'exec',
    'nestjs-trpc',
    'generate',
    '-o',
    outDir,
    '--import-extension',
    'js',
  ]);
  // The generator always imports `z`, but leaves it unused when every schema is imported; the
  // frontend compiles this file under `noUnusedLocals`.
  const generated = read(outFile);
  const ZOD_IMPORT = /^import \{ z \} from ['"]zod['"];\n/m;
  if (!/\bz\./.test(generated.replace(ZOD_IMPORT, ''))) {
    writeFileSync(outFile, generated.replace(ZOD_IMPORT, ''));
  }
  run('pnpm', ['exec', 'prettier', '--write', outFile]);
}

if (check && read(outFile) !== before) {
  writeFileSync(outFile, before);
  console.error(
    'packages/contracts/src/generated/server.ts is out of date: run `pnpm contracts:generate` and commit it.',
  );
  process.exit(1);
}
