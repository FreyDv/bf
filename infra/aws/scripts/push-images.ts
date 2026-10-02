// Local equivalent of the pipeline.yml `images` job: builds every app (or the given ones) for linux/arm64 and pushes
// it to ECR with the tags <tag> and <env> (the floating tag compose.yml points at). Creates missing repositories.
// Usage: node infra/aws/scripts/push-images.ts <tag> [app ...]        (needs docker buildx + AWS credentials)
//        node infra/aws/scripts/push-images.ts --ensure-repo <app>    (only create the repository; used by pipeline.yml)
import {
  CreateRepositoryCommand,
  DescribeRepositoriesCommand,
  ECRClient,
  GetAuthorizationTokenCommand,
  PutLifecyclePolicyCommand,
  RepositoryNotFoundException,
} from '@aws-sdk/client-ecr';

import { accountId, apps, flag, main, positionals, run, sdk } from './_lib.ts';
import { config, names } from '../lib/config.ts';
import { imageBuildArgs } from '../lib/images.ts';

const ecr = new ECRClient(sdk);

const EXPIRE_UNTAGGED = {
  rules: [
    {
      rulePriority: 1,
      description: 'expire untagged',
      selection: {
        tagStatus: 'untagged',
        countType: 'sinceImagePushed',
        countUnit: 'days',
        countNumber: 7,
      },
      action: { type: 'expire' },
    },
  ],
};

/** Creates the ECR repository bf-<env>/<app> if it does not exist yet (a new app needs no infra change). */
async function ensureRepository(app: string) {
  const repositoryName = names.ecrRepository(app);
  try {
    await ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [repositoryName] }));
    console.log(`ecr: ${repositoryName} exists`);
    return;
  } catch (error) {
    if (!(error instanceof RepositoryNotFoundException)) throw error;
  }
  console.log(`ecr: creating ${repositoryName}`);
  await ecr.send(
    new CreateRepositoryCommand({
      repositoryName,
      imageScanningConfiguration: { scanOnPush: true },
      imageTagMutability: 'MUTABLE',
    }),
  );
  await ecr.send(
    new PutLifecyclePolicyCommand({
      repositoryName,
      lifecyclePolicyText: JSON.stringify(EXPIRE_UNTAGGED),
    }),
  );
}

async function dockerLogin(registry: string) {
  const { authorizationData } = await ecr.send(new GetAuthorizationTokenCommand({}));
  const token = authorizationData?.[0]?.authorizationToken;
  if (!token) throw new Error('ECR returned no authorization token');
  const password = Buffer.from(token, 'base64').toString().replace(/^AWS:/, '');
  run('docker', ['login', '--username', 'AWS', '--password-stdin', registry], { input: password });
}

main(async () => {
  const ensureOnly = flag('ensure-repo');
  if (ensureOnly) return ensureRepository(ensureOnly);

  const [tag, ...only] = positionals();
  if (!tag) throw new Error('usage: push-images.ts <tag> [app ...]');
  const registry = names.ecrRegistry(await accountId());
  await dockerLogin(registry);

  for (const app of apps(only)) {
    if (!app.dockerfile) {
      console.log(`skip ${app.name} (no dockerfile)`);
      continue;
    }
    await ensureRepository(app.name);
    const image = `${registry}/${names.ecrRepository(app.name)}`;
    const buildArgs = Object.entries(imageBuildArgs(app)).flatMap(([k, v]) => [
      '--build-arg',
      `${k}=${v}`,
    ]);
    run('docker', [
      'buildx',
      'build',
      '--platform',
      'linux/arm64',
      '-f',
      app.dockerfile,
      ...buildArgs,
      '-t',
      `${image}:${tag}`,
      '-t',
      `${image}:${config.env}`,
      '--push',
      '.',
    ]);
  }
});
