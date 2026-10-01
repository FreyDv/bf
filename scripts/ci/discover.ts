// Decides what a workflow run has to do, from scripts/apps.mjs (no app list anywhere else).
//   node scripts/ci/discover.ts ci        → outputs changed / migrations / e2e / docker   (JSON arrays for job matrices)
//   node scripts/ci/discover.ts deploy    → outputs images (JSON matrix), migrate (comma list or "none"), release (true|false)
// Env: BASE   git ref to compare with (PR base or previous main commit)
//      SELECT deploy only: "changed" (default), "all", or a comma list of app names
import { affectedAppNames } from '../apps.mjs';

import { allApps, changedFiles, main, setOutput, summary } from './_gh.ts';

import type { App } from './_gh.ts';

/** A change here must reach the machine even when no image changed (see infra/aws/scripts/host-deploy.ts). */
const HOST_BUNDLE_PATHS = ['infra/aws/host', 'infra/aws/lib/host-commands.ts'];

function select(selection: string, base: string | undefined): App[] {
  const all = allApps();
  if (selection === 'all') return all;
  if (selection === 'changed') {
    const changed = new Set(affectedAppNames(base, all) as string[]);
    return all.filter((a) => changed.has(a.name));
  }
  const wanted = selection.split(',').map((s) => s.trim());
  return all.filter((a) => wanted.includes(a.name));
}

const list = (apps: App[], note?: (a: App) => string) =>
  apps.map((a) => `- ${a.name}${note?.(a) ?? ''}`).join('\n') || '- (none)';

main(() => {
  const mode = process.argv[2];
  const base = process.env.BASE;

  if (mode === 'ci') {
    const changed = select('changed', base);
    setOutput('changed', changed);
    setOutput(
      'migrations',
      changed.filter((a) => a.migrations),
    );
    setOutput(
      'e2e',
      changed.filter((a) => a.e2e),
    );
    setOutput(
      'docker',
      changed.filter((a) => a.dockerfile),
    );
    summary(`## Affected apps\n${list(changed)}`);
    return;
  }

  if (mode === 'deploy') {
    const selection = process.env.SELECT || 'changed';
    const images = select(selection, base).filter((a) => a.dockerfile);
    const migrate = images.filter((a) => a.migrations).map((a) => a.name);
    // unknown base (manual run, first push) → assume the bundle changed
    const bundleChanged =
      selection !== 'changed' || (changedFiles(base, HOST_BUNDLE_PATHS)?.length ?? 1) > 0;
    setOutput('images', images);
    setOutput('migrate', migrate.join(',') || 'none');
    setOutput('release', String(images.length > 0 || bundleChanged));
    summary(
      [
        '## Deploying',
        list(images, (a) => (a.migrations ? ' (with migrations)' : '')),
        bundleChanged ? '\nHost bundle (compose.yml / Caddyfile) is re-applied.' : '',
      ].join('\n'),
    );
    return;
  }

  throw new Error('usage: discover.ts ci|deploy');
});
