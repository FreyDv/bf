// Releases to the machine: uploads the bundle (infra/aws/host/*) to S3, then runs the deploy on the host through
// SSM Run Command (no SSH, no open port) and streams the result back. What runs there: lib/host-commands.ts.
//   fetch bundle → write .env → pull images (floating tag <env>) → create missing databases → migrate → compose up
// Only containers whose image or configuration changed are recreated.
// Usage: node infra/aws/scripts/host-deploy.ts [--migrate all|none|auth,order]      (default: all)
//        node infra/aws/scripts/host-deploy.ts --print                              (show the commands, change nothing)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { accountId, apps, awsDir, findHost, flag, main, runOnHost, sdk, summary } from './_lib.ts';
import { names } from '../lib/config.ts';
import { HOST_SCRIPT_HEADER, hostDeployCommands } from '../lib/host-commands.ts';

const bundleDir = join(awsDir, 'host');

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
