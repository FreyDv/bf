// PREVIEW: what would `pnpm aws:deploy` change in AWS? Runs `cdk diff` against the deployed stack (read-only, nothing
// is applied) and renders it as Markdown for the PR comment.
// Usage: node infra/aws/scripts/plan.ts [out.md]        (needs the read-only role bf-gha-plan, or your own credentials)
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { awsDir, main, positionals } from './_lib.ts';
import { config, names } from '../lib/config.ts';

// replacing or removing one of these loses state
const STATEFUL = [
  'AWS::RDS::DBCluster',
  'AWS::RDS::DBInstance',
  'AWS::S3::Bucket',
  'AWS::EC2::Instance',
];

main(async () => {
  const out = positionals()[0];
  const result = spawnSync(
    'pnpm',
    ['exec', 'cdk', 'diff', names.stack, '--no-change-set', '--no-color'],
    { cwd: awsDir, encoding: 'utf8' },
  );
  const output = `${result.stdout}${result.stderr}`.trim();
  // on success keep only the diff itself (it starts at "Stack <name>"), not the synth warnings printed before it
  const start = output.indexOf(`Stack ${names.stack}`);
  const diff = result.status === 0 && start !== -1 ? output.slice(start) : output;
  const failed = result.status !== 0;
  const noChanges = /There were no differences/.test(diff);
  const risky = diff
    .split('\n')
    .filter((line) => /^\[[-~]\]/.test(line) && STATEFUL.some((type) => line.includes(type)))
    .filter((line) => line.startsWith('[-]') || /replace/i.test(line));

  const lines = [`### AWS infra preview · \`${names.stack}\` · ${config.region}`, ''];
  if (failed) lines.push('❌ **`cdk diff` failed:**', '', '```', diff, '```');
  else if (noChanges)
    lines.push('✅ **No infrastructure changes.** Merging this PR will not touch CloudFormation.');
  else {
    lines.push('```diff', diff, '```', '');
    if (risky.length) {
      lines.push(
        '> ⚠️ **Removes or replaces a stateful resource** (database, bucket or the machine). A DB snapshot is taken before every release, but review this carefully:',
        ...risky.map((line) => `> - \`${line.trim()}\``),
        '',
      );
    }
    lines.push(
      '<sub>Computed with `cdk diff` against the deployed template; nothing was applied. `[+]` add · `[~]` modify · `[-]` remove</sub>',
    );
  }

  // GitHub rejects comments over 65 536 characters (a first deploy lists every resource)
  const full = lines.join('\n');
  const markdown =
    full.length > 60_000
      ? `${full.slice(0, 60_000)}\n\`\`\`\n\n…truncated, see the workflow log.`
      : full;
  if (out) writeFileSync(out, `${markdown}\n`);
  console.log(markdown);
  if (failed) throw new Error('cdk diff failed');
});
