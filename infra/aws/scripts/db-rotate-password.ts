// Rotates the database master password end to end:
//   1. generate a new password and store it in Secrets Manager as AWSPENDING (the live secret is untouched)
//   2. set it on the Aurora cluster and wait until the cluster is available again
//   3. promote it to AWSCURRENT (the old value stays reachable as AWSPREVIOUS)
//   4. refresh /opt/bf/.env on the host and recreate the containers that use it (SSM, no SSH)
// If step 2 fails nothing has changed (the pending version is dropped). If step 4 fails the database and the secret
// already agree: re-run with --restart-only. Connected clients keep their session until they reconnect; your own
// psql/DataGrip sessions need the new password: pnpm -s db:url.
// Usage: node infra/aws/scripts/db-rotate-password.ts [--yes]      (without --yes it asks for confirmation)
//        node infra/aws/scripts/db-rotate-password.ts --restart-only      (only step 4)
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

import { DescribeDBClustersCommand, ModifyDBClusterCommand, RDSClient } from '@aws-sdk/client-rds';
import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';

import { findHost, main, runOnHost, sdk, sleep, summary } from './_lib.ts';
import { names } from '../lib/config.ts';
import { HOST_SCRIPT_HEADER, hostRefreshSecretsCommands } from '../lib/host-commands.ts';

const secrets = new SecretsManagerClient(sdk);
const rds = new RDSClient(sdk);
const SecretId = names.secret('POSTGRES_PASSWORD');

/** 32 characters, letters and digits only: safe in .env, URLs and compose without any escaping. */
function newPassword(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(32), (byte) => alphabet[byte % alphabet.length]).join('');
}

async function confirm() {
  if (process.argv.includes('--yes')) return;
  if (!process.stdin.isTTY)
    throw new Error('not a terminal: pass --yes to rotate without a prompt');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Rotate ${SecretId} and restart the database-backed containers (a few seconds of downtime)? [y/N] `,
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'y') throw new Error('cancelled');
}

async function clusterStatus(): Promise<string | undefined> {
  const { DBClusters = [] } = await rds.send(
    new DescribeDBClustersCommand({ DBClusterIdentifier: names.dbCluster }),
  );
  return DBClusters[0]?.Status;
}

async function waitAvailable() {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const status = await clusterStatus();
    if (status === 'available') return;
    console.log(`  cluster ${status}…`);
  }
  throw new Error('the cluster did not become available in 15 minutes');
}

async function dropPending(versionId: string) {
  await secrets
    .send(
      new UpdateSecretVersionStageCommand({
        SecretId,
        VersionStage: 'AWSPENDING',
        RemoveFromVersionId: versionId,
      }),
    )
    .catch(() => undefined); // best effort: the pending label is harmless
}

async function rotate() {
  const current = await secrets.send(new GetSecretValueCommand({ SecretId }));
  const password = newPassword();

  const pending = await secrets.send(
    new PutSecretValueCommand({ SecretId, SecretString: password, VersionStages: ['AWSPENDING'] }),
  );
  console.log('new password stored as AWSPENDING');

  try {
    await rds.send(
      new ModifyDBClusterCommand({
        DBClusterIdentifier: names.dbCluster,
        MasterUserPassword: password,
        ApplyImmediately: true,
      }),
    );
  } catch (error) {
    await dropPending(pending.VersionId!);
    throw error;
  }
  console.log('password set on the cluster — waiting until it is available…');
  await waitAvailable();

  await secrets.send(
    new UpdateSecretVersionStageCommand({
      SecretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: pending.VersionId,
      RemoveFromVersionId: current.VersionId,
    }),
  );
  await dropPending(pending.VersionId!);
  console.log(`${SecretId} now holds the new password (previous one kept as AWSPREVIOUS)`);
}

async function restartApps() {
  const result = await runOnHost(
    await findHost(),
    [...HOST_SCRIPT_HEADER, ...hostRefreshSecretsCommands()],
    'bf db password rotation',
  );
  if (result.StandardOutputContent) console.log(result.StandardOutputContent);
  if (result.StandardErrorContent) console.error(result.StandardErrorContent);
  if (result.Status !== 'Success') {
    throw new Error(
      `container restart ${result.Status} (exit code ${result.ResponseCode}) — the secret and the database already ` +
        'match; fix the cause and run again with --restart-only',
    );
  }
}

main(async () => {
  const restartOnly = process.argv.includes('--restart-only');
  if (!restartOnly) {
    await confirm();
    await rotate();
  }
  await restartApps();
  summary(`### DB password rotated${restartOnly ? ' (restart only)' : ''}`);
  console.log('done: containers run with the new password');
});
