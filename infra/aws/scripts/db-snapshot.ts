// Pre-release safety net: manual Aurora cluster snapshot (the thing you RESTORE from) + export of it to S3
// (Parquet archive in bf-db-snapshots-<acct>-<region>/<env>/<snapshot>/, encrypted with alias/bf-db-snapshots).
// The export runs async inside RDS and is NOT awaited: only the snapshot gates the release.
// Keeps the newest KEEP (default 10) pre-release snapshots. No cluster yet (first deploy) → no-op.
// Usage: node infra/aws/scripts/db-snapshot.ts [label=manual]
import { DescribeKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import {
  CreateDBClusterSnapshotCommand,
  DBClusterNotFoundFault,
  DeleteDBClusterSnapshotCommand,
  DescribeDBClustersCommand,
  DescribeDBClusterSnapshotsCommand,
  RDSClient,
  StartExportTaskCommand,
  waitUntilDBClusterSnapshotAvailable,
} from '@aws-sdk/client-rds';

import { accountId, main, positionals, sdk, summary } from './_lib.ts';
import { config, names } from '../lib/config.ts';

const rds = new RDSClient(sdk);
const KEEP = Number(process.env.KEEP ?? 10);

async function clusterExists(): Promise<boolean> {
  try {
    await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: names.dbCluster }));
    return true;
  } catch (error) {
    if (error instanceof DBClusterNotFoundFault) return false;
    throw error;
  }
}

main(async () => {
  const label = (positionals()[0] ?? 'manual').replace(/[^A-Za-z0-9-]/g, '-');
  if (!(await clusterExists())) {
    console.log(
      `::notice::Aurora cluster '${names.dbCluster}' does not exist yet (first deploy) — nothing to snapshot`,
    );
    return;
  }

  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const snapshotId = `${names.snapshotPrefix}${label}-${timestamp}`;
  console.log(`snapshot: ${snapshotId}`);
  const { DBClusterSnapshot } = await rds.send(
    new CreateDBClusterSnapshotCommand({
      DBClusterIdentifier: names.dbCluster,
      DBClusterSnapshotIdentifier: snapshotId,
      Tags: [
        { Key: 'bf:purpose', Value: 'pre-release' },
        { Key: 'bf:label', Value: label },
      ],
    }),
  );
  await waitUntilDBClusterSnapshotAvailable(
    { client: rds, maxWaitTime: 1800 },
    { DBClusterSnapshotIdentifier: snapshotId },
  );
  const snapshotArn = DBClusterSnapshot!.DBClusterSnapshotArn!;
  console.log(`snapshot available: ${snapshotArn}`);

  const account = await accountId();
  const exportTarget = `s3://${names.snapshotBucket(account)}/${config.env}/${snapshotId}/`;
  try {
    const { KeyMetadata } = await new KMSClient(sdk).send(
      new DescribeKeyCommand({ KeyId: names.snapshotKeyAlias }),
    );
    await rds.send(
      new StartExportTaskCommand({
        ExportTaskIdentifier: snapshotId,
        SourceArn: snapshotArn,
        S3BucketName: names.snapshotBucket(account),
        S3Prefix: `${config.env}/${snapshotId}`,
        IamRoleArn: `arn:aws:iam::${account}:role/${names.rdsExportRole}`,
        KmsKeyId: KeyMetadata!.Arn,
      }),
    );
    console.log(`export started → ${exportTarget} (async)`);
  } catch (error) {
    console.log(
      `::warning::snapshot ${snapshotId} exists but the S3 export could not be started: ${String(error)}`,
    );
  }

  // retention: drop old pre-release snapshots
  const { DBClusterSnapshots = [] } = await rds.send(
    new DescribeDBClusterSnapshotsCommand({
      DBClusterIdentifier: names.dbCluster,
      SnapshotType: 'manual',
    }),
  );
  const old = DBClusterSnapshots.filter((s) =>
    s.DBClusterSnapshotIdentifier?.startsWith(names.snapshotPrefix),
  )
    .sort((a, b) => (a.SnapshotCreateTime?.getTime() ?? 0) - (b.SnapshotCreateTime?.getTime() ?? 0))
    .slice(0, -KEEP);
  for (const snapshot of old) {
    console.log(`prune: ${snapshot.DBClusterSnapshotIdentifier}`);
    await rds.send(
      new DeleteDBClusterSnapshotCommand({
        DBClusterSnapshotIdentifier: snapshot.DBClusterSnapshotIdentifier,
      }),
    );
  }

  summary(
    [
      '### DB snapshot',
      `- snapshot: \`${snapshotId}\` (restore: \`aws rds restore-db-cluster-from-snapshot\`)`,
      `- S3 export: \`${exportTarget}\``,
    ].join('\n'),
  );
});
