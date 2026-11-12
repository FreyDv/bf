// Migration check of CI (ADR-018, ADR-036): applies the migrations of the base branch and then those of the
// pull request to a clean Postgres, and fails on any error. It runs only when the pull request touches the
// migrations directory, and it never needs a credential: the database is a throwaway container.
//
//   node scripts/check-migrations.ts [--base <ref>] [--root <repo>]
//
// The base is the merge base of `--base` (default `$BASE_REF`, then `origin/main`) and HEAD, so the check sees what the
// pull request changes and nothing that landed on `main` after it branched.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Where the migrations live and how one is applied: the only place that says so (ADR-036). The files are
// forward-only SQL (ADR-013) run in name order; one file is one transaction, `psql` reads it from stdin.
export const CONTRACT = {
  dir: 'apps/backend/migrations',
  apply: [
    'psql',
    '-X',
    '-q',
    '-h',
    '127.0.0.1',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '--single-transaction',
    '-f',
    '-',
  ],
};

export type Migrations = Map<string, string>;

export type Plan = { errors: string[]; applyFirst: string[]; applyThen: string[] };

const DOWN = /(^|[._-])down([._-]|$)/i;

// What the pull request does to the history: no `down` file (ADR-013 item 4), and no change to a migration
// that `main` already has, because every record in the history is a fact (ADR-013, Consequences).
export function plan(base: Migrations, head: Migrations): Plan {
  const errors: string[] = [];
  for (const name of head.keys()) {
    if (name.split('/').some((part) => DOWN.test(part)))
      errors.push(`${name}: down migrations are forbidden (ADR-013)`);
  }
  for (const [name, sql] of base) {
    if (!head.has(name)) errors.push(`${name}: a migration of the base branch was deleted`);
    else if (head.get(name) !== sql)
      errors.push(`${name}: a migration of the base branch was edited`);
  }
  const added = [...head.keys()].filter((name) => !base.has(name)).sort();
  return { errors, applyFirst: [...base.keys()].sort(), applyThen: added };
}

const sqlFile = (name: string) => name.endsWith('.sql');

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readTree(root: string, ref: string): Migrations {
  const files = new Map<string, string>();
  const listing = git(root, ['ls-tree', '-r', '--name-only', ref, '--', CONTRACT.dir]).split('\n');
  for (const path of listing.filter(Boolean)) {
    const name = path.slice(CONTRACT.dir.length + 1);
    // `git show` keeps the content exactly as committed, line endings included.
    if (sqlFile(name) || name.split('/').some((part) => DOWN.test(part)))
      files.set(name, git(root, ['show', `${ref}:${path}`]));
  }
  return files;
}

// The image of the clean database is the one `compose.yaml` runs locally (ADR-033): one home for the version.
function postgresImage(root: string): string {
  const match = /^\s+image:\s*(postgres:\S+)\s*$/m.exec(
    readFileSync(`${root}/compose.yaml`, 'utf8'),
  );
  if (!match?.[1]) throw new Error('compose.yaml has no postgres image');
  return match[1];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function docker(args: string[], input?: string) {
  return spawnSync('docker', args, { encoding: 'utf8', input });
}

async function withDatabase<T>(image: string, use: (container: string) => Promise<T>): Promise<T> {
  const container = `bf-migrations-${process.pid}`;
  // No init scripts are mounted: the database is as clean as the image makes it. Nothing is published to the host.
  const started = docker([
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_PASSWORD=check',
    image,
  ]);
  if (started.status !== 0) throw new Error(`cannot start ${image}\n${started.stderr}`);
  try {
    // The image starts a temporary server on the socket only, restarts, and then listens on TCP: ready means TCP.
    for (let attempt = 0; ; attempt += 1) {
      const ready = docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
      if (ready.status === 0) break;
      if (attempt >= 60) throw new Error(`${image} did not become ready in 60 s`);
      await sleep(1000);
    }
    return await use(container);
  } finally {
    docker(['rm', '-f', container]);
  }
}

function apply(container: string, name: string, sql: string): string | undefined {
  const run = docker(['exec', '-i', '-e', 'PGPASSWORD=check', container, ...CONTRACT.apply], sql);
  return run.status === 0
    ? undefined
    : `${name}: ${run.stderr.trim() || `psql exited with ${run.status}`}`;
}

export async function check(root: string, baseRef: string): Promise<number> {
  const changed = git(root, ['diff', '--name-only', `${baseRef}...HEAD`, '--', CONTRACT.dir])
    .split('\n')
    .filter(Boolean);
  if (changed.length === 0) {
    console.log(`check-migrations: no change under ${CONTRACT.dir}, skipped`);
    return 0;
  }
  const mergeBase = git(root, ['merge-base', baseRef, 'HEAD']).trim();
  const base = readTree(root, mergeBase);
  const head = readTree(root, 'HEAD');
  const result = plan(base, head);
  if (result.errors.length > 0) {
    console.error(
      `check-migrations: ${result.errors.length} problem(s)\n${result.errors.join('\n')}`,
    );
    return 1;
  }
  const failures = await withDatabase(postgresImage(root), async (container) => {
    const found: string[] = [];
    for (const [stage, names, source] of [
      ['base', result.applyFirst, base],
      ['pull request', result.applyThen, head],
    ] as const) {
      for (const name of names) {
        const failure = apply(container, name, source.get(name) ?? '');
        if (failure) {
          found.push(`${stage}: ${failure}`);
          return found;
        }
      }
    }
    return found;
  });
  if (failures.length > 0) {
    console.error(
      `check-migrations: a migration failed on a clean database\n${failures.join('\n')}`,
    );
    return 1;
  }
  console.log(
    `check-migrations: OK (${result.applyFirst.length} of the base branch, then ${result.applyThen.length} of the pull request)`,
  );
  return 0;
}

if (import.meta.main) {
  const argument = (flag: string) => {
    const at = process.argv.indexOf(flag);
    return at >= 0 ? process.argv[at + 1] : undefined;
  };
  const root = resolve(argument('--root') ?? `${import.meta.dirname}/..`);
  const base = argument('--base') ?? process.env['BASE_REF'] ?? 'origin/main';
  process.exit(await check(root, base));
}
