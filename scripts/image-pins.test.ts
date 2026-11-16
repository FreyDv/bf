// Image pins (IMG-1, ADR-076): the check without network, and the bump against a fake registry.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  apply,
  bumps,
  COOLDOWN_DAYS,
  problems,
  readPins,
  type Pin,
  type Registry,
} from './image-pins.ts';

const scratch = mkdtempSync(join(tmpdir(), 'image-pins-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const digest = (c: string) => `sha256:${c.repeat(64)}`;
const NOW = new Date('2026-12-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function repo(nodeTag: string, backendDigest: string, frontendDigest = backendDigest): string {
  const root = mkdtempSync(join(scratch, 'repo-'));
  for (const [app, d] of [
    ['backend', backendDigest],
    ['frontend', frontendDigest],
  ] as const) {
    mkdirSync(join(root, 'apps', app), { recursive: true });
    writeFileSync(
      join(root, 'apps', app, 'Dockerfile'),
      `FROM node:${nodeTag}@${d} AS base\nFROM base AS build\nFROM node:${nodeTag}@${d} AS runtime\n`,
    );
  }
  mkdirSync(join(root, 'scripts'));
  writeFileSync(
    join(root, 'scripts/image-check.ts'),
    `const HADOLINT = 'hadolint/hadolint:v2.15.1@${digest('b')}';\nconst TRIVY = 'aquasec/trivy:0.76.1@${digest('c')}';\n`,
  );
  return root;
}

describe('the check', () => {
  it('reads the node pins of every Dockerfile and the tool pins', () => {
    const pins = readPins(repo('26.13.0-slim', digest('a')));
    assert.deepEqual(
      pins.map((p) => `${p.file} ${p.repo}:${p.tag}`),
      [
        'apps/backend/Dockerfile node:26.13.0-slim',
        'apps/backend/Dockerfile node:26.13.0-slim',
        'apps/frontend/Dockerfile node:26.13.0-slim',
        'apps/frontend/Dockerfile node:26.13.0-slim',
        'scripts/image-check.ts hadolint/hadolint:v2.15.1',
        'scripts/image-check.ts aquasec/trivy:0.76.1',
      ],
    );
  });

  it('passes when the tag equals .nvmrc and the digests agree', () => {
    assert.deepEqual(problems(readPins(repo('26.13.0-slim', digest('a'))), '26.13.0'), []);
  });

  it('fails when the node tag is not .nvmrc', () => {
    assert.match(
      problems(readPins(repo('26.12.0-slim', digest('a'))), '26.13.0')[0] ?? '',
      /not node:26\.13\.0-slim/,
    );
  });

  it('fails when two Dockerfiles pin different digests', () => {
    assert.match(
      problems(readPins(repo('26.13.0-slim', digest('a'), digest('d'))), '26.13.0').join('\n'),
      /differ in digest/,
    );
  });

  it('holds for the pins of this repository', () => {
    const root = join(import.meta.dirname, '..');
    assert.deepEqual(
      problems(readPins(root), readFileSync(join(root, '.nvmrc'), 'utf8').trim()),
      [],
    );
  });
});

describe('the bump', () => {
  const registry =
    (published: Record<string, { digest: string; created: Date }>): Registry =>
    async (name, tag) => {
      const found = published[`${name}:${tag}`];
      if (!found) throw new Error(`unknown ${name}:${tag}`);
      return found;
    };

  it(`writes a new digest only after ${COOLDOWN_DAYS} days`, async () => {
    const root = repo('26.13.0-slim', digest('a'));
    const pins = readPins(root);
    const all = await bumps(
      pins,
      registry({
        'node:26.13.0-slim': { digest: digest('e'), created: daysAgo(COOLDOWN_DAYS) },
        'hadolint/hadolint:v2.15.1': { digest: digest('f'), created: daysAgo(1) },
        'aquasec/trivy:0.76.1': { digest: digest('c'), created: daysAgo(30) },
      }),
      NOW,
    );
    assert.deepEqual(
      all.map((b) => `${b.pin.repo} ${b.due}`),
      ['node true', 'node true', 'node true', 'node true', 'hadolint/hadolint false'],
    );
    apply(
      root,
      all.filter((b) => b.due),
    );
    const after: Pin[] = readPins(root);
    assert.ok(after.filter((p) => p.repo === 'node').every((p) => p.digest === digest('e')));
    assert.equal(after.find((p) => p.repo === 'hadolint/hadolint')?.digest, digest('b'));
    assert.deepEqual(problems(after, '26.13.0'), []);
  });

  it('finds nothing to do when the registry serves the pinned digests', async () => {
    const all = await bumps(
      readPins(repo('26.13.0-slim', digest('a'))),
      registry({
        'node:26.13.0-slim': { digest: digest('a'), created: daysAgo(40) },
        'hadolint/hadolint:v2.15.1': { digest: digest('b'), created: daysAgo(40) },
        'aquasec/trivy:0.76.1': { digest: digest('c'), created: daysAgo(40) },
      }),
      NOW,
    );
    assert.deepEqual(all, []);
  });
});
