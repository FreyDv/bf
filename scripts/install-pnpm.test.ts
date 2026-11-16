// The pnpm install of CI and the images (CI-3, ADR-072): the pin is read from package.json and a tarball whose hash
// differs is never installed. npm is faked; no network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { install, readPin, verify, type Npm } from './install-pnpm.ts';

const scratch = mkdtempSync(join(tmpdir(), 'install-pnpm-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const TARBALL = Buffer.from('a pnpm tarball');
const HASH = createHash('sha512').update(TARBALL).digest('hex');
const manifest = (packageManager: unknown) => JSON.stringify({ name: 'x', packageManager });

function fakeNpm(content: Buffer): Npm & { installed: string[] } {
  const installed: string[] = [];
  return {
    installed,
    pack(version, dir) {
      const file = join(dir, `pnpm-${version}.tgz`);
      writeFileSync(file, content);
      return file;
    },
    installGlobal(tarball) {
      installed.push(tarball);
    },
  };
}

function repo(packageManager: unknown): string {
  const dir = mkdtempSync(join(scratch, 'repo-'));
  writeFileSync(join(dir, 'package.json'), manifest(packageManager));
  return dir;
}

describe('the pin in package.json', () => {
  it('reads the version and the hash', () => {
    assert.deepEqual(readPin(manifest(`pnpm@11.28.10+sha512.${HASH}`)), {
      version: '11.28.10',
      sha512: HASH,
    });
  });

  for (const value of [
    'pnpm@11.28.10',
    `npm@11.0.0+sha512.${HASH}`,
    `pnpm@11.28.10+sha256.${HASH}`,
    undefined,
  ]) {
    it(`refuses ${String(value)}`, () =>
      assert.throws(() => readPin(manifest(value)), /packageManager must be/));
  }

  it('is the pin of this repository', () => {
    const root = join(import.meta.dirname, '..');
    assert.match(
      readPin(readFileSync(join(root, 'package.json'), 'utf8')).version,
      /^\d+\.\d+\.\d+$/,
    );
  });
});

describe('the install', () => {
  it('installs a tarball whose sha512 matches', () => {
    const npm = fakeNpm(TARBALL);
    install(repo(`pnpm@1.2.3+sha512.${HASH}`), { npm });
    assert.equal(npm.installed.length, 1);
  });

  it('installs nothing when the tarball differs', () => {
    const npm = fakeNpm(Buffer.from('something else'));
    assert.throws(
      () => install(repo(`pnpm@1.2.3+sha512.${HASH}`), { npm }),
      /does not match the pin/,
    );
    assert.deepEqual(npm.installed, []);
  });

  it('checks without installing on a dry run', () => {
    const npm = fakeNpm(TARBALL);
    install(repo(`pnpm@1.2.3+sha512.${HASH}`), { npm, dryRun: true });
    assert.deepEqual(npm.installed, []);
  });

  it('verify alone throws on one changed byte', () => {
    const changed = Buffer.from(TARBALL);
    changed[0] ^= 1;
    assert.throws(() => verify(changed, { version: '1.2.3', sha512: HASH }));
  });
});
