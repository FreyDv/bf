// The tag job's script (DEPLOY-1, ADR-030) against real git repositories: a bare `origin` and clones of it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  appsWithImage,
  assertOnlyImageFiles,
  readTag,
  run,
  writeTag,
  type Options,
} from './commit-image-tag.ts';

const scratch = mkdtempSync(join(tmpdir(), 'commit-image-tag-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const IDENTITY = { name: 'bf-tag-bot[bot]', email: '1+bf-tag-bot[bot]@users.noreply.github.com' };
const apps = ['backend', 'frontend'];

let counter = 0;
// A bare origin with a first commit holding both image.yaml files; returns a clone and a way to add commits.
function setup(): { origin: string; clone: (name: string) => string; first: string } {
  counter += 1;
  const dir = join(scratch, `case-${counter}`);
  const origin = join(dir, 'origin.git');
  mkdirSync(dir);
  git(dir, 'init', '--bare', '--initial-branch=main', origin);
  const seed = join(dir, 'seed');
  git(dir, 'clone', origin, seed);
  git(seed, 'config', 'user.name', 'dev');
  git(seed, 'config', 'user.email', 'dev@example.com');
  for (const app of apps) {
    mkdirSync(join(seed, 'deploy/apps', app), { recursive: true });
    writeFileSync(
      join(seed, 'deploy/apps', app, 'image.yaml'),
      '# written by the bot\nimage:\n  tag: SEED\n',
    );
  }
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'seed');
  const first = git(seed, 'rev-parse', 'HEAD');
  for (const app of apps) writeTag(join(seed, 'deploy/apps', app, 'image.yaml'), first);
  git(seed, 'commit', '-am', 'tag the seed');
  git(seed, 'push', 'origin', 'HEAD:main');
  return {
    origin,
    first,
    clone(name) {
      const path = join(dir, name);
      git(dir, 'clone', origin, path);
      git(path, 'config', 'user.name', 'dev');
      git(path, 'config', 'user.email', 'dev@example.com');
      return path;
    },
  };
}

// A commit on main in `repo` (not touching deploy/), pushed; returns its SHA.
function commit(repo: string, file: string): string {
  writeFileSync(join(repo, file), file);
  git(repo, 'add', file);
  git(repo, 'commit', '-m', file);
  git(repo, 'push', 'origin', 'HEAD:main');
  return git(repo, 'rev-parse', 'HEAD');
}

const noRender = () => {};
const options = (root: string, sha: string, extra: Partial<Options> = {}): Options => ({
  root,
  sha,
  identity: IDENTITY,
  push: true,
  render: noRender,
  ...extra,
});

describe('commit-image-tag', () => {
  it('writes the SHA into both image.yaml files, keeps the comment and pushes one bot commit', () => {
    const { clone, origin } = setup();
    const work = clone('work');
    const sha = commit(work, 'a.txt');
    assert.equal(run(options(work, sha)), 'committed');
    const check = join(scratch, `check-${counter}`);
    git(scratch, 'clone', origin, check);
    for (const app of apps) {
      const text = readFileSync(join(check, 'deploy/apps', app, 'image.yaml'), 'utf8');
      assert.equal(text, `# written by the bot\nimage:\n  tag: ${sha}\n`);
    }
    assert.equal(git(check, 'log', '-1', '--format=%s'), `chore(deploy): image ${sha.slice(0, 7)}`);
    assert.equal(
      git(check, 'log', '-1', '--format=%an <%ae>'),
      `${IDENTITY.name} <${IDENTITY.email}>`,
    );
    assert.equal(git(check, 'show', '--name-only', '--format=', 'HEAD').split('\n').length, 2);
  });

  it('makes no commit when the tag is already the SHA', () => {
    const { clone } = setup();
    const work = clone('work');
    const sha = commit(work, 'a.txt');
    run(options(work, sha));
    const head = git(work, 'rev-parse', 'HEAD');
    assert.equal(run(options(work, sha)), 'unchanged');
    assert.equal(git(work, 'rev-parse', 'HEAD'), head);
  });

  it('never writes an older SHA over a newer tag', () => {
    const { clone } = setup();
    const work = clone('work');
    const older = commit(work, 'a.txt');
    const newer = commit(work, 'b.txt');
    assert.equal(run(options(work, newer)), 'committed');
    const head = git(work, 'rev-parse', 'HEAD');
    assert.equal(run(options(work, older)), 'skipped');
    assert.equal(git(work, 'rev-parse', 'HEAD'), head);
    assert.equal(readTag(join(work, 'deploy/apps/backend/image.yaml')), newer);
  });

  it('retries on the new main when the push is rejected, and keeps the newer tag another run wrote', () => {
    const { clone } = setup();
    const ours = clone('ours');
    const theirs = clone('theirs');
    const older = commit(ours, 'a.txt');
    git(theirs, 'pull', '--ff-only', 'origin', 'main');
    const newer = commit(theirs, 'b.txt');
    // `theirs` tags the newer commit first; `ours` is then behind and its push is rejected.
    run(options(theirs, newer));
    assert.equal(run(options(ours, older)), 'skipped');
    assert.equal(readTag(join(ours, 'deploy/apps/backend/image.yaml')), newer);
  });

  it('rebuilds its commit on the new main when an unrelated commit won the race', () => {
    const { clone, origin } = setup();
    const ours = clone('ours');
    const theirs = clone('theirs');
    const sha = commit(ours, 'a.txt');
    git(theirs, 'pull', '--ff-only', 'origin', 'main');
    commit(theirs, 'unrelated.txt');
    assert.equal(run(options(ours, sha)), 'committed');
    const check = join(scratch, `check-${counter}`);
    git(scratch, 'clone', origin, check);
    assert.equal(readTag(join(check, 'deploy/apps/frontend/image.yaml')), sha);
    assert.equal(
      git(check, 'log', '--format=%s', '-3').split('\n')[1],
      'unrelated.txt',
      'the bot commit sits on top of the commit that won the race',
    );
  });

  it('refuses to push when helm cannot render the new tag', () => {
    const { clone, origin } = setup();
    const work = clone('work');
    const sha = commit(work, 'a.txt');
    const failing = () => {
      throw new Error('helm: image.tag is required');
    };
    assert.throws(() => run(options(work, sha, { render: failing })), /image.tag is required/);
    const check = join(scratch, `check-${counter}`);
    git(scratch, 'clone', origin, check);
    assert.equal(git(check, 'log', '-1', '--format=%s'), 'a.txt');
  });

  it('fails when the current tag is not a commit of this repository', () => {
    const { clone } = setup();
    const work = clone('work');
    const sha = commit(work, 'a.txt');
    writeTag(join(work, 'deploy/apps/backend/image.yaml'), '0'.repeat(40));
    assert.throws(
      () => run(options(work, sha, { push: false })),
      /not a commit of this repository/,
    );
  });

  it('accepts only deploy/apps/<app>/image.yaml as the changed set', () => {
    assertOnlyImageFiles(['deploy/apps/backend/image.yaml', 'deploy/apps/frontend/image.yaml']);
    assert.throws(
      () => assertOnlyImageFiles(['deploy/apps/backend/values.yaml']),
      /more than image.yaml/,
    );
    assert.throws(
      () => assertOnlyImageFiles(['deploy/apps/backend/image.yaml', '.github/workflows/ci.yml']),
      /ci.yml/,
    );
  });

  it('finds the apps by their image.yaml', () => {
    const { clone } = setup();
    assert.deepEqual(appsWithImage(clone('work')), apps);
  });
});

// The workflow around the script (ADR-030, ADR-038 item 8): what must not drift without a test failing.
describe('tag job in ci.yml', () => {
  const workflow = readFileSync(join(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');
  const tag = workflow.slice(workflow.indexOf('\n  tag:\n'));

  it('runs only on main, only after publish, in its own queue that is never cancelled', () => {
    assert.match(tag, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\n/);
    assert.match(tag, /needs: \[publish\]\n/);
    assert.match(
      tag,
      /concurrency:\n\s+(#.*\n\s+)*group: deploy-tag\n\s+cancel-in-progress: false\n/,
    );
  });

  it('keeps GITHUB_TOKEN read-only: no job of the workflow may write contents', () => {
    assert.doesNotMatch(workflow, /^\s*contents: write/m);
    assert.match(tag, /permissions:\n\s+contents: read/);
  });

  it('gets its token from the App, for this repository only, by a pinned action', () => {
    assert.match(
      tag,
      /uses: actions\/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3\.3\.0\n/,
    );
    assert.match(tag, /client-id: \$\{\{ secrets\.BOT_CLIENT_ID \}\}/);
    assert.doesNotMatch(tag, /app-id:/);
    assert.match(tag, /private-key: \$\{\{ secrets\.BOT_APP_PRIVATE_KEY \}\}/);
    assert.match(tag, /repositories: \$\{\{ github\.event\.repository\.name \}\}/);
    assert.match(tag, /ref: main\n/);
  });

  it('is not triggered by its own commit', () => {
    assert.match(workflow, /paths-ignore:\n\s+- deploy\/apps\/\*\/image\.yaml\n/);
  });

  it('retries the anonymous pulls five times with waits of 5, 10, 20 and 40 seconds', () => {
    assert.equal(workflow.match(/for wait in 5 10 20 40 stop; do/g)?.length, 2);
  });
});
