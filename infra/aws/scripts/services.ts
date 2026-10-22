// Who is awake, since when, and the runtime knobs of the orchestrator — the same calls apps/api makes, from a laptop
// (AWS credentials instead of an admin JWT). State lives on the ECS service itself: desiredCount + tags.
// Usage: node infra/aws/scripts/services.ts                      list every service
//        node infra/aws/scripts/services.ts wake <app>           start it now (min 1)
//        node infra/aws/scripts/services.ts sleep <app>          stop it now (0 tasks; wakes again on the next request)
//        node infra/aws/scripts/services.ts cooldown <app> <s>   idle seconds before it sleeps (tag bf:cooldown; 0 = default)
//        node infra/aws/scripts/services.ts bounds <app> <min> <max>   scaling bounds while awake
//        node infra/aws/scripts/services.ts redeploy <app>       restart its tasks with the current revision
import {
  ApplicationAutoScalingClient,
  DescribeScalableTargetsCommand,
  RegisterScalableTargetCommand,
} from '@aws-sdk/client-application-auto-scaling';
import {
  DescribeServicesCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateServiceCommand,
} from '@aws-sdk/client-ecs';

import { cluster, ecs, forceNewDeployment } from './_ecs.ts';
import { apps, main, positionals, sdk } from './_lib.ts';
import { services } from '../lib/apps.ts';
import { config, names } from '../lib/config.ts';

const autoscaling = new ApplicationAutoScalingClient(sdk);
const resourceId = (app: string) => `service/${cluster}/${names.service(app)}`;

async function setBounds(app: string, min: number, max: number) {
  await autoscaling.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: 'ecs',
      ResourceId: resourceId(app),
      ScalableDimension: 'ecs:service:DesiredCount',
      MinCapacity: min,
      MaxCapacity: max,
    }),
  );
}

async function setDesired(app: string, desiredCount: number) {
  await ecs.send(new UpdateServiceCommand({ cluster, service: names.service(app), desiredCount }));
}

async function list() {
  const specs = services();
  const names_ = specs.map((s) => names.service(s.name));
  const { services: ecsServices = [] } = await ecs.send(
    new DescribeServicesCommand({ cluster, services: names_, include: ['TAGS'] }),
  );
  const { ScalableTargets = [] } = await autoscaling.send(
    new DescribeScalableTargetsCommand({
      ServiceNamespace: 'ecs',
      ResourceIds: specs.map((s) => resourceId(s.name)),
      ScalableDimension: 'ecs:service:DesiredCount',
    }),
  );
  const now = Date.now() / 1000;
  const rows = specs.map((spec) => {
    const s = ecsServices.find((x) => x.serviceName === names.service(spec.name));
    const target = ScalableTargets.find((t) => t.ResourceId === resourceId(spec.name));
    const tags: Record<string, string | undefined> = Object.fromEntries(
      (s?.tags ?? []).map((t) => [t.key ?? '', t.value]),
    );
    const last = Number(tags[names.serviceTags.lastActivity]);
    const cooldown = Number(tags[names.serviceTags.cooldown]) || spec.cooldownS;
    const state = !s
      ? 'missing'
      : s.desiredCount === 0
        ? 'asleep'
        : (s.runningCount ?? 0) > 0
          ? 'awake'
          : 'starting';
    return {
      service: spec.name,
      state,
      desired: s?.desiredCount ?? '-',
      running: s?.runningCount ?? '-',
      bounds: target ? `${target.MinCapacity}-${target.MaxCapacity}` : '-',
      'last activity': last ? `${Math.round((now - last) / 60)} min ago` : '-',
      cooldown: `${Math.round(cooldown / 60)} min${spec.alwaysOn ? ' (always on)' : ''}`,
      revision: s?.taskDefinition?.split('/').pop() ?? '-',
    };
  });
  console.table(rows);
}

main(async () => {
  const [command, app, ...rest] = positionals();
  if (!command || command === 'list') return list();
  if (!app) throw new Error(`usage: services.ts ${command} <app> …`);
  const spec = services(apps([app]))[0];
  if (!spec) throw new Error(`${app} is not an ECS service`);
  const arn = (
    await ecs.send(new DescribeServicesCommand({ cluster, services: [names.service(app)] }))
  ).services?.[0]?.serviceArn;
  if (!arn) throw new Error(`service ${names.service(app)} not found`);

  switch (command) {
    case 'wake':
      await setBounds(app, Math.max(1, spec.alwaysOn ? spec.minTasks : 1), spec.maxTasks);
      await setDesired(app, 1);
      await ecs.send(
        new TagResourceCommand({
          resourceArn: arn,
          tags: [
            { key: names.serviceTags.lastActivity, value: String(Math.floor(Date.now() / 1000)) },
          ],
        }),
      );
      return console.log(`${app}: waking`);
    case 'sleep':
      if (spec.alwaysOn) throw new Error(`${app} is always on (lib/apps.ts / config.ecs.alwaysOn)`);
      await setBounds(app, 0, 0);
      await setDesired(app, 0);
      return console.log(`${app}: sleeping`);
    case 'cooldown': {
      const seconds = Number(rest[0]);
      if (!Number.isInteger(seconds) || seconds < 0) throw new Error('cooldown <app> <seconds>');
      if (seconds === 0) {
        await ecs.send(
          new UntagResourceCommand({ resourceArn: arn, tagKeys: [names.serviceTags.cooldown] }),
        );
        return console.log(`${app}: cooldown back to the default (${config.ecs.cooldownS} s)`);
      }
      await ecs.send(
        new TagResourceCommand({
          resourceArn: arn,
          tags: [{ key: names.serviceTags.cooldown, value: String(seconds) }],
        }),
      );
      return console.log(`${app}: cooldown ${seconds} s`);
    }
    case 'bounds': {
      const [min, max] = rest.map(Number);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min! < 0 || max! < min!)
        throw new Error('bounds <app> <min> <max>');
      await setBounds(app, min!, max!);
      return console.log(`${app}: bounds ${min}-${max}`);
    }
    case 'redeploy':
      return forceNewDeployment([app]);
    default:
      throw new Error(`unknown command ${command} (list|wake|sleep|cooldown|bounds|redeploy)`);
  }
});
