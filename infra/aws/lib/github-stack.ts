import {
  Aws,
  CfnOutput,
  CliCredentialsStackSynthesizer,
  Duration,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { config, names } from './config.ts';

import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

const OIDC_HOST = 'token.actions.githubusercontent.com';

export interface GithubStackProps extends StackProps {
  /** owner/name of the repository allowed to assume the roles. */
  githubRepo: string;
}

/**
 * Everything GitHub Actions needs BEFORE it can deploy: the OIDC trust, one least-privilege role per workflow,
 * the permissions CloudFormation itself works with, and the buckets for the host bundle and DB snapshot exports.
 * No long-lived AWS keys exist: GitHub exchanges its OIDC token for short-lived credentials.
 *
 * Deployed from a laptop with admin credentials (scripts/bootstrap.ts) — never by GitHub, which is why this
 * stack uses the CLI credentials directly instead of the CDK deploy roles.
 */
export class GithubStack extends Stack {
  constructor(scope: Construct, id: string, { githubRepo, ...props }: GithubStackProps) {
    super(scope, id, { ...props, synthesizer: new CliCredentialsStackSynthesizer() });

    const account = Aws.ACCOUNT_ID;
    const arn = (service: string, resource: string) =>
      `arn:aws:${service}:${Aws.REGION}:${account}:${resource}`;

    // ---------------------------------------------------------------- trust
    const oidcArn = `arn:aws:iam::${account}:oidc-provider/${OIDC_HOST}`;
    const oidc = config.createOidcProvider
      ? new iam.CfnOIDCProvider(this, 'GitHubOidc', {
          url: `https://${OIDC_HOST}`,
          clientIdList: ['sts.amazonaws.com'],
          thumbprintList: ['6938fd4d98bab03faadb97b34396831e3780aea1'], // ignored by AWS for GitHub, required by the schema
        })
      : undefined;

    /** A role GitHub may assume, but only from the given context (`pull_request` or `environment:<env>`). */
    const githubRole = (logicalId: string, roleName: string, subject: string) => {
      const role = new iam.Role(this, logicalId, {
        roleName,
        assumedBy: new iam.FederatedPrincipal(
          oidcArn,
          {
            StringEquals: {
              [`${OIDC_HOST}:aud`]: 'sts.amazonaws.com',
              [`${OIDC_HOST}:sub`]: `repo:${githubRepo}:${subject}`,
            },
          },
          'sts:AssumeRoleWithWebIdentity',
        ),
      });
      if (oidc) role.node.addDependency(oidc);
      return role;
    };
    const allow = (role: iam.Role, actions: string[], resources: string[], conditions?: object) =>
      role.addToPolicy(
        new iam.PolicyStatement({ actions, resources, conditions: conditions as never }),
      );

    // ---------------------------------------------------------------- storage
    /** Host bundle (compose.yml, Caddyfile) uploaded by scripts/host-deploy.ts and fetched by the machine. */
    const artifacts = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: names.artifactsBucket(account),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // RDS snapshot exports to S3 must be encrypted with a customer managed key
    const snapshotKey = new kms.Key(this, 'SnapshotKey', {
      description: 'bf DB snapshot exports',
      enableKeyRotation: true,
      alias: names.snapshotKeyAlias,
    });
    const snapshots = new s3.Bucket(this, 'SnapshotBucket', {
      bucketName: names.snapshotBucket(account),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: snapshotKey,
      bucketKeyEnabled: true,
      lifecycleRules: [
        { id: 'expire-exports', expiration: Duration.days(config.snapshotExportRetentionDays) },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    /** Assumed by the RDS service itself while it exports a snapshot. */
    const rdsExport = new iam.Role(this, 'RdsExportRole', {
      roleName: names.rdsExportRole,
      assumedBy: new iam.ServicePrincipal('export.rds.amazonaws.com'),
    });
    snapshots.grantReadWrite(rdsExport);
    snapshotKey.grantEncryptDecrypt(rdsExport);
    snapshotKey.grant(rdsExport, 'kms:CreateGrant', 'kms:DescribeKey', 'kms:RetireGrant');

    // ---------------------------------------------------------------- what CloudFormation may do
    // `cdk bootstrap --cloudformation-execution-policies` attaches THIS policy to the role CloudFormation acts
    // with, so the GitHub roles never hold these permissions themselves. IAM is limited to bf-<env>-* names.
    const cfnExec = new iam.ManagedPolicy(this, 'CfnExecPolicy', {
      managedPolicyName: names.cfnExecPolicy,
      description: `What CloudFormation may create/change when deploying ${names.stack}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'Services',
          actions: ['ec2:*', 'rds:*', 'logs:*', 'cloudwatch:*'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Dns',
          actions: [
            'route53:ChangeResourceRecordSets',
            'route53:ListResourceRecordSets',
            'route53:GetHostedZone',
          ],
          resources: [`arn:aws:route53:::hostedzone/${config.hostedZoneId}`],
        }),
        new iam.PolicyStatement({
          sid: 'DnsStatus',
          actions: ['route53:GetChange'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Parameters',
          actions: ['ssm:*Parameter*', 'ssm:AddTagsToResource', 'ssm:RemoveTagsFromResource'],
          resources: [arn('ssm', `parameter/bf/*`), arn('ssm', 'parameter/cdk-bootstrap/*')],
        }),
        new iam.PolicyStatement({
          sid: 'Secrets',
          actions: ['secretsmanager:*'],
          resources: [arn('secretsmanager', 'secret:bf/*')],
        }),
        new iam.PolicyStatement({
          sid: 'SecretsRandom',
          actions: ['secretsmanager:GetRandomPassword'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'AppBuckets',
          actions: ['s3:*'],
          resources: ['arn:aws:s3:::bf-*', 'arn:aws:s3:::bf-*/*'],
        }),
        new iam.PolicyStatement({
          sid: 'Iam',
          actions: [
            'iam:CreateRole',
            'iam:DeleteRole',
            'iam:GetRole',
            'iam:PassRole',
            'iam:UpdateRole',
            'iam:UpdateAssumeRolePolicy',
            'iam:TagRole',
            'iam:UntagRole',
            'iam:AttachRolePolicy',
            'iam:DetachRolePolicy',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
            'iam:GetRolePolicy',
            'iam:ListRolePolicies',
            'iam:ListAttachedRolePolicies',
            'iam:CreateInstanceProfile',
            'iam:DeleteInstanceProfile',
            'iam:GetInstanceProfile',
            'iam:AddRoleToInstanceProfile',
            'iam:RemoveRoleFromInstanceProfile',
            'iam:TagInstanceProfile',
          ],
          resources: [
            `arn:aws:iam::${account}:role/bf-${config.env}-*`,
            `arn:aws:iam::${account}:instance-profile/bf-${config.env}-*`,
          ],
        }),
        // encrypted volumes / cluster / secrets use the AWS-managed keys; allowed only on behalf of those services
        new iam.PolicyStatement({
          sid: 'ManagedKeys',
          actions: [
            'kms:DescribeKey',
            'kms:CreateGrant',
            'kms:Decrypt',
            'kms:Encrypt',
            'kms:GenerateDataKey*',
            'kms:ReEncrypt*',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': ['ec2', 'rds', 'secretsmanager', 'ssm'].map(
                (service) => `${service}.${config.region}.amazonaws.com`,
              ),
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'ServiceLinkedRoles',
          actions: ['iam:CreateServiceLinkedRole'],
          resources: ['*'],
          conditions: { StringLike: { 'iam:AWSServiceName': ['rds.amazonaws.com'] } },
        }),
      ],
    });

    // ---------------------------------------------------------------- GitHub roles (one per concern)
    const cdkRoles = `arn:aws:iam::${account}:role/cdk-hnb659fds-*-role-${account}-${Aws.REGION}`;

    // pipeline.yml (plan-infra, pull requests) — `cdk diff`: reads the deployed template, can change nothing
    const plan = githubRole('GhaPlanRole', 'bf-gha-plan', 'pull_request');
    plan.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('job-function/ViewOnlyAccess'),
    );
    allow(
      plan,
      [
        'cloudformation:DescribeStacks',
        'cloudformation:GetTemplate',
        'cloudformation:ListStackResources',
      ],
      ['*'],
    );
    allow(plan, ['sts:AssumeRole'], [`arn:aws:iam::${account}:role/cdk-hnb659fds-lookup-role-*`]);

    // pipeline.yml (infra) — `cdk deploy`: may only hand the work to the CDK roles; CloudFormation acts with bf-cfn-exec
    const infra = githubRole('GhaInfraRole', 'bf-gha-infra', `environment:${config.env}`);
    allow(infra, ['sts:AssumeRole'], [cdkRoles]);

    // pipeline.yml (images, rollout) — push images, upload the host bundle, run the deploy on the machine. No CloudFormation.
    const app = githubRole('GhaAppRole', 'bf-gha-app', `environment:${config.env}`);
    allow(
      app,
      ['ecr:GetAuthorizationToken', 'ec2:DescribeInstances', 'ssm:GetCommandInvocation'],
      ['*'],
    );
    allow(
      app,
      [
        'ecr:CreateRepository',
        'ecr:DescribeRepositories',
        'ecr:PutLifecyclePolicy',
        'ecr:TagResource',
        'ecr:BatchCheckLayerAvailability',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:PutImage',
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
      ],
      [arn('ecr', `repository/bf-${config.env}/*`)],
    );
    allow(app, ['s3:PutObject'], [artifacts.arnForObjects(`${names.hostBundlePrefix}*`)]);
    allow(app, ['ssm:SendCommand'], [`arn:aws:ssm:${Aws.REGION}::document/AWS-RunShellScript`]);
    allow(app, ['ssm:SendCommand'], [arn('ec2', 'instance/*')], {
      StringEquals: { [`ssm:resourceTag/${names.hostTag.key}`]: names.hostTag.value },
    });

    // db-snapshot.yml (called by pipeline.yml) — cluster snapshot + export to S3 before each release
    const snapshot = githubRole('GhaSnapshotRole', 'bf-gha-snapshot', `environment:${config.env}`);
    const preSnapshots = arn('rds', `cluster-snapshot:${names.snapshotPrefix}*`);
    allow(
      snapshot,
      ['rds:DescribeDBClusters', 'rds:DescribeDBClusterSnapshots', 'rds:DescribeExportTasks'],
      ['*'],
    );
    allow(
      snapshot,
      ['rds:CreateDBClusterSnapshot', 'rds:AddTagsToResource'],
      [arn('rds', `cluster:${names.dbCluster}`), preSnapshots],
    );
    allow(snapshot, ['rds:DeleteDBClusterSnapshot', 'rds:StartExportTask'], [preSnapshots]);
    // RDS checks the pass on behalf of the caller, so the service is rds.amazonaws.com; export.rds… is the
    // service that assumes the role (its trust policy), kept here too.
    allow(snapshot, ['iam:PassRole'], [rdsExport.roleArn], {
      StringEquals: { 'iam:PassedToService': ['rds.amazonaws.com', 'export.rds.amazonaws.com'] },
    });
    allow(
      snapshot,
      ['kms:DescribeKey', 'kms:CreateGrant', 'kms:Decrypt', 'kms:GenerateDataKey*'],
      [snapshotKey.keyArn],
    );

    const output = (key: string, value: string, description?: string) =>
      new CfnOutput(this, key, { value, description });
    output('Account', account, 'Set as GitHub repo variable AWS_ACCOUNT_ID');
    output('Repository', githubRepo, 'The only repository that may assume the roles');
    output('CfnExecPolicyArn', cfnExec.managedPolicyArn);
    output('ArtifactsBucketName', artifacts.bucketName);
    output('SnapshotBucketName', snapshots.bucketName);
    for (const role of [plan, infra, app, snapshot]) output(`${role.node.id}Arn`, role.roleArn);
  }
}
