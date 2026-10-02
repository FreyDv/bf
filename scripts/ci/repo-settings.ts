// One-time GitHub repository settings that the pipeline relies on (they live in GitHub, not in the repo):
//   - branch protection on main: the single status check `ci ok` must pass before a PR can merge
//     (no force-push, no deletion; admins can still push directly, review is not required — this is a solo repo)
//   - environment `prod-approval`: the deploy stages wait for ONE approval per run (the AWS roles trust `prod`,
//     so approval lives on this separate environment that only the `approve` job uses)
//   - label `allow-destructive`: lets a PR that removes/replaces a stateful resource pass the infra diff check
// Usage: node scripts/ci/repo-settings.ts            (print what would change)
//        node scripts/ci/repo-settings.ts --apply    (needs `gh` logged in with admin rights on the repository)
import { execFileSync } from 'node:child_process';

import { main } from './_gh.ts';

const apply = process.argv.includes('--apply');

function gh(args: string[], body?: object): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input: body ? JSON.stringify(body) : undefined,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}
const api = (method: string, path: string, body?: object) =>
  gh(['api', '--method', method, path, ...(body ? ['--input', '-'] : [])], body);

main(() => {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
  const me = JSON.parse(gh(['api', 'user'])) as { id: number; login: string };

  const protection = {
    required_status_checks: { strict: false, contexts: ['ci ok'] },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const approval = {
    reviewers: [{ type: 'User', id: me.id }],
    prevent_self_review: false,
    deployment_branch_policy: null,
  };

  console.log(`repository ${repo}`);
  console.log(`- main: require status check "ci ok", no force-push, no deletion`);
  console.log(`- environment prod-approval: required reviewer ${me.login}`);
  console.log('- label allow-destructive');
  if (!apply) return console.log('\n(dry run — pass --apply)');

  api('PUT', `repos/${repo}/branches/main/protection`, protection);
  api('PUT', `repos/${repo}/environments/prod-approval`, approval);
  try {
    api('POST', `repos/${repo}/labels`, {
      name: 'allow-destructive',
      color: 'b60205',
      description: 'Allow this PR to remove or replace a stateful AWS resource',
    });
  } catch {
    console.log('label allow-destructive already exists');
  }
  console.log('\napplied');
});
