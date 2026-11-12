// Proves the migration check on fixtures (ADR-036): it skips when nothing changed, refuses `down` files and edits of
// applied migrations, and applies base then pull request to a real clean Postgres. The database cases need Docker.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { CONTRACT, plan } from './check-migrations.ts';

const here = import.meta.dirname;
const fixtures = join(here, 'fixtures/migrations');
const script = join(here, 'check-migrations.ts');
const compose = resolve(here, '../compose.yaml');

const hasDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const database = { skip: hasDocker ? false : 'docker is not available' };

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], {
    cwd,
    stdio: 'pipe',
  });

// A repository with `main` holding `<fixture>/base` and a branch `pr` holding `<fixture>/pr`.
function repository(name: string, edit?: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'check-migrations-'));
  const dir = join(root, CONTRACT.dir);
  git(root, 'init', '-q', '-b', 'main');
  cpSync(compose, join(root, 'compose.yaml'));
  mkdirSync(dir, { recursive: true });
  cpSync(join(fixtures, name, 'base'), dir, { recursive: true });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'pr');
  rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(fixtures, name, 'pr'), dir, { recursive: true });
  edit?.(root);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'pr');
  return root;
}

function run(root: string) {
  const result = spawnSync('node', [script, '--root', root, '--base', 'main'], {
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const roots: string[] = [];
const make = (name: string, edit?: (root: string) => void) => {
  const root = repository(name, edit);
  roots.push(root);
  return root;
};
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('plan: what a pull request may do to the history', () => {
  const base = new Map([['0000_a.sql', 'select 1;']]);

  it('applies the base, then only what the pull request adds, in name order', () => {
    const head = new Map([...base, ['0002_c.sql', 'select 3;'], ['0001_b.sql', 'select 2;']]);
    assert.deepEqual(plan(base, head), {
      errors: [],
      applyFirst: ['0000_a.sql'],
      applyThen: ['0001_b.sql', '0002_c.sql'],
    });
  });

  it('refuses a down file, in any spelling', () => {
    for (const name of ['0001_b.down.sql', '0001_b_down.sql', 'down/0001_b.sql', 'down.sql']) {
      const { errors } = plan(base, new Map([...base, [name, 'select 2;']]));
      assert.equal(errors.length, 1, name);
      assert.match(errors[0] ?? '', /down migrations are forbidden/);
    }
  });

  it('does not take a word that merely contains "down" for a down file', () => {
    assert.deepEqual(plan(base, new Map([...base, ['0001_markdown.sql', 'select 2;']])).errors, []);
  });

  it('refuses an edited and a deleted migration of the base branch', () => {
    assert.match(plan(base, new Map([['0000_a.sql', 'select 9;']])).errors[0] ?? '', /edited/);
    assert.match(plan(base, new Map()).errors[0] ?? '', /deleted/);
  });
});

describe('check-migrations: without a database', () => {
  it('skips when the pull request does not touch the migrations directory', () => {
    const root = make('no-change', (repo) =>
      writeFileSync(join(repo, 'NOTE.md'), 'outside the migrations directory\n'),
    );
    const { status, output } = run(root);
    assert.equal(status, 0, output);
    assert.match(output, /skipped/);
  });

  it('fails on a down file before it starts a database', () => {
    const { status, output } = run(make('down-file'));
    assert.equal(status, 1);
    assert.match(output, /0001_orders\.down\.sql: down migrations are forbidden/);
  });

  it('fails when a migration of the base branch is edited or deleted', () => {
    assert.match(run(make('edited-base')).output, /0000_users\.sql: .*edited/);
    assert.match(run(make('deleted-base')).output, /0000_users\.sql: .*deleted/);
  });
});

describe('check-migrations: on a clean Postgres', database, () => {
  it('applies the base and then a migration that depends on it', () => {
    const { status, output } = run(make('valid'));
    assert.equal(status, 0, output);
    assert.match(output, /OK \(1 of the base branch, then 1 of the pull request\)/);
  });

  it('fails on a migration that errors, and names the file and the error', () => {
    const { status, output } = run(make('sql-error'));
    assert.equal(status, 1);
    assert.match(output, /pull request: 0001_orders\.sql: .*customers/);
  });
});

describe('check-migrations: the environment', () => {
  it('has Docker in CI, so that the database cases cannot be skipped there', () => {
    if (process.env['CI']) assert.ok(hasDocker, 'CI must run the database cases');
  });
});
