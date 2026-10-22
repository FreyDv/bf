// Database migrations as one-off Fargate tasks: for every DB-backed app (or the given ones) runs the app image
// with the command of packages/db/src/cli/migrate.ts — CREATE DATABASE if missing, then `drizzle-kit migrate`.
// Same env/secrets/roles as the service (the task definition is a copy of the service's, family <app>-migrate).
// Sequential, exit code checked, logs printed on failure. Aurora resumes from its pause on the first connection.
// Usage: node infra/aws/scripts/ecs-migrate.ts [--tag <sha>] [app ...]      (default tag: what the service runs)
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

import { ensureMigrateRevision, runTaskAndWait, taskLogs } from './_ecs.ts';
import { apps, flag, isEntry, main, positionals, sdk, summary } from './_lib.ts';
import { names } from '../lib/config.ts';
import { DEFAULT_IMAGE_TAG } from '../lib/images.ts';

async function currentTag(app: string): Promise<string> {
  try {
    const { Parameter } = await new SSMClient(sdk).send(
      new GetParameterCommand({ Name: names.imageParameter(app) }),
    );
    return Parameter?.Value ?? DEFAULT_IMAGE_TAG;
  } catch {
    return DEFAULT_IMAGE_TAG;
  }
}

export async function migrate(only: string[], tag?: string) {
  const targets = apps(only).filter((a) => a.deploy === 'ecs' && a.migrations);
  const notMigratable = only.filter((name) => !targets.some((a) => a.name === name));
  if (notMigratable.length) throw new Error(`no migrations for: ${notMigratable.join(', ')}`);
  if (!targets.length) {
    console.log('nothing to migrate');
    return;
  }

  const done: string[] = [];
  for (const app of targets) {
    const imageTag = tag ?? (await currentTag(app.name));
    console.log(`== migrate ${app.name} (${imageTag})`);
    const taskDefinition = await ensureMigrateRevision(app.name, imageTag);
    const outcome = await runTaskAndWait(taskDefinition, 'ecs-migrate');
    if (outcome.exitCode !== 0) {
      const logs = await taskLogs(app.name, outcome.containerName, outcome.taskArn);
      console.error(logs.join('\n'));
      summary(
        `### Migrations\n- ✅ ${done.join(', ') || '–'}\n- ❌ \`${app.name}\`: ${outcome.stoppedReason ?? `exit ${outcome.exitCode}`}`,
      );
      throw new Error(
        `migration of ${app.name} failed (${outcome.stoppedReason ?? `exit code ${outcome.exitCode}`})`,
      );
    }
    console.log(`${app.name}: migrated`);
    done.push(app.name);
  }
  summary(`### Migrations\n${done.map((a) => `- ✅ \`${a}\``).join('\n')}`);
}

if (isEntry(import.meta.url)) {
  main(() => migrate(positionals(), flag('tag')));
}
