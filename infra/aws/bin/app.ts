// CDK entry point (cdk.json → `node bin/app.ts`). Three stacks:
//   bf-github     roles + buckets GitHub Actions needs; deployed once from a laptop (scripts/bootstrap.ts)
//   bf-prod       the platform: network, secrets, Aurora, cluster, ALB, CloudFront, static buckets, DNS
//   bf-prod-apps  one Fargate service per Nest app (scripts/apps.mjs)        pnpm aws:diff / pnpm aws:deploy
import { App } from 'aws-cdk-lib';

import { AppsStack } from '../lib/apps-stack.ts';
import { services } from '../lib/apps.ts';
import { config, names } from '../lib/config.ts';
import { GithubStack } from '../lib/github-stack.ts';
import { imageTags } from '../lib/images.ts';
import { ProdStack } from '../lib/prod-stack.ts';

const app = new App();
// account comes from the credentials in use (unset → account-agnostic template, enough for `cdk synth`)
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

new GithubStack(app, names.githubStack, {
  env,
  description: 'bf: GitHub Actions OIDC roles, CloudFormation permissions, DB snapshot bucket',
  githubRepo: (app.node.tryGetContext('githubRepo') as string | undefined) ?? config.githubRepo,
});

const platform = new ProdStack(app, names.stack, {
  env,
  description:
    'bf: VPC, Aurora Serverless v2 (scale to zero), ECS cluster, ALB, CloudFront + S3 frontends, DNS',
});

const specs = services();
new AppsStack(app, names.appsStack, {
  env,
  description: 'bf: one Fargate service per Nest app (scale to zero, Service Connect)',
  platform,
  specs,
  imageTags: await imageTags(specs.map((s) => s.name)),
});
