// PR preview, part 1: which apps a merge would build and deploy, and which migration files it would apply.
// Needs no AWS access. Usage: BASE=<base sha> node scripts/ci/release-plan.ts <out.md>
import { writeFileSync } from 'node:fs';

import { config } from '../../infra/aws/lib/config.ts';
import { affectedAppNames } from '../apps.mjs';

import { allApps, git, main, summary } from './_gh.ts';

const STATUS: Record<string, string> = { A: '🆕 added', M: '✏️ modified', D: '🗑️ removed' };

main(() => {
  const out = process.argv[2];
  const base = process.env.BASE;
  if (!out || !base) throw new Error('usage: BASE=<sha> release-plan.ts <out.md>');

  const all = allApps();
  const changed = new Set(affectedAppNames(base, all) as string[]);
  const images = all.filter((a) => changed.has(a.name) && a.dockerfile);
  const migrations = git('diff', '--name-status', base, 'HEAD', '--', 'apps/*/drizzle/*.sql')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .map(([status = '', file = '']) => `- ${STATUS[status[0] ?? ''] ?? status} \`${file}\``);

  const lines = [
    `### Release plan · merging to \`main\` deploys to **${config.env}** (\`${config.region}\`)`,
    '',
  ];
  if (!images.length) {
    lines.push('No deployable app is affected — **no images are built**.');
  } else {
    lines.push(
      'Order: 📸 DB snapshot → 🐳 build & push → 🗄️ migrate → 🚀 compose up on the host (rolls back if a container stays unhealthy) → 💨 smoke test',
      '',
      '| App | Migrations |',
      '|---|---|',
      ...images.map(
        (a) => `| \`${a.name}\` | ${a.migrations ? 'runs `drizzle-kit migrate`' : '–'} |`,
      ),
    );
  }
  if (migrations.length) {
    lines.push(
      '',
      '**Migration files in this PR** (applied to the production DB right after the snapshot):',
      '',
      ...migrations,
    );
  }

  const markdown = lines.join('\n');
  writeFileSync(out, `${markdown}\n`);
  summary(markdown);
});
