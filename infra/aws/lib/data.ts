import { Aws, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { config, names } from './config.ts';

import type { Network } from './network.ts';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface DataProps {
  network: Network;
  dbPassword: secretsmanager.ISecret;
}

/**
 * Aurora Serverless v2 Postgres that pauses to 0 ACU when nobody is connected, plus the app bucket.
 * One cluster, one database per app (created by the `db-init` compose service), master user for all.
 */
export class Data extends Construct {
  readonly cluster: rds.DatabaseCluster;
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, { network, dbPassword }: DataProps) {
    super(scope, id);

    const engine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.of(
        config.db.engineVersion,
        config.db.engineVersion.split('.')[0]!,
      ),
    });

    this.cluster = new rds.DatabaseCluster(this, 'Db', {
      clusterIdentifier: names.dbCluster,
      engine,
      credentials: rds.Credentials.fromPassword(config.db.user, dbPassword.secretValue),
      defaultDatabaseName: config.db.defaultDatabase,
      // scale-to-zero: idle for `autoPauseSeconds` with no connections → 0 ACU; the first connection resumes it (~15 s)
      serverlessV2MinCapacity: config.db.minAcu,
      serverlessV2MaxCapacity: config.db.maxAcu,
      serverlessV2AutoPauseDuration: Duration.seconds(config.db.autoPauseSeconds),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        instanceIdentifier: `${names.dbCluster}-writer`,
        // public endpoint so a laptop can use a plain DB URL; who may connect is decided by the security groups
        publiclyAccessible: true,
        enablePerformanceInsights: false,
      }),
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [network.dbSg, network.dbDevSg],
      // TLS only. Logical replication stays OFF: a replication slot would keep the cluster from pausing.
      parameterGroup: new rds.ParameterGroup(this, 'DbParams', {
        engine,
        description: 'bf aurora postgres: TLS required',
        parameters: { 'rds.force_ssl': '1' },
      }),
      storageEncrypted: true,
      backup: { retention: Duration.days(config.db.backupDays) },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    // short, stable name for humans: postgresql://bf:…@db.<domain>:5432/<db>?sslmode=require
    new route53.CfnRecordSet(this, 'DbRecord', {
      hostedZoneId: config.hostedZoneId,
      name: `${config.domains.db}.`,
      type: 'CNAME',
      ttl: '300',
      resourceRecords: [this.cluster.clusterEndpoint.hostname],
    });

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: names.appBucket(Aws.ACCOUNT_ID),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ id: 'abort-mpu', abortIncompleteMultipartUploadAfter: Duration.days(7) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
