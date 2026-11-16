// Retention of the images in GHCR (GHCR-1, ADR-074, ADR-026 item 7). For every app with deploy/apps/<app>/image.yaml
// the package ghcr.io/<owner>/bf-<app> keeps:
//   - the tag image.yaml names now, and the last KEEP_SHAS distinct tags image.yaml named in its git history (what a
//     rollback by revert can return to, docs/runbooks/argocd.md);
//   - every version published within KEEP_DAYS (a publish whose tag commit has not landed yet, a recent rollback);
//   - every tag that is not a commit SHA (never ours to judge);
//   - the manifests a kept image index points at (platform images, SBOM and provenance attestations).
// Everything else is deleted. Without --apply it only prints the plan. It refuses to delete anything when the tag of
// image.yaml is not in the registry: then the inputs are wrong, not the registry.
//
//   node scripts/ghcr-retention.ts [--apply]      env: GITHUB_TOKEN, GHCR_OWNER (the account, e.g. FreyDv)
//
// Run from a full-history checkout of `main` (.github/workflows/ghcr-retention.yml).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { appsWithImage, imageFile, readTag } from './commit-image-tag.ts';

export const KEEP_SHAS = 20;
export const KEEP_DAYS = 30;
const SHA = /^[0-9a-f]{40}$/;
const DAY_MS = 86_400_000;

export interface Version {
  readonly id: number;
  /** The manifest digest, `sha256:...`. */
  readonly digest: string;
  readonly createdAt: string;
  readonly tags: readonly string[];
}

export interface Plan {
  readonly keep: readonly Version[];
  readonly remove: readonly Version[];
}

export interface PlanInput {
  readonly versions: readonly Version[];
  /** The tag in image.yaml on `main`. */
  readonly current: string;
  /** Distinct tags of image.yaml's history, newest first, the current one included. */
  readonly history: readonly string[];
  readonly now: Date;
  /** Digests a manifest index points at, per index digest. */
  readonly children: (indexDigest: string) => readonly string[];
}

/** Which versions stay and which go. Pure: everything it needs is in the input. */
export function plan(input: PlanInput): Plan {
  const { versions, current, now } = input;
  if (!versions.some((v) => v.tags.includes(current))) {
    throw new Error(
      `the tag of image.yaml (${current}) is not in the registry; nothing is deleted`,
    );
  }
  const rollback = new Set([current, ...input.history.slice(0, KEEP_SHAS)]);
  const fresh = (v: Version) => now.getTime() - Date.parse(v.createdAt) < KEEP_DAYS * DAY_MS;
  const keptTagged = versions.filter(
    (v) =>
      v.tags.length > 0 && (fresh(v) || v.tags.some((tag) => rollback.has(tag) || !SHA.test(tag))),
  );
  const keptDigests = new Set(keptTagged.map((v) => v.digest));
  for (const v of keptTagged) for (const child of input.children(v.digest)) keptDigests.add(child);

  const keep: Version[] = [];
  const remove: Version[] = [];
  for (const v of versions) {
    if (keptDigests.has(v.digest) || fresh(v)) keep.push(v);
    else remove.push(v);
  }
  return { keep, remove };
}

/** Distinct tags image.yaml of `app` named, newest commit first. */
export function tagHistory(root: string, app: string): string[] {
  const path = `deploy/apps/${app}/image.yaml`;
  const commits = execFileSync('git', ['log', '--format=%H', '--', path], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const tags: string[] = [];
  for (const commit of commits) {
    let text: string;
    try {
      text = execFileSync('git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8' });
    } catch {
      continue; // the commit deleted the file
    }
    const tag = /^[ \t]*tag:[ \t]*(\S+)/m.exec(text)?.[1];
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

const API = 'https://api.github.com';

async function github(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response;
}

interface ApiVersion {
  id: number;
  name: string;
  created_at: string;
  metadata?: { container?: { tags?: string[] } };
}

async function listVersions(token: string, owner: string, pkg: string): Promise<Version[]> {
  const versions: Version[] = [];
  for (let page = 1; ; page += 1) {
    const response = await github(
      token,
      `/users/${owner}/packages/container/${pkg}/versions?per_page=100&page=${page}`,
    );
    const batch = (await response.json()) as ApiVersion[];
    for (const v of batch) {
      versions.push({
        id: v.id,
        digest: v.name,
        createdAt: v.created_at,
        tags: v.metadata?.container?.tags ?? [],
      });
    }
    if (batch.length < 100) return versions;
  }
}

const INDEX_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** The digests an index points at; read anonymously, the packages are public (ADR-026 item 2). */
async function indexChildren(
  image: string,
  digests: readonly string[],
): Promise<Map<string, string[]>> {
  const tokenResponse = await fetch(`https://ghcr.io/token?scope=repository:${image}:pull`);
  if (!tokenResponse.ok) throw new Error(`ghcr.io token for ${image}: ${tokenResponse.status}`);
  const { token } = (await tokenResponse.json()) as { token: string };
  const children = new Map<string, string[]>();
  for (const digest of digests) {
    const response = await fetch(`https://ghcr.io/v2/${image}/manifests/${digest}`, {
      headers: { Accept: INDEX_TYPES, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`manifest ${image}@${digest}: ${response.status}`);
    const manifest = (await response.json()) as { manifests?: { digest: string }[] };
    children.set(
      digest,
      (manifest.manifests ?? []).map((m) => m.digest),
    );
  }
  return children;
}

export async function run(
  root: string,
  owner: string,
  token: string,
  apply: boolean,
): Promise<void> {
  for (const app of appsWithImage(root)) {
    const pkg = `bf-${app}`;
    const image = `${owner.toLowerCase()}/${pkg}`;
    const versions = await listVersions(token, owner, pkg);
    const current = readTag(imageFile(root, app));
    const tagged = versions.filter((v) => v.tags.length > 0).map((v) => v.digest);
    const children = await indexChildren(image, tagged);
    const result = plan({
      versions,
      current,
      history: tagHistory(root, app),
      now: new Date(),
      children: (digest) => children.get(digest) ?? [],
    });
    console.log(
      `${pkg}: ${versions.length} versions, keep ${result.keep.length}, delete ${result.remove.length}`,
    );
    for (const v of result.remove) {
      console.log(
        `  ${apply ? 'delete' : 'would delete'} ${v.digest} ${v.createdAt} ${v.tags.join(',') || '(untagged)'}`,
      );
      if (apply) {
        await github(token, `/users/${owner}/packages/container/${pkg}/versions/${v.id}`, {
          method: 'DELETE',
        });
      }
    }
  }
}

if (import.meta.main) {
  const token = process.env['GITHUB_TOKEN'];
  const owner = process.env['GHCR_OWNER'];
  if (!token || !owner) {
    console.error('ghcr-retention: GITHUB_TOKEN and GHCR_OWNER are required');
    process.exit(1);
  }
  try {
    await run(resolve(import.meta.dirname, '..'), owner, token, process.argv.includes('--apply'));
  } catch (error) {
    console.error(`ghcr-retention: ${(error as Error).message}`);
    process.exit(1);
  }
}
