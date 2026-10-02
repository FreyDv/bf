// PREVIEW: what would `pnpm aws:deploy` change in AWS? Runs `cdk diff` against the deployed stack (read-only, nothing
// is applied) and renders it as Markdown for the PR comment.
// A diff that removes or replaces a stateful resource fails the job unless the PR carries the label `allow-destructive`
// (read through the GitHub API when PR_NUMBER and GH_TOKEN are set; after labeling, re-run just this job).
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

const ALLOW_LABEL = 'allow-destructive';

async function destructiveAllowed(): Promise<boolean> {
  const { PR_NUMBER, GH_TOKEN, GITHUB_REPOSITORY } = process.env;
  if (!PR_NUMBER || !GH_TOKEN || !GITHUB_REPOSITORY) return false;
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/labels?per_page=100`,
    { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json' } },
  );
  if (!response.ok) return false;
  const labels = (await response.json()) as { name: string }[];
  return labels.some((label) => label.name === ALLOW_LABEL);
}

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

  const blocked = risky.length > 0 && !(await destructiveAllowed());

  const lines = [`### AWS infra preview · \`${names.stack}\` · ${config.region}`, ''];
  if (failed) lines.push('❌ **`cdk diff` failed:**', '', '```', diff, '```');
  else if (noChanges)
    lines.push('✅ **No infrastructure changes.** Merging this PR will not touch CloudFormation.');
  else {
    lines.push('```diff', diff, '```', '');
    if (risky.length) {
      lines.push(
        `> ⚠️ **Removes or replaces a stateful resource** (database, bucket or the machine). A DB snapshot is taken before every release, but review this carefully:`,
        ...risky.map((line) => `> - \`${line.trim()}\``),
        blocked
          ? `> \n> 🛑 **This check fails** until the PR has the label \`${ALLOW_LABEL}\` (then re-run the \`infra diff\` job).`
          : `> \n> ✅ Allowed by the \`${ALLOW_LABEL}\` label.`,
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
  if (blocked)
    throw new Error(
      `stateful resource removed or replaced — label the PR "${ALLOW_LABEL}" to allow it`,
    );
});
