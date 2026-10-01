// Releases to the machine: uploads the bundle (infra/aws/host/*) to S3, then runs the deploy on the host through
// SSM Run Command (no SSH, no open port) and streams the result back. What runs there: lib/host-commands.ts.
//   fetch bundle → write .env → pull images (floating tag <env>) → create missing databases → migrate → compose up
// Only containers whose image or configuration changed are recreated.
// Usage: node infra/aws/scripts/host-deploy.ts [--migrate all|none|auth,order]      (default: all)
//        node infra/aws/scripts/host-deploy.ts --print                              (show the commands, change nothing)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DescribeInstancesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetCommandInvocationCommand, SendCommandCommand, SSMClient } from '@aws-sdk/client-ssm';

import { accountId, apps, awsDir, flag, main, sdk, sleep, summary } from './_lib.ts';
import { names } from '../lib/config.ts';
import { HOST_SCRIPT_HEADER, hostDeployCommands } from '../lib/host-commands.ts';

const bundleDir = join(awsDir, 'host');
const TIMEOUT_SECONDS = 1800;

/** The running instance tagged bf:env=<env>. */
async function findHost(): Promise<string> {
  const { Reservations = [] } = await new EC2Client(sdk).send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: `tag:${names.hostTag.key}`, Values: [names.hostTag.value] },
        { Name: 'instance-state-name', Values: ['running'] },
      ],
    }),
  );
  const ids = Reservations.flatMap((r) => r.Instances ?? []).map((i) => i.InstanceId!);
  if (ids.length !== 1) {
    throw new Error(
      `expected exactly one running host, found ${ids.length} — is ${names.stack} deployed?`,
    );
  }
  return ids[0]!;
}

async function uploadBundle(bucket: string) {
  const s3 = new S3Client(sdk);
  for (const file of readdirSync(bundleDir)) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${names.hostBundlePrefix}${file}`,
        Body: readFileSync(join(bundleDir, file)),
      }),
    );
    console.log(`uploaded ${file} → s3://${bucket}/${names.hostBundlePrefix}${file}`);
  }
}

/** Sends the script and polls until it finishes; returns the invocation (status + output). */
async function runOnHost(instanceId: string, commands: string[]) {
  const ssm = new SSMClient(sdk);
  const { Command } = await ssm.send(
    new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: 'AWS-RunShellScript',
      Comment: 'bf host deploy',
      TimeoutSeconds: 60,
      Parameters: { commands, executionTimeout: [String(TIMEOUT_SECONDS)] },
    }),
  );
  const commandId = Command!.CommandId!;
  console.log(`ssm command ${commandId} on ${instanceId} — waiting…`);

  const deadline = Date.now() + (TIMEOUT_SECONDS + 120) * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const invocation = await ssm
      .send(new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId }))
      .catch((error: Error) => {
        if (error.name === 'InvocationDoesNotExist') return undefined; // not registered yet
        throw error;
      });
    if (invocation && !['Pending', 'InProgress', 'Delayed'].includes(invocation.Status ?? '')) {
      return invocation;
    }
  }
  throw new Error(`ssm command ${commandId} did not finish in time`);
}

main(async () => {
  const dbApps = apps()
    .filter((a) => a.migrations)
    .map((a) => a.name);
  const choice = flag('migrate') ?? 'all';
  const migrate =
    choice === 'all' ? dbApps : choice === 'none' ? [] : choice.split(',').map((s) => s.trim());
  const notMigratable = migrate.filter((name) => !dbApps.includes(name));
  if (notMigratable.length) throw new Error(`no migrations for: ${notMigratable.join(', ')}`);

  const bucket = names.artifactsBucket(
    process.argv.includes('--print') ? '<account>' : await accountId(),
  );
  const commands = [
    ...HOST_SCRIPT_HEADER,
    ...hostDeployCommands({ bucket, databases: dbApps, migrate }),
  ];
  if (process.argv.includes('--print')) return console.log(commands.join('\n'));

  const instanceId = await findHost();
  await uploadBundle(bucket);
  const result = await runOnHost(instanceId, commands);

  // SSM keeps the last 24 000 characters of each stream
  if (result.StandardOutputContent) console.log(result.StandardOutputContent);
  if (result.StandardErrorContent) console.error(result.StandardErrorContent);
  summary(`### Host deploy: ${result.Status}\n- migrated: ${migrate.join(', ') || 'nothing'}`);
  if (result.Status !== 'Success') {
    throw new Error(
      `deploy ${result.Status} (exit code ${result.ResponseCode}) — see the output above`,
    );
  }
  console.log('deploy succeeded');
});
