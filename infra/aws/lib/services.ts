import { Aws, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import { renderEnv } from './apps.ts';
import { config, names } from './config.ts';
import { workSubnets } from './network.ts';

import type { PlatformEnv, ServiceSpec } from './apps.ts';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import type * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';

export interface ServicePlatform extends PlatformEnv {
  vpc: ec2.IVpc;
  tasksSg: ec2.ISecurityGroup;
  cluster: ecs.ICluster;
  namespace: servicediscovery.INamespace;
  apiTargetGroup: elbv2.IApplicationTargetGroup;
  appBucketRef: s3.IBucket;
}

export interface ServiceProps {
  spec: ServiceSpec;
  /** Every ECS service (for the route table and the *_URL env of this one). */
  all: ServiceSpec[];
  platform: ServicePlatform;
  /** Image tag to run (lib/images.ts: SSM parameter or the floating `:prod`). */
  imageTag: string;
  executionRole: iam.IRole;
}

/**
 * One Nest app on Fargate: task role, log group, task definition, service (Service Connect, circuit breaker,
 * ECS Exec) and its scaling target. `desiredCount` is deliberately NOT in the template: ECS owns it (the
 * orchestrator in `api` wakes/sleeps services), the scalable target's minimum keeps always-on services up,
 * and a `cdk deploy` never resets what is running.
 */
export class Service extends Construct {
  readonly taskRole: iam.Role;
  readonly logGroup: logs.LogGroup;
  readonly taskDefinition: ecs.FargateTaskDefinition;
  readonly service: ecs.FargateService;

  constructor(
    scope: Construct,
    id: string,
    { spec, all, platform, imageTag, executionRole }: ServiceProps,
  ) {
    super(scope, id);
    const { name, port } = spec;
    const isEdge = name === 'api';

    // ---------------------------------------------------------------- identity
    this.taskRole = new iam.Role(this, 'TaskRole', {
      roleName: names.taskRole(name),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: `bf ${name} container`,
    });
    if (isEdge) this.grantOrchestrator(this.taskRole, platform.cluster.clusterArn);
    if (name === 'order') {
      platform.appBucketRef.grantReadWrite(this.taskRole);
      this.taskRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['s3:AbortMultipartUpload', 's3:ListMultipartUploadParts'],
          resources: [platform.appBucketRef.arnForObjects('*')],
        }),
      );
    }

    // ---------------------------------------------------------------- task definition
    this.logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: names.logGroup(name),
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'Task', {
      family: names.taskFamily(name),
      cpu: spec.cpu,
      memoryLimitMiB: spec.memory,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      executionRole,
      taskRole: this.taskRole,
    });
    const repository = ecr.Repository.fromRepositoryName(this, 'Repo', names.ecrRepository(name));
    this.taskDefinition.addContainer(name, {
      containerName: name,
      image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
      portMappings: [{ name: 'http', containerPort: port, appProtocol: ecs.AppProtocol.http }],
      environment: renderEnv(spec, all, platform),
      secrets: Object.fromEntries(
        spec.secrets.map((key) => [
          key,
          ecs.Secret.fromSecretsManager(
            secretsmanager.Secret.fromSecretNameV2(this, `Secret-${key}`, names.secret(key)),
          ),
        ]),
      ),
      healthCheck: {
        command: [
          'CMD-SHELL',
          `node -e "fetch('http://127.0.0.1:${port}/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"`,
        ],
        interval: Duration.seconds(10),
        timeout: Duration.seconds(5),
        retries: 6,
        startPeriod: Duration.seconds(30),
      },
      stopTimeout: Duration.seconds(30),
      logging: ecs.LogDrivers.awsLogs({ logGroup: this.logGroup, streamPrefix: name }),
    });

    // ---------------------------------------------------------------- service
    this.service = new ecs.FargateService(this, 'Service', {
      serviceName: names.service(name),
      cluster: platform.cluster,
      taskDefinition: this.taskDefinition,
      vpcSubnets: workSubnets,
      assignPublicIp: true, // no NAT: the public IP is the task's way out (ECR, logs, secrets, OpenAI)
      securityGroups: [platform.tasksSg],
      circuitBreaker: { enable: true, rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      enableExecuteCommand: true,
      healthCheckGracePeriod: isEdge ? Duration.seconds(60) : undefined,
      serviceConnectConfiguration: {
        namespace: config.ecs.namespace,
        // the edge is a client only (the ALB reaches it); every other service is registered under its name
        services: isEdge
          ? undefined
          : [
              {
                portMappingName: 'http',
                discoveryName: name,
                dnsName: name,
                port,
                perRequestTimeout: Duration.seconds(30),
                idleTimeout: Duration.seconds(60),
              },
            ],
        logDriver: ecs.LogDrivers.awsLogs({ logGroup: this.logGroup, streamPrefix: 'sc' }),
      },
    });
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: spec.alwaysOn ? spec.minTasks : 0,
      maxCapacity: spec.maxTasks,
    });
    scaling.scaleOnCpuUtilization('Cpu', {
      targetUtilizationPercent: config.ecs.cpuTargetPercent,
      scaleInCooldown: Duration.minutes(5),
      scaleOutCooldown: Duration.minutes(1),
    });

    if (isEdge) {
      this.service.attachToApplicationTargetGroup(platform.apiTargetGroup);
      // the orchestrator logs {event:"wake_failed"} when a service never gets a running task
      const metric = this.logGroup
        .addMetricFilter('WakeFailed', {
          metricNamespace: 'bf',
          metricName: 'WakeFailed',
          filterPattern: logs.FilterPattern.stringValue('$.event', '=', 'wake_failed'),
          metricValue: '1',
        })
        .metric({ statistic: 'sum', period: Duration.minutes(5) });
      new cloudwatch.Alarm(this, 'WakeFailedAlarm', {
        alarmName: `${names.service(name)}-wake-failed`,
        metric,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }

  /** What the orchestrator inside `api` may do: wake/sleep services of THIS cluster, nothing else. */
  private grantOrchestrator(role: iam.Role, clusterArn: string) {
    const services = `arn:aws:ecs:${Aws.REGION}:${Aws.ACCOUNT_ID}:service/${names.cluster}/*`;
    const tasks = `arn:aws:ecs:${Aws.REGION}:${Aws.ACCOUNT_ID}:task/${names.cluster}/*`;
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Services',
        actions: [
          'ecs:DescribeServices',
          'ecs:UpdateService',
          'ecs:TagResource',
          'ecs:ListTagsForResource',
        ],
        resources: [services],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Tasks',
        actions: ['ecs:ListTasks'],
        resources: ['*'],
        conditions: { ArnEquals: { 'ecs:cluster': clusterArn } },
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'TaskDetails',
        actions: ['ecs:DescribeTasks'],
        resources: [tasks],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Scaling',
        actions: [
          'application-autoscaling:RegisterScalableTarget',
          'application-autoscaling:DescribeScalableTargets',
        ],
        resources: ['*'],
      }),
    );
  }
}
