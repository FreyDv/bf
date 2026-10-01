// ONE-TIME, from your laptop, with admin credentials for the target account. Re-run any time to update the roles.
//   1. cdk bootstrap            the CDK's own bucket and deploy roles (stack CDKToolkit)
//   2. deploy bf-github         OIDC trust, the four GitHub roles, the bf-cfn-exec policy, artifact/snapshot buckets
//   3. cdk bootstrap (again)    restrict what CloudFormation may do to the bf-cfn-exec policy (default: admin)
// Usage: node infra/aws/scripts/bootstrap.ts [owner/repo]        (default repo: lib/config.ts → githubRepo)
import { accountId, awsDir, main, positionals, run } from './_lib.ts';
import { config, names } from '../lib/config.ts';

main(async () => {
  const repo = positionals()[0] ?? config.githubRepo;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`"${repo}" is not owner/name`);
  const account = await accountId();
  const target = `aws://${account}/${config.region}`;
  const cdk = (...args: string[]) => run('pnpm', ['exec', 'cdk', ...args], { cwd: awsDir });

  cdk('bootstrap', target);
  cdk('deploy', names.githubStack, '--require-approval', 'never', '-c', `githubRepo=${repo}`);
  cdk(
    'bootstrap',
    target,
    '--cloudformation-execution-policies',
    `arn:aws:iam::${account}:policy/${names.cfnExecPolicy}`,
  );

  console.log(`
Done. Roles trust the repository ${repo}.
Next:
  GitHub → Settings → Secrets and variables → Actions → Variables: AWS_ACCOUNT_ID=${account}
  GitHub → Settings → Environments → "${config.env}" (create it, add required reviewers)
  pnpm aws:diff && pnpm aws:deploy`);
});
