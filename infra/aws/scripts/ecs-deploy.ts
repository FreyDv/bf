// Release: point every service (or the given ones) at the image <tag> and wait for the rollout.
//   register task-definition revision N+1 (= current revision with the new image) → UpdateService → wait until stable
//   → SSM /bf/<env>/images/<app> = <tag>  (so a later `cdk deploy` keeps the image)
// Awake services roll (new task healthy → old one drains; the circuit breaker rolls back on failure).
// Sleeping services (desiredCount 0) just get the new revision and start it on their next wake.
// Rollback = the same command with the previous sha.
// Usage: node infra/aws/scripts/ecs-deploy.ts --tag <sha> [app ...]
import { DescribeServicesCommand, UpdateServiceCommand } from '@aws-sdk/client-ecs';

import {
  cluster,
  describeService,
  ecs,
  ensureRevision,
  recordImageTag,
  waitStable,
} from './_ecs.ts';
import { apps, flag, isEntry, main, positionals, summary } from './_lib.ts';
import { names } from '../lib/config.ts';

export async function deploy(only: string[], tag: string) {
  const targets = apps(only).filter((a) => a.deploy === 'ecs');
  if (!targets.length) throw new Error('no ECS app selected');

  const expected = new Map<string, string>();
  const awake: string[] = [];
  for (const app of targets) {
    const revision = await ensureRevision(app.name, tag);
    const service = await describeService(app.name);
    if (service.taskDefinition === revision) {
      console.log(`${app.name}: already on ${tag}`);
    } else {
      await ecs.send(
        new UpdateServiceCommand({
          cluster,
          service: names.service(app.name),
          taskDefinition: revision,
        }),
      );
      console.log(
        `${app.name}: ${service.desiredCount ? 'rolling out' : 'asleep — revision recorded, starts on wake'}`,
      );
    }
    expected.set(app.name, revision);
    if (service.desiredCount) awake.push(app.name);
  }

  if (awake.length) await waitStable(awake);

  const rolledBack: string[] = [];
  for (const app of awake) {
    const { services = [] } = await ecs.send(
      new DescribeServicesCommand({ cluster, services: [names.service(app)] }),
    );
    if (services[0]?.taskDefinition !== expected.get(app)) rolledBack.push(app);
  }
  for (const app of targets)
    if (!rolledBack.includes(app.name)) await recordImageTag(app.name, tag);

  summary(
    [
      `### ECS deploy \`${tag}\``,
      ...targets.map(
        (a) =>
          `- ${rolledBack.includes(a.name) ? '❌' : '✅'} \`${a.name}\`${awake.includes(a.name) ? '' : ' (asleep, applies on wake)'}`,
      ),
    ].join('\n'),
  );
  if (rolledBack.length)
    throw new Error(
      `the circuit breaker rolled back ${rolledBack.join(', ')} (new tasks never became healthy) — see CloudWatch ${names.logGroup('<app>')}`,
    );
}

if (isEntry(import.meta.url)) {
  main(async () => {
    const tag = flag('tag');
    if (!tag) throw new Error('usage: ecs-deploy.ts --tag <sha> [app ...]');
    await deploy(positionals(), tag);
  });
}
