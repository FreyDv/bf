// A shell inside a running task (ECS Exec through SSM; no SSH, no open port). Replaces `aws ssm start-session`.
// Needs the AWS CLI and the Session Manager plugin on the laptop (the SSM session protocol is not worth reimplementing).
// Usage: node infra/aws/scripts/exec.ts <app> [command]        (default command: sh)
import { DescribeTaskDefinitionCommand, DescribeTasksCommand } from '@aws-sdk/client-ecs';

import { cluster, ecs, runningTasks } from './_ecs.ts';
import { apps, main, positionals, run } from './_lib.ts';
import { config } from '../lib/config.ts';

main(async () => {
  const [app, ...command] = positionals();
  if (!app) throw new Error('usage: exec.ts <app> [command]');
  if (apps([app])[0]?.deploy !== 'ecs') throw new Error(`${app} is not an ECS service`);
  const [taskArn] = await runningTasks(app);
  if (!taskArn) throw new Error(`${app} has no running task (pnpm aws:services wake ${app})`);
  const { tasks = [] } = await ecs.send(new DescribeTasksCommand({ cluster, tasks: [taskArn] }));
  const { taskDefinition } = await ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: tasks[0]!.taskDefinitionArn! }),
  );
  const container = taskDefinition!.containerDefinitions![0]!.name!;
  run('aws', [
    'ecs',
    'execute-command',
    '--region',
    config.region,
    '--cluster',
    cluster,
    '--task',
    taskArn,
    '--container',
    container,
    '--interactive',
    '--command',
    command.join(' ') || 'sh',
  ]);
});
