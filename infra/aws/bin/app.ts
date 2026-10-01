// CDK entry point (cdk.json → `node bin/app.ts`). Two stacks:
//   bf-github  roles + buckets GitHub Actions needs; deployed once from a laptop (scripts/bootstrap.ts)
//   bf-prod    the platform: network, secrets, Aurora, the machine, DNS  (pnpm aws:diff / pnpm aws:deploy)
import { App } from 'aws-cdk-lib';

import { config, names } from '../lib/config.ts';
import { GithubStack } from '../lib/github-stack.ts';
import { ProdStack } from '../lib/prod-stack.ts';

const app = new App();
// account comes from the credentials in use (unset → account-agnostic template, enough for `cdk synth`)
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

new GithubStack(app, names.githubStack, {
  env,
  description:
    'bf: GitHub Actions OIDC roles, CloudFormation permissions, artifact and snapshot buckets',
  githubRepo: (app.node.tryGetContext('githubRepo') as string | undefined) ?? config.githubRepo,
});

new ProdStack(app, names.stack, {
  env,
  description:
    'bf: one EC2 host running docker compose behind Caddy + Aurora Serverless v2 (scale to zero)',
});
