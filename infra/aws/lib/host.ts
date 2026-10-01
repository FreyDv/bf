import { Aws, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { config, names } from './config.ts';
import { hostSetupCommands } from './host-commands.ts';

import type { Data } from './data.ts';
import type { Network } from './network.ts';
import type { Secrets } from './secrets.ts';

export interface HostProps {
  network: Network;
  secrets: Secrets;
  data: Data;
}

/**
 * The one machine: runs `docker compose` (infra/aws/host/compose.yml) with Caddy in front.
 * No SSH and no key pair — shell access and deploys go through SSM (scripts/host-deploy.ts).
 */
export class Host extends Construct {
  readonly instance: ec2.Instance;
  readonly publicIp: string;

  constructor(scope: Construct, id: string, { network, secrets, data }: HostProps) {
    super(scope, id);

    const registry = names.ecrRegistry(Aws.ACCOUNT_ID);
    const artifactsBucket = names.artifactsBucket(Aws.ACCOUNT_ID);
    const arn = (service: string, resource: string) =>
      `arn:aws:${service}:${Aws.REGION}:${Aws.ACCOUNT_ID}:${resource}`;

    const logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: names.logGroup,
      retention: config.logRetentionDays,
    });

    // non-secret half of the host's .env (the secret half is read from Secrets Manager at deploy time)
    const hostEnv = new ssm.StringParameter(this, 'HostEnv', {
      parameterName: names.hostEnvParameter,
      description: 'bf host: non-secret variables for infra/aws/host/compose.yml',
      stringValue: [
        `AWS_REGION=${config.region}`,
        `ECR_PREFIX=${registry}/bf-${config.env}`,
        `LOG_GROUP=${names.logGroup}`,
        `MAIN_DOMAIN=${config.domains.main}`,
        `API_DOMAIN=${config.domains.api}`,
        `ADMIN_DOMAIN=${config.domains.admin}`,
        `POSTGRES_HOST=${data.cluster.clusterEndpoint.hostname}`,
        `POSTGRES_USER=${config.db.user}`,
        `POSTGRES_DEFAULT_DB=${config.db.defaultDatabase}`,
        `S3_BUCKET=${data.bucket.bucketName}`,
      ].join('\n'),
    });

    const role = new iam.Role(this, 'Role', {
      roleName: names.hostRole,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    role.addToPolicy(
      new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PullImages',
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
        ],
        resources: [arn('ecr', `repository/bf-${config.env}/*`)],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadBundle',
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::${artifactsBucket}`,
          `arn:aws:s3:::${artifactsBucket}/${names.hostBundlePrefix}*`,
        ],
      }),
    );
    for (const secret of secrets.all) secret.grantRead(role);
    hostEnv.grantRead(role);
    logGroup.grantWrite(role);
    // what the `order` container may do with the app bucket (it gets these credentials through IMDS)
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AppBucket',
        actions: [
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject',
          's3:ListBucket',
          's3:AbortMultipartUpload',
          's3:ListMultipartUploadParts',
        ],
        resources: [data.bucket.bucketArn, data.bucket.arnForObjects('*')],
      }),
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(...hostSetupCommands(registry, artifactsBucket));

    this.instance = new ec2.Instance(this, 'Instance', {
      instanceName: names.stack,
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, availabilityZones: [config.azs[0]] },
      securityGroup: network.hostSg,
      instanceType: new ec2.InstanceType(config.host.instanceType),
      machineImage: ec2.MachineImage.genericLinux({ [config.region]: config.host.amiId }),
      role,
      userData,
      // IMDSv2 only; hop limit 2 lets a container (one network hop further) reach the instance role
      httpTokens: ec2.HttpTokens.REQUIRED,
      httpPutResponseHopLimit: 2,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(config.host.volumeGb, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });
    // the tag scripts/host-deploy.ts finds the machine by, and the only one bf-gha-app may send commands to
    Tags.of(this.instance).add(names.hostTag.key, names.hostTag.value);
    // the first boot already needs the database endpoint, the secrets and the log group to exist
    this.instance.node.addDependency(hostEnv, logGroup);

    // fixed public address that survives a stop/start or a replacement of the machine
    const eip = new ec2.CfnEIP(this, 'Eip', { domain: 'vpc' });
    new ec2.CfnEIPAssociation(this, 'EipAssociation', {
      allocationId: eip.attrAllocationId,
      instanceId: this.instance.instanceId,
    });
    this.publicIp = eip.attrPublicIp;

    for (const [key, domain] of Object.entries({
      Main: config.domains.main,
      Api: config.domains.api,
      Admin: config.domains.admin,
    })) {
      new route53.CfnRecordSet(this, `${key}Record`, {
        hostedZoneId: config.hostedZoneId,
        name: `${domain}.`,
        type: 'A',
        ttl: '300',
        resourceRecords: [eip.attrPublicIp],
      });
    }
  }
}
