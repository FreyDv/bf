// Proves which files select the contract typecheck (ADR-057) and that the step acts only on a pull request that
// changes one of them. Fixtures are throwaway git repositories; nothing here runs Turborepo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  BACKEND_CONTRACT_FILES,
  BACKEND_CONTRACT_TURBO_GLOBS,
  GENERATED_FILE_IMPORTS,
  touchesBackendContract,
} from './lib/backend-contract-files.ts';
import { COMMAND, matching } from './contracts-typecheck.ts';

const script = join(import.meta.dirname, 'contracts-typecheck.ts');
const S = 'apps/backend/src';
const repositoryRoot = join(import.meta.dirname, '..');

// Files that decide the tasks of these packages: the selected and the ignored examples of the next block.
const SELECTED = [
  `${S}/orders/queries/find/find.request.dto.ts`,
  `${S}/orders/dtos/order.response.dto.ts`,
  `${S}/orders/order-status.enum.ts`,
  `${S}/orders/queries/find/find.filter-spec.ts`,
  `${S}/orders/public/order.filter-spec.ts`,
];
const IGNORED = [
  `${S}/orders/domain/order.aggregate.ts`,
  `${S}/orders/queries/find/find.router.ts`,
  `${S}/orders/infrastructure/find.filter-binding.ts`,
  `${S}/orders/queries/find/find.request.dto.test.ts`,
  `${S}/orders/queries/find/find.filter-spec.test.ts`,
  `${S}/orders/order-status.enum.js`,
  'apps/frontend/app/order-status.enum.ts',
  'packages/contracts/src/order.request.dto.ts',
  'apps/backend/package.json',
  'docs/backlog.md',
];

describe('which files are backend contract files', () => {
  for (const file of SELECTED) {
    it(`selects ${file}`, () => assert.ok(BACKEND_CONTRACT_FILES.test(file)));
  }

  for (const file of IGNORED) {
    it(`ignores ${file}`, () => assert.equal(BACKEND_CONTRACT_FILES.test(file), false));
  }

  it('keeps the generated file to DTOs and enums, without the filter spec', () => {
    assert.ok(GENERATED_FILE_IMPORTS.test(`${S}/orders/find.request.dto.ts`));
    assert.ok(GENERATED_FILE_IMPORTS.test(`${S}/orders/order-status.enum.ts`));
    assert.equal(GENERATED_FILE_IMPORTS.test(`${S}/orders/find.filter-spec.ts`), false);
  });

  it('answers for a list of changed files', () => {
    assert.equal(touchesBackendContract(['docs/a.md', `${S}/o/find.request.dto.ts`]), true);
    assert.equal(touchesBackendContract(['docs/a.md', `${S}/o/order.aggregate.ts`]), false);
    assert.deepEqual(matching(['docs/a.md', `${S}/o/x.enum.ts`]), [`${S}/o/x.enum.ts`]);
  });

  it('runs typecheck and lint for contracts and frontend only, on the cache that sees the DTO files', () => {
    assert.deepEqual(COMMAND.slice(1), [
      'turbo',
      'run',
      'typecheck',
      'lint',
      '--filter=@bf/contracts',
      '--filter=@bf/frontend',
    ]);
  });
});

// ADR-058: the cache sees a DTO edit through `inputs` in these two files; they are JSON and cannot import the module.
describe('turbo inputs of the tasks that compile backend contract files', () => {
  const root = '$TURBO_ROOT$/';
  const globs = BACKEND_CONTRACT_TURBO_GLOBS.map((glob) => glob.slice(root.length));

  it('lists the globs under the repository root', () => {
    assert.ok(BACKEND_CONTRACT_TURBO_GLOBS.every((glob) => glob.startsWith(root)));
  });

  for (const file of SELECTED) {
    it(`matches ${file} in a glob like the pattern does`, () =>
      assert.ok(globs.some((glob) => matchesGlob(file, glob))));
  }

  for (const file of IGNORED) {
    it(`leaves ${file} out like the pattern does`, () =>
      assert.equal(
        globs.some((glob) => matchesGlob(file, glob)),
        false,
      ));
  }

  for (const directory of ['packages/contracts', 'apps/frontend']) {
    const config = JSON.parse(readFileSync(join(repositoryRoot, directory, 'turbo.json'), 'utf8'));

    it(`${directory}/turbo.json extends the root and lists the globs for typecheck and lint`, () => {
      assert.deepEqual(config.extends, ['//']);
      assert.deepEqual(Object.keys(config.tasks).sort(), ['lint', 'typecheck']);
      for (const task of ['typecheck', 'lint']) {
        // $TURBO_DEFAULT$ keeps the package's own files; without it only the DTO files would be hashed.
        assert.deepEqual(config.tasks[task], {
          inputs: ['$TURBO_DEFAULT$', ...BACKEND_CONTRACT_TURBO_GLOBS],
        });
      }
    });
  }

  it('keeps the dependencies of the tasks in the root file, where ADR-009 has the graph', () => {
    const rootConfig = JSON.parse(readFileSync(join(repositoryRoot, 'turbo.json'), 'utf8'));
    assert.deepEqual(rootConfig.tasks.typecheck, { dependsOn: ['^build'] });
    assert.deepEqual(rootConfig.tasks.lint, { dependsOn: ['^build'] });
  });
});

describe('the step on a repository with a pull request branch', () => {
  const made: string[] = [];
  after(() => {
    for (const dir of made) rmSync(dir, { recursive: true, force: true });
  });

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], {
      cwd,
      stdio: 'pipe',
    });

  // `main` holds one backend file; branch `pr` adds `changed`.
  function repository(changed: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'contracts-typecheck-'));
    made.push(root);
    git(root, 'init', '-q', '-b', 'main');
    mkdirSync(join(root, S, 'orders'), { recursive: true });
    writeFileSync(join(root, S, 'orders/order.aggregate.ts'), 'export const a = 1;\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'base');
    git(root, 'checkout', '-q', '-b', 'pr');
    for (const file of changed) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), 'export const b = 1;\n');
    }
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'change');
    return root;
  }

  const step = (root: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync('node', [script, '--root', root, '--dry-run', ...args], {
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] ?? '', ...env },
    });

  it('selects the typecheck when only a DTO changed', () => {
    const root = repository([`${S}/orders/find.request.dto.ts`]);
    const result = step(root, ['--base', 'main']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 backend contract file\(s\) changed/);
    assert.match(result.stdout, /find\.request\.dto\.ts/);
    assert.match(
      result.stdout,
      /turbo run typecheck lint --filter=@bf\/contracts --filter=@bf\/frontend\n/,
    );
    assert.doesNotMatch(result.stdout, /--force/);
  });

  it('selects it for a filter spec behind a DTO', () => {
    const root = repository([`${S}/orders/find.filter-spec.ts`]);
    assert.match(step(root, ['--base', 'main']).stdout, /turbo run typecheck/);
  });

  it('skips a pull request that changes no contract file', () => {
    const root = repository([`${S}/orders/order.repository.ts`, 'docs/note.md']);
    const result = step(root, ['--base', 'main']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skipped/);
    assert.doesNotMatch(result.stdout, /turbo/);
  });

  it('reads the base from the pull request environment of CI', () => {
    const root = repository([`${S}/orders/order-status.enum.ts`]);
    // CI has `origin/<base>`; a local clone has it too, so point `origin/main` at main.
    git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
    const result = step(root, [], { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main' });
    assert.match(result.stdout, /turbo run typecheck/);
  });

  it('does nothing outside a pull request', () => {
    const root = repository([`${S}/orders/find.request.dto.ts`]);
    const result = step(root, [], { GITHUB_EVENT_NAME: 'push' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /not a pull request/);
  });
});
