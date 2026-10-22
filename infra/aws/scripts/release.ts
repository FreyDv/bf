// A release from a laptop (the pipeline's `release` job does the same): migrate, then deploy.
// Usage: node infra/aws/scripts/release.ts --tag <sha> [app ...]        (images must already be in ECR: push-images.ts)
import { flag, has, main, positionals } from './_lib.ts';
import { deploy } from './ecs-deploy.ts';
import { migrate } from './ecs-migrate.ts';

main(async () => {
  const tag = flag('tag');
  if (!tag) throw new Error('usage: release.ts --tag <sha> [--skip-migrations] [app ...]');
  const only = positionals(['skip-migrations']);
  if (!has('skip-migrations')) await migrate(only, tag);
  await deploy(only, tag);
});
