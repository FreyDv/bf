// Image pins by digest (IMG-1, ADR-076, ADR-027 item 1, ADR-036): the node base of every app Dockerfile and the
// hadolint and Trivy images of scripts/image-check.ts are written `<repo>:<tag>@sha256:<digest>`.
//
//   node scripts/image-pins.ts check            no network: the node tag equals .nvmrc, one digest for all of them
//   node scripts/image-pins.ts bump [--dry-run] for each pin, the digest the registry serves for the same tag now;
//                                               it is written only once the image is at least 7 days old (ADR-005).
//                                               --dry-run exits 1 when a bump is due, 0 when none is.
//
// A tag changes by hand (a new .nvmrc, a new hadolint or Trivy release); `bump` then fills its digest. Docker Hub is
// read anonymously.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const COOLDOWN_DAYS = 7;
const DAY_MS = 86_400_000;
const PIN = /([a-z0-9][a-z0-9._/-]*):([A-Za-z0-9][A-Za-z0-9._-]*)@(sha256:[0-9a-f]{64})/g;

export interface Pin {
  readonly file: string;
  readonly repo: string;
  readonly tag: string;
  readonly digest: string;
}

/** The files that hold pins, relative to the root. */
export function pinFiles(root: string): string[] {
  const apps = readdirSync(join(root, 'apps'))
    .filter((app) => existsSync(join(root, 'apps', app, 'Dockerfile')))
    .map((app) => `apps/${app}/Dockerfile`);
  return [...apps, 'scripts/image-check.ts'];
}

export function readPins(root: string): Pin[] {
  const pins: Pin[] = [];
  for (const file of pinFiles(root)) {
    for (const match of readFileSync(join(root, file), 'utf8').matchAll(PIN)) {
      pins.push({ file, repo: match[1] ?? '', tag: match[2] ?? '', digest: match[3] ?? '' });
    }
  }
  return pins;
}

/** What `check` finds wrong; empty when the pins agree with each other and with .nvmrc. */
export function problems(pins: readonly Pin[], nvmrc: string): string[] {
  const found: string[] = [];
  const nodes = pins.filter((pin) => pin.repo === 'node');
  const dockerfiles = new Set(
    pins.filter((pin) => pin.file.endsWith('Dockerfile')).map((pin) => pin.file),
  );
  for (const file of dockerfiles) {
    if (!nodes.some((pin) => pin.file === file))
      found.push(`${file}: no node image pinned by digest`);
  }
  for (const pin of nodes) {
    if (pin.tag !== `${nvmrc}-slim`)
      found.push(`${pin.file}: node:${pin.tag} is not node:${nvmrc}-slim (.nvmrc)`);
  }
  const digests = new Set(nodes.map((pin) => pin.digest));
  if (digests.size > 1) found.push(`the node images differ in digest: ${[...digests].join(', ')}`);
  return found;
}

export interface Published {
  readonly digest: string;
  readonly created: Date;
}

export type Registry = (repo: string, tag: string) => Promise<Published>;

export interface Bump {
  readonly pin: Pin;
  readonly to: Published;
  readonly due: boolean;
}

/** The pins whose tag now points at another digest, and whether the cooldown has passed for each. */
export async function bumps(pins: readonly Pin[], registry: Registry, now: Date): Promise<Bump[]> {
  const seen = new Map<string, Published>();
  const result: Bump[] = [];
  for (const pin of pins) {
    const key = `${pin.repo}:${pin.tag}`;
    const published = seen.get(key) ?? (await registry(pin.repo, pin.tag));
    seen.set(key, published);
    if (published.digest === pin.digest) continue;
    const due = now.getTime() - published.created.getTime() >= COOLDOWN_DAYS * DAY_MS;
    result.push({ pin, to: published, due });
  }
  return result;
}

export function apply(root: string, due: readonly Bump[]): void {
  for (const bump of due) {
    const path = join(root, bump.pin.file);
    const from = `${bump.pin.repo}:${bump.pin.tag}@${bump.pin.digest}`;
    const to = `${bump.pin.repo}:${bump.pin.tag}@${bump.to.digest}`;
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(from, to));
  }
}

const INDEX =
  'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json';
const IMAGE =
  'application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';

/** Docker Hub, anonymously: the digest of the tag (the index for a multi-platform image) and the linux/amd64 build time. */
export const dockerHub: Registry = async (repo, tag) => {
  const name = repo.includes('/') ? repo : `library/${repo}`;
  const auth = await fetch(
    `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${name}:pull`,
  );
  if (!auth.ok) throw new Error(`token for ${name}: ${auth.status}`);
  const { token } = (await auth.json()) as { token: string };
  const get = async (path: string, accept?: string) => {
    const response = await fetch(`https://registry-1.docker.io/v2/${name}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, ...(accept ? { Accept: accept } : {}) },
    });
    if (!response.ok) throw new Error(`${name}/${path}: ${response.status}`);
    return response;
  };
  const top = await get(`manifests/${tag}`, `${INDEX}, ${IMAGE}`);
  const digest = top.headers.get('docker-content-digest');
  if (!digest) throw new Error(`${name}:${tag}: the registry sent no digest`);
  let manifest = (await top.json()) as {
    manifests?: { digest: string; platform?: { os?: string; architecture?: string } }[];
    config?: { digest: string };
  };
  if (manifest.manifests) {
    const amd64 = manifest.manifests.find(
      (m) => m.platform?.os === 'linux' && m.platform.architecture === 'amd64',
    );
    if (!amd64) throw new Error(`${name}:${tag}: no linux/amd64 image`);
    manifest = (await (await get(`manifests/${amd64.digest}`, IMAGE)).json()) as typeof manifest;
  }
  if (!manifest.config) throw new Error(`${name}:${tag}: no image config`);
  const config = (await (await get(`blobs/${manifest.config.digest}`)).json()) as {
    created?: string;
  };
  if (!config.created) throw new Error(`${name}:${tag}: the image config has no creation time`);
  return { digest, created: new Date(config.created) };
};

if (import.meta.main) {
  const root = resolve(import.meta.dirname, '..');
  const [command, ...flags] = process.argv.slice(2);
  const pins = readPins(root);
  const found = problems(pins, readFileSync(join(root, '.nvmrc'), 'utf8').trim());
  if (found.length > 0) {
    console.error(`image-pins: ${found.length} problem(s)\n${found.join('\n')}`);
    process.exit(1);
  }
  if (command === 'check') {
    console.log(`image-pins: OK (${pins.length} pins)`);
  } else if (command === 'bump') {
    const dryRun = flags.includes('--dry-run');
    const all = await bumps(pins, dockerHub, new Date());
    for (const bump of all) {
      const age = ((Date.now() - bump.to.created.getTime()) / DAY_MS).toFixed(1);
      console.log(
        `${bump.pin.file}: ${bump.pin.repo}:${bump.pin.tag} -> ${bump.to.digest} (${age} days old${bump.due ? '' : ', within the cooldown, not yet'})`,
      );
    }
    const due = all.filter((bump) => bump.due);
    if (dryRun) {
      console.log(
        due.length > 0 ? `image-pins: ${due.length} bump(s) due` : 'image-pins: nothing due',
      );
      process.exit(due.length > 0 ? 1 : 0);
    }
    apply(root, due);
    console.log(`image-pins: ${due.length} pin(s) written`);
  } else {
    console.error('usage: node scripts/image-pins.ts check | bump [--dry-run]');
    process.exit(2);
  }
}
