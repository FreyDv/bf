// What the GHCR retention keeps (GHCR-1, ADR-074): the plan is pure, so no registry and no network here; the git
// history of image.yaml is read from a real throwaway repository.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { KEEP_DAYS, KEEP_SHAS, plan, tagHistory, type Version } from './ghcr-retention.ts';

const NOW = new Date('2026-12-31T00:00:00Z');
const old = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const sha = (n: number) => n.toString(16).padStart(40, '0');

let id = 0;
const version = (
  tags: string[],
  ageDays: number,
  digest = `sha256:${(++id).toString(16).padStart(64, '0')}`,
): Version => ({
  id,
  digest,
  createdAt: old(ageDays),
  tags,
});
const noChildren = () => [];
const removed = (p: { remove: readonly Version[] }) => p.remove.map((v) => v.digest);

describe('the retention plan', () => {
  it('keeps the tag of image.yaml even when it is old', () => {
    const current = version([sha(1)], 400);
    const p = plan({
      versions: [current],
      current: sha(1),
      history: [sha(1)],
      now: NOW,
      children: noChildren,
    });
    assert.deepEqual(removed(p), []);
  });

  it('refuses when the tag of image.yaml is not in the registry', () => {
    assert.throws(
      () =>
        plan({
          versions: [version([sha(2)], 1)],
          current: sha(1),
          history: [],
          now: NOW,
          children: noChildren,
        }),
      /not in the registry; nothing is deleted/,
    );
  });

  it(`keeps the last ${KEEP_SHAS} tags of the history and deletes older ones`, () => {
    const history = Array.from({ length: KEEP_SHAS + 5 }, (_, i) => sha(i + 1));
    const versions = history.map((tag) => version([tag], KEEP_DAYS + 10));
    const p = plan({ versions, current: sha(1), history, now: NOW, children: noChildren });
    assert.equal(p.keep.length, KEEP_SHAS);
    assert.deepEqual(
      p.remove.map((v) => v.tags[0]),
      history.slice(KEEP_SHAS),
    );
  });

  it(`keeps anything younger than ${KEEP_DAYS} days, tagged or not`, () => {
    const current = version([sha(1)], 1);
    const recent = version([sha(99)], KEEP_DAYS - 1);
    const untagged = version([], 2);
    const p = plan({
      versions: [current, recent, untagged],
      current: sha(1),
      history: [sha(1)],
      now: NOW,
      children: noChildren,
    });
    assert.deepEqual(removed(p), []);
  });

  it('keeps a tag that is not a commit SHA', () => {
    const current = version([sha(1)], 1);
    const other = version(['buildcache'], 300);
    const p = plan({
      versions: [current, other],
      current: sha(1),
      history: [sha(1)],
      now: NOW,
      children: noChildren,
    });
    assert.deepEqual(removed(p), []);
  });

  it('keeps the manifests a kept index points at and deletes orphans', () => {
    const child = version([], 200);
    const attestation = version([], 200);
    const orphan = version([], 200);
    const current = version([sha(1)], 200);
    const p = plan({
      versions: [current, child, attestation, orphan],
      current: sha(1),
      history: [sha(1)],
      now: NOW,
      children: (digest) => (digest === current.digest ? [child.digest, attestation.digest] : []),
    });
    assert.deepEqual(removed(p), [orphan.digest]);
  });

  it('deletes the children of a deleted index too', () => {
    const current = version([sha(1)], 1);
    const gone = version([sha(500)], 200);
    const goneChild = version([], 200);
    const p = plan({
      versions: [current, gone, goneChild],
      current: sha(1),
      history: [sha(1)],
      now: NOW,
      children: (digest) => (digest === gone.digest ? [goneChild.digest] : []),
    });
    assert.deepEqual(removed(p), [gone.digest, goneChild.digest]);
  });
});

describe('the tag history of image.yaml', () => {
  const root = mkdtempSync(join(tmpdir(), 'ghcr-retention-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], {
      cwd: root,
      stdio: 'pipe',
    });

  it('lists distinct tags, newest first', () => {
    git('init', '-q', '-b', 'main');
    mkdirSync(join(root, 'deploy/apps/backend'), { recursive: true });
    for (const tag of [sha(1), sha(2), sha(1), sha(3)]) {
      writeFileSync(join(root, 'deploy/apps/backend/image.yaml'), `image:\n  tag: ${tag}\n`);
      git('add', '-A');
      git('commit', '-q', '--allow-empty', '-m', tag);
    }
    assert.deepEqual(tagHistory(root, 'backend'), [sha(3), sha(1), sha(2)]);
  });
});
