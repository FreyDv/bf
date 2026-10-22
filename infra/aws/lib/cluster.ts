import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';

import { config, names } from './config.ts';

import type { Network } from './network.ts';

/**
 * The ECS cluster and its Cloud Map namespace. Service Connect registers every service under its app name in
 * `bf-prod.local`, so `http://auth:3001` works from any task exactly as it does in docker compose.
 */
export class Cluster extends Construct {
  readonly cluster: ecs.Cluster;
  readonly namespace: servicediscovery.INamespace;

  constructor(scope: Construct, id: string, { network }: { network: Network }) {
    super(scope, id);

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: names.cluster,
      vpc: network.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
      defaultCloudMapNamespace: {
        name: config.ecs.namespace,
        type: servicediscovery.NamespaceType.DNS_PRIVATE,
        vpc: network.vpc,
        useForServiceConnect: true,
      },
    });
    this.namespace = this.cluster.defaultCloudMapNamespace!;
  }
}
