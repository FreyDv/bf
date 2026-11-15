// The tag job of the ci workflow (DEPLOY-1, ADR-030, ADR-038 item 8): writes the commit SHA that `publish` just pushed
// into deploy/apps/<app>/image.yaml of every app and commits it to `main` as the GitHub App bf-tag-bot. ArgoCD polls
// Git, so that commit is the rollout; a revert of it is the rollback (docs/runbooks/argocd.md).
//
//   node scripts/commit-image-tag.ts <sha> [--identity <git name> <git email>] [--no-push]
//
// Run from a checkout of `main` (full history) whose `origin` credentials may push to it; the workflow supplies them.
// Every run is safe to repeat and to overlap with another: it never moves a tag back to an older commit, and it
// touches nothing but the image.yaml files.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAMESPACE = 'bf';
const PUSH_ATTEMPTS = 3;
const TAG_LINE = /^([ \t]*tag:[ \t]*)(\S+)[ \t]*$/m;

export class Skip extends Error {}

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function imageFile(root: string, app: string): string {
  return `${root}/deploy/apps/${app}/image.yaml`;
}

// The apps that have an image.yaml; the same directories the Applications of deploy/argocd are named after.
export function appsWithImage(root: string): string[] {
  const dir = `${root}/deploy/apps`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((app) => existsSync(imageFile(root, app)))
    .sort();
}

export function readTag(file: string): string {
  const match = TAG_LINE.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`${file}: no \`tag:\` line`);
  return match[2];
}

export function writeTag(file: string, sha: string): boolean {
  const source = readFileSync(file, 'utf8');
  const next = source.replace(TAG_LINE, `$1${sha}`);
  if (next === source) return false;
  writeFileSync(file, next);
  return true;
}

// A tag that is not an ancestor of (or equal to) the commit being published belongs to a newer run, or to a commit
// this history does not contain: either way writing `sha` over it could roll the cluster back.
export function assertNotNewer(root: string, current: string, sha: string, file: string): void {
  if (current === sha) return;
  try {
    git(root, ['cat-file', '-e', `${current}^{commit}`]);
  } catch {
    throw new Error(`${file}: the current tag ${current} is not a commit of this repository`);
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', current, sha], { cwd: root });
  if (ancestor.status === 0) return;
  if (ancestor.status === 1) {
    throw new Skip(`${file}: tag ${current} is not an ancestor of ${sha}; a newer run owns it`);
  }
  throw new Error(`git merge-base failed (${ancestor.status}): ${String(ancestor.stderr)}`);
}

// The same files, in the same order, as the Application (deploy/argocd/<app>.yaml): `helm template` is what ArgoCD
// will run, so a tag that does not render never reaches Git.
export function renderApp(root: string, app: string): void {
  const files = ['values.yaml', 'image.yaml', 'secrets.yaml']
    .map((name) => `${root}/deploy/apps/${app}/${name}`)
    .filter((file) => existsSync(file));
  const valueArgs = files.flatMap((file) => ['-f', file]);
  execFileSync(
    'helm',
    ['template', app, `${root}/deploy/charts/app`, '--namespace', NAMESPACE, ...valueArgs],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

export function changedPaths(root: string): string[] {
  return git(root, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
}

export function assertOnlyImageFiles(paths: string[]): void {
  const stray = paths.filter((path) => !/^deploy\/apps\/[^/]+\/image\.yaml$/.test(path));
  if (stray.length > 0)
    throw new Error(`the tag job changed more than image.yaml: ${stray.join(', ')}`);
}

export interface Options {
  root: string;
  sha: string;
  identity?: { name: string; email: string };
  push: boolean;
  // Test seam: the workflow never sets it.
  render?: (root: string, app: string) => void;
}

// One attempt on the current checkout. Returns the commit message, or null when there was nothing to change.
export function prepare(options: Options): string | null {
  const { root, sha } = options;
  const apps = appsWithImage(root);
  if (apps.length === 0) throw new Error('no deploy/apps/*/image.yaml: nothing to tag');
  for (const app of apps) {
    const file = imageFile(root, app);
    assertNotNewer(root, readTag(file), sha, `deploy/apps/${app}/image.yaml`);
  }
  for (const app of apps) writeTag(imageFile(root, app), sha);
  const changed = changedPaths(root);
  if (changed.length === 0) return null;
  assertOnlyImageFiles(changed);
  for (const app of apps) (options.render ?? renderApp)(root, app);
  return `chore(deploy): image ${sha.slice(0, 7)}`;
}

export function run(options: Options): 'committed' | 'unchanged' | 'skipped' {
  const { root } = options;
  const identity = options.identity
    ? ['-c', `user.name=${options.identity.name}`, '-c', `user.email=${options.identity.email}`]
    : [];
  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt += 1) {
    let message: string | null;
    try {
      message = prepare(options);
    } catch (error) {
      if (error instanceof Skip) {
        console.log(`skip: ${error.message}`);
        return 'skipped';
      }
      throw error;
    }
    if (message === null) {
      console.log(`unchanged: every image.yaml already holds ${options.sha}`);
      return 'unchanged';
    }
    git(root, ['add', '--', 'deploy/apps']);
    git(root, [...identity, 'commit', '--message', message]);
    if (!options.push) return 'committed';
    try {
      git(root, ['push', 'origin', 'HEAD:main']);
      console.log(`pushed: ${message}`);
      return 'committed';
    } catch (error) {
      if (attempt === PUSH_ATTEMPTS) throw error;
      // Someone else moved `main` (a merge, or another tag commit). Our commit is one generated change, so instead of
      // rebasing it onto lines another run may have rewritten (a conflict), take the new `main` and generate it again:
      // that also repeats the check that this run does not write an older tag over a newer one.
      console.log(
        `push rejected (attempt ${attempt} of ${PUSH_ATTEMPTS}); retrying on the new main`,
      );
      git(root, ['fetch', 'origin', 'main']);
      git(root, ['reset', '--hard', 'origin/main']);
    }
  }
  throw new Error('unreachable');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const sha = args[0];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    console.error(
      'usage: node scripts/commit-image-tag.ts <40-hex sha> [--identity <name> <email>] [--no-push]',
    );
    process.exit(2);
  }
  const at = args.indexOf('--identity');
  const identity = at === -1 ? undefined : { name: args[at + 1], email: args[at + 2] };
  if (at !== -1 && (!identity?.name || !identity.email)) {
    console.error('--identity needs a name and an email');
    process.exit(2);
  }
  run({
    root: resolve(import.meta.dirname, '..'),
    sha,
    identity,
    push: !args.includes('--no-push'),
  });
}
