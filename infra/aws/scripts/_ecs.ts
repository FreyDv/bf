// ECS primitives shared by ecs-deploy.ts, ecs-migrate.ts, set-secrets.ts, db-rotate-password.ts and services.ts.
// Nothing here touches CloudFormation: releases register task-definition revisions and update services directly,
// and lib/images.ts makes a later `cdk deploy` synthesize the same image tag (SSM /bf/<env>/images/<app>).
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  UpdateServiceCommand,
  waitUntilServicesStable,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs';
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

import { accountId, platformParams, sdk } from './_lib.ts';
import { names } from '../lib/config.ts';

import type {
  RegisterTaskDefinitionCommandInput,
  Service,
  TaskDefinition,
} from '@aws-sdk/client-ecs';

export const ecs = new ECSClient(sdk);
const logsClient = new CloudWatchLogsClient(sdk);
const ssm = new SSMClient(sdk);

export const cluster = names.cluster;

/** What the one-off migration task runs inside a service image (packages/db/src/cli/migrate.ts). */
export const MIGRATE_COMMAND = ['node', 'node_modules/@bf/db/dist/cli/migrate.js'];

export async function imageUri(app: string, tag: string): Promise<string> {
  return `${names.ecrRegistry(await accountId())}/${names.ecrRepository(app)}:${tag}`;
}

/** Fields DescribeTaskDefinition returns that RegisterTaskDefinition does not accept. */
const READ_ONLY = [
  'taskDefinitionArn',
  'revision',
  'status',
  'requiresAttributes',
  'compatibilities',
  'registeredAt',
  'registeredBy',
  'deregisteredAt',
] as const;

/** A registrable copy of a task definition with the (single) container's image replaced. */
export function withImage(def: TaskDefinition, image: string): RegisterTaskDefinitionCommandInput {
  const copy = { ...def } as unknown as Record<string, unknown>;
  for (const key of READ_ONLY) delete copy[key];
  const input = copy as unknown as RegisterTaskDefinitionCommandInput;
  if (!input.family || !input.containerDefinitions?.length)
    throw new Error('task definition without family or container');
  input.containerDefinitions = input.containerDefinitions.map((c, i) =>
    i === 0 ? { ...c, image } : c,
  );
  return input;
}

/** The migration variant of a service task definition: own family, no health check, the migrate command. */
export function asMigrateTask(
  def: TaskDefinition,
  image: string,
  app: string,
): RegisterTaskDefinitionCommandInput {
  const input = withImage(def, image);
  input.family = names.migrateFamily(app);
  input.containerDefinitions = input.containerDefinitions!.map((c, i) => {
    if (i !== 0) return c;
    const { healthCheck: _ignored, ...rest } = c;
    return { ...rest, command: MIGRATE_COMMAND, essential: true };
  });
  return input;
}

export const currentImage = (def: TaskDefinition) => def.containerDefinitions?.[0]?.image;

/** Latest ACTIVE revision of a family, or undefined when the family does not exist yet. */
export async function latestTaskDefinition(family: string): Promise<TaskDefinition | undefined> {
  try {
    const { taskDefinition } = await ecs.send(
      new DescribeTaskDefinitionCommand({ taskDefinition: family }),
    );
    return taskDefinition;
  } catch (error) {
    if (error instanceof Error && /Unable to describe task definition/.test(error.message))
      return undefined;
    throw error;
  }
}

export async function describeService(app: string): Promise<Service> {
  const { services = [] } = await ecs.send(
    new DescribeServicesCommand({
      cluster,
      services: [names.service(app)],
      include: ['TAGS'],
    }),
  );
  const service = services.find((s) => s.status !== 'INACTIVE');
  if (!service)
    throw new Error(
      `ECS service ${names.service(app)} not found — deploy the stack ${names.appsStack} first (pnpm aws:deploy:apps)`,
    );
  return service;
}

/** The revision a service runs, with the given image: reused when it already matches, registered otherwise. */
export async function ensureRevision(app: string, tag: string): Promise<string> {
  const service = await describeService(app);
  const { taskDefinition: current } = await ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: service.taskDefinition! }),
  );
  const image = await imageUri(app, tag);
  if (currentImage(current!) === image) return current!.taskDefinitionArn!;
  const { taskDefinition } = await ecs.send(
    new RegisterTaskDefinitionCommand(withImage(current!, image)),
  );
  console.log(`${app}: registered ${taskDefinition!.family}:${taskDefinition!.revision} (${tag})`);
  return taskDefinition!.taskDefinitionArn!;
}

/** The migration task definition for an app at the given image (same env/secrets/roles as the service). */
export async function ensureMigrateRevision(app: string, tag: string): Promise<string> {
  const service = await describeService(app);
  const { taskDefinition: current } = await ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: service.taskDefinition! }),
  );
  const image = await imageUri(app, tag);
  const existing = await latestTaskDefinition(names.migrateFamily(app));
  if (
    existing &&
    currentImage(existing) === image &&
    JSON.stringify(existing.containerDefinitions?.[0]?.environment) ===
      JSON.stringify(current!.containerDefinitions?.[0]?.environment)
  )
    return existing.taskDefinitionArn!;
  const { taskDefinition } = await ecs.send(
    new RegisterTaskDefinitionCommand(asMigrateTask(current!, image, app)),
  );
  return taskDefinition!.taskDefinitionArn!;
}

/** Public subnets + the tasks security group; a public IP is mandatory (no NAT) to pull the image. */
export async function networkConfiguration() {
  const { publicSubnetIds, tasksSecurityGroupId } = await platformParams([
    'publicSubnetIds',
    'tasksSecurityGroupId',
  ]);
  return {
    awsvpcConfiguration: {
      subnets: publicSubnetIds.split(','),
      securityGroups: [tasksSecurityGroupId],
      assignPublicIp: 'ENABLED' as const,
    },
  };
}

export interface TaskOutcome {
  taskArn: string;
  exitCode: number | undefined;
  stoppedReason: string | undefined;
  containerName: string;
}

/** Runs one Fargate task and waits until it stopped (15 min at most). */
export async function runTaskAndWait(
  taskDefinition: string,
  startedBy: string,
): Promise<TaskOutcome> {
  const { tasks = [], failures = [] } = await ecs.send(
    new RunTaskCommand({
      cluster,
      taskDefinition,
      launchType: 'FARGATE',
      count: 1,
      startedBy,
      networkConfiguration: await networkConfiguration(),
      propagateTags: 'TASK_DEFINITION',
    }),
  );
  if (!tasks[0]?.taskArn)
    throw new Error(
      `RunTask failed: ${failures.map((f) => `${f.reason} ${f.detail ?? ''}`).join('; ')}`,
    );
  const taskArn = tasks[0].taskArn;
  console.log(`task ${taskArn.split('/').pop()} started — waiting…`);
  await waitUntilTasksStopped({ client: ecs, maxWaitTime: 900 }, { cluster, tasks: [taskArn] });
  const { tasks: stopped = [] } = await ecs.send(
    new DescribeTasksCommand({ cluster, tasks: [taskArn] }),
  );
  const task = stopped[0]!;
  const container = task.containers?.[0];
  return {
    taskArn,
    exitCode: container?.exitCode,
    stoppedReason: task.stoppedReason,
    containerName: container?.name ?? '',
  };
}

/** The awslogs stream of a task: <streamPrefix>/<container>/<task id>; stream prefix = app name (lib/services.ts). */
export async function taskLogs(
  app: string,
  containerName: string,
  taskArn: string,
): Promise<string[]> {
  const taskId = taskArn.split('/').pop();
  try {
    const { events = [] } = await logsClient.send(
      new GetLogEventsCommand({
        logGroupName: names.logGroup(app),
        logStreamName: `${app}/${containerName}/${taskId}`,
        startFromHead: true,
        limit: 200,
      }),
    );
    return events.map((e) => e.message ?? '');
  } catch (error) {
    return [`(no logs: ${error instanceof Error ? error.message : String(error)})`];
  }
}

/** Running tasks of a service. */
export async function runningTasks(app: string): Promise<string[]> {
  const { taskArns = [] } = await ecs.send(
    new ListTasksCommand({ cluster, serviceName: names.service(app), desiredStatus: 'RUNNING' }),
  );
  return taskArns;
}

/** Records which image a service runs, for `cdk synth` (lib/images.ts). */
export async function recordImageTag(app: string, tag: string) {
  await ssm.send(
    new PutParameterCommand({
      Name: names.imageParameter(app),
      Value: tag,
      Type: 'String',
      Overwrite: true,
    }),
  );
}

/** Waits until the given services finished their rollout (10 at a time, 15 min). */
export async function waitStable(appsToWait: string[]) {
  for (let i = 0; i < appsToWait.length; i += 10) {
    const chunk = appsToWait.slice(i, i + 10);
    console.log(`waiting for ${chunk.join(', ')} to stabilise…`);
    await waitUntilServicesStable(
      { client: ecs, maxWaitTime: 900 },
      { cluster, services: chunk.map((app) => names.service(app)) },
    );
  }
}

/**
 * Restarts the tasks of the given services with their current task definition (new secrets, same image).
 * Sleeping services (desiredCount 0) are skipped: they read the secrets when they wake.
 */
export async function forceNewDeployment(appsToRestart: string[]) {
  const awake: string[] = [];
  for (const app of appsToRestart) {
    const service = await describeService(app);
    if (!service.desiredCount) {
      console.log(`${app}: asleep, picks up the change on wake`);
      continue;
    }
    await ecs.send(
      new UpdateServiceCommand({
        cluster,
        service: names.service(app),
        forceNewDeployment: true,
      }),
    );
    awake.push(app);
  }
  if (awake.length) await waitStable(awake);
}
