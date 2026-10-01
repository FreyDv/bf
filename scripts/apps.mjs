#!/usr/bin/env node
// Single source of truth for "which apps exist and what each one supports".
// Nothing else in the repo (CI, Dockerfiles, deploy scripts) may hardcode an app list — they call this.
//
//   node scripts/apps.mjs                       → JSON array of every app
//   node scripts/apps.mjs --changed <base-ref>  → only apps affected since <base-ref> (turbo graph + global paths)
//   node scripts/apps.mjs --only migrations,e2e → only apps where every listed flag is true
//   node scripts/apps.mjs --kind nest           → only apps of that kind (nest | next)
//   node scripts/apps.mjs --names               → space-separated names instead of JSON
//
// Detection is file-based, so a new app is picked up the moment its folder lands in apps/:
//   kind        nest-cli.json → nest, next.config.* → next
//   dockerfile  docker/<kind>.Dockerfile
//   migrations  drizzle.config.ts present
//   e2e / unit / seed   package.json scripts test:e2e / test / db:seed
//   envSchema   src/app/env.schema.ts present (→ pnpm env:check)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = 'apps';
/** A change under one of these prefixes affects every app (images, pipeline, tooling). */
const GLOBAL_PATHS = ['docker/', '.github/', 'scripts/', '.dockerignore'];

export function discoverApps() {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(APPS_DIR, d.name, 'package.json')))
    .map((d) => {
      const path = join(APPS_DIR, d.name);
      const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
      const scripts = pkg.scripts ?? {};
      const kind = existsSync(join(path, 'nest-cli.json'))
        ? 'nest'
        : readdirSync(path).some((f) => /^next\.config\.(ts|mjs|js)$/.test(f))
          ? 'next'
          : 'other';
      return {
        name: pkg.name,
        path,
        kind,
        dockerfile: kind === 'other' ? null : `docker/${kind}.Dockerfile`,
        migrations: existsSync(join(path, 'drizzle.config.ts')),
        e2e: Boolean(scripts['test:e2e']),
        unit: Boolean(scripts.test),
        seed: Boolean(scripts['db:seed']),
        envSchema: existsSync(join(path, 'src', 'app', 'env.schema.ts')),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function refExists(ref) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Names of apps affected between base and HEAD. Uses turbo's package graph (a change in
 * packages/shared marks every dependent app) plus GLOBAL_PATHS. Unknown base → every app.
 */
export function affectedAppNames(base, apps = discoverApps()) {
  const all = apps.map((a) => a.name);
  if (!base || /^0+$/.test(base) || !refExists(base)) {
    console.error(`[apps] base "${base}" not resolvable → treating every app as changed`);
    return all;
  }
  const files = git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .filter(Boolean);
  const globalHit = files.find((f) => GLOBAL_PATHS.some((p) => f.startsWith(p)));
  if (globalHit) {
    console.error(`[apps] global path changed (${globalHit}) → every app is changed`);
    return all;
  }
  const out = execFileSync('pnpm', ['turbo', 'ls', '--affected', '--output=json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TURBO_SCM_BASE: base,
      TURBO_SCM_HEAD: 'HEAD',
      TURBO_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const affected = new Set(JSON.parse(out).packages.items.map((i) => i.name));
  return all.filter((n) => affected.has(n));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  let apps = discoverApps();
  const only = opt('--only');
  if (only) apps = apps.filter((a) => only.split(',').every((k) => a[k.trim()]));
  const kind = opt('--kind');
  if (kind) apps = apps.filter((a) => a.kind === kind);
  if (argv.includes('--changed')) {
    const changed = new Set(affectedAppNames(opt('--changed'), discoverApps()));
    apps = apps.filter((a) => changed.has(a.name));
  }
  process.stdout.write(
    argv.includes('--names')
      ? apps.map((a) => a.name).join(' ') + '\n'
      : JSON.stringify(apps) + '\n',
  );
}
