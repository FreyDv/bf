// Installs the pnpm that package.json pins, after checking the tarball against the hash pinned next to the version
// (CI-3, ADR-072). `packageManager` is the one home of both (R4): `pnpm@<version>+sha512.<hex>`, the corepack format,
// which pnpm itself accepts. Node 26 does not bundle corepack, so this does what corepack would.
//
//   node scripts/install-pnpm.ts [--root <dir with package.json>] [--dry-run]
//
// Used by the jobs of .github/workflows/ci.yml and by both Dockerfiles, before anything else needs pnpm.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PINNED = /^pnpm@(\d+\.\d+\.\d+)\+sha512\.([0-9a-f]{128})$/;

export interface Pin {
  readonly version: string;
  readonly sha512: string;
}

/** Reads `packageManager`; a value without the hash is refused, so the pin cannot silently lose its check. */
export function readPin(packageJson: string): Pin {
  const value: unknown = (JSON.parse(packageJson) as { packageManager?: unknown }).packageManager;
  const match = typeof value === 'string' ? PINNED.exec(value) : null;
  if (!match) {
    throw new Error(
      `package.json packageManager must be pnpm@<x.y.z>+sha512.<128 hex>, got ${JSON.stringify(value)}`,
    );
  }
  return { version: match[1], sha512: match[2] };
}

/** Throws unless the tarball's sha512 is the pinned one. */
export function verify(tarball: Buffer, pin: Pin): void {
  const actual = createHash('sha512').update(tarball).digest('hex');
  if (actual !== pin.sha512) {
    throw new Error(
      `pnpm ${pin.version}: tarball sha512 ${actual} does not match the pin in package.json ${pin.sha512}`,
    );
  }
}

export interface Npm {
  /** Downloads pnpm@version into dir and returns the tarball path. */
  pack(version: string, dir: string): string;
  /** Installs the tarball globally. */
  installGlobal(tarball: string): void;
}

const npm: Npm = {
  pack(version, dir) {
    const name = execFileSync(
      'npm',
      ['pack', `pnpm@${version}`, '--pack-destination', dir, '--silent'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    )
      .trim()
      .split('\n')
      .at(-1);
    if (!name) throw new Error('npm pack printed no file name');
    return join(dir, name);
  },
  installGlobal(tarball) {
    execFileSync('npm', ['install', '--global', tarball], { stdio: 'inherit' });
  },
};

export function install(root: string, options: { dryRun?: boolean; npm?: Npm } = {}): Pin {
  const pin = readPin(readFileSync(join(root, 'package.json'), 'utf8'));
  const tools = options.npm ?? npm;
  const dir = mkdtempSync(join(tmpdir(), 'install-pnpm-'));
  try {
    const tarball = tools.pack(pin.version, dir);
    verify(readFileSync(tarball), pin);
    if (!options.dryRun) tools.installGlobal(tarball);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return pin;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--root');
  const root = resolve(at === -1 ? process.cwd() : (args[at + 1] ?? '.'));
  try {
    const pin = install(root, { dryRun: args.includes('--dry-run') });
    console.log(
      `pnpm ${pin.version}: sha512 matches package.json${args.includes('--dry-run') ? ' (dry run, not installed)' : ', installed'}`,
    );
  } catch (error) {
    console.error(`install-pnpm: ${(error as Error).message}`);
    process.exit(1);
  }
}
