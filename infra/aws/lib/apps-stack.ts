import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

import { config, names } from './config.ts';
import { Service } from './services.ts';

import type { ServiceSpec } from './apps.ts';
import type { ProdStack } from './prod-stack.ts';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export interface AppsStackProps extends StackProps {
  platform: ProdStack;
  /** Every ECS service (lib/apps.ts `services()`). */
  specs: ServiceSpec[];
  /** Image tag per app (lib/images.ts). */
  imageTags: Record<string, string>;
}

/**
 * The services (`bf-prod-apps`): one Fargate service per Nest app, generated from scripts/apps.mjs. Imports the
 * platform through the construct references of bf-prod (CloudFormation exports): replacing an exported resource
 * there (e.g. the tasks security group) takes two deploys — keep the old value exported with
 * `prodStack.exportValue(...)`, deploy, update this stack, then drop the export.
 */
export class AppsStack extends Stack {
  readonly services: Record<string, Service> = {};

  constructor(
    scope: Construct,
    id: string,
    { platform, specs, imageTags, ...props }: AppsStackProps,
  ) {
    super(scope, id, props);

    // one execution role for every task: pull from ECR, read the secrets, write the logs (grants added per container)
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: names.executionRole,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    const shared = {
      vpc: platform.network.vpc,
      tasksSg: platform.network.tasksSg,
      cluster: platform.cluster.cluster,
      namespace: platform.cluster.namespace,
      apiTargetGroup: platform.ingress.apiTargetGroup,
      appBucketRef: platform.data.bucket,
      dbHost: platform.data.cluster.clusterEndpoint.hostname,
      appBucket: platform.data.bucket.bucketName,
      clusterName: platform.cluster.cluster.clusterName,
    };
    for (const spec of specs) {
      this.services[spec.name] = new Service(this, `Service-${spec.name}`, {
        spec,
        all: specs,
        platform: shared,
        imageTag: imageTags[spec.name] ?? config.env,
        executionRole,
      });
    }
  }

  /** Fixed AZs (lib/config.ts) instead of an account lookup, so synth works without AWS credentials. */
  override get availabilityZones(): string[] {
    return [...config.azs];
  }
}
