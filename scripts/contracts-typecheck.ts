// CI step of ADR-057: type-check and lint what a backend contract file reaches when a pull request changes only it.
//
// `turbo --affected` selects @bf/backend for such a change and nothing else, because backend is not a dependency of
// frontend or contracts in the Turborepo graph, while packages/contracts/src/generated/server.ts (ADR-035) imports
// the DTO files by relative path and both packages compile them, under `verbatimModuleSyntax: true` where the backend
// has it off. Lint is included because the shared ESLint config is type-aware (ADR-016). Which files count lives in
// scripts/lib/backend-contract-files.ts. This step is the selector; the cache sees the DTO files through the `inputs`
// of these tasks (ADR-058), so the command runs without `--force`.
//
//   node scripts/contracts-typecheck.ts [--base <ref>] [--root <dir>] [--dry-run]
//
// Without `--base` it acts only on a pull request ($GITHUB_EVENT_NAME, $GITHUB_BASE_REF): a push to `main` runs every
// task in full anyway. `--dry-run` prints the decision and the command and runs nothing.
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BACKEND_CONTRACT_FILES } from './lib/backend-contract-files.ts';

export const COMMAND = [
  'pnpm',
  'turbo',
  'run',
  'typecheck',
  'lint',
  '--filter=@bf/contracts',
  '--filter=@bf/frontend',
];

export const matching = (changed: string[]): string[] =>
  changed.filter((file) => BACKEND_CONTRACT_FILES.test(file));

export function changedFiles(root: string, base: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

export function run(root: string, base: string | undefined, dryRun: boolean): number {
  if (!base) {
    console.log('contracts-typecheck: not a pull request, nothing to select');
    return 0;
  }
  const files = matching(changedFiles(root, base));
  if (files.length === 0) {
    console.log('contracts-typecheck: no backend contract file changed, skipped');
    return 0;
  }
  console.log(`contracts-typecheck: ${files.length} backend contract file(s) changed:`);
  for (const file of files) console.log(`  ${file}`);
  console.log(`contracts-typecheck: ${COMMAND.join(' ')}`);
  if (dryRun) return 0;
  const [command, ...args] = COMMAND;
  return spawnSync(command as string, args, { cwd: root, stdio: 'inherit' }).status ?? 1;
}

if (import.meta.main) {
  const argument = (flag: string) => {
    const at = process.argv.indexOf(flag);
    return at >= 0 ? process.argv[at + 1] : undefined;
  };
  const githubBase = process.env['GITHUB_BASE_REF'];
  const base =
    argument('--base') ??
    (process.env['GITHUB_EVENT_NAME'] === 'pull_request' && githubBase
      ? `origin/${githubBase}`
      : undefined);
  const root = resolve(argument('--root') ?? `${import.meta.dirname}/..`);
  process.exit(run(root, base, process.argv.includes('--dry-run')));
}
