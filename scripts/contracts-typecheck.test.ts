// Proves which files select the contract typecheck (ADR-057) and that the step acts only on a pull request that
// changes one of them. Fixtures are throwaway git repositories; nothing here runs Turborepo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  BACKEND_CONTRACT_FILES,
  GENERATED_FILE_IMPORTS,
  touchesBackendContract,
} from './lib/backend-contract-files.ts';
import { COMMAND, matching } from './contracts-typecheck.ts';

const script = join(import.meta.dirname, 'contracts-typecheck.ts');
const S = 'apps/backend/src';

describe('which files are backend contract files', () => {
  for (const file of [
    `${S}/orders/queries/find/find.request.dto.ts`,
    `${S}/orders/dtos/order.response.dto.ts`,
    `${S}/orders/order-status.enum.ts`,
    `${S}/orders/queries/find/find.filter-spec.ts`,
    `${S}/orders/public/order.filter-spec.ts`,
  ]) {
    it(`selects ${file}`, () => assert.ok(BACKEND_CONTRACT_FILES.test(file)));
  }

  for (const file of [
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
  ]) {
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

  it('runs typecheck and lint for contracts and frontend only', () => {
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
      /turbo run typecheck lint --filter=@bf\/contracts --filter=@bf\/frontend/,
    );
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
