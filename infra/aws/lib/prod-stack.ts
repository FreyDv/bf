import { Aws, CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { discover } from './apps.ts';
import { Cluster } from './cluster.ts';
import { config, names } from './config.ts';
import { Data } from './data.ts';
import { Ingress } from './ingress.ts';
import { Network, workSubnets } from './network.ts';
import { Secrets } from './secrets.ts';

import type { StackProps } from 'aws-cdk-lib';

/**
 * The platform (`bf-prod`): network → secrets → database + bucket → ECS cluster → public entry (ALB, CloudFront,
 * static buckets, certificate, DNS). The services themselves live in bf-prod-apps (lib/apps-stack.ts) so that
 * they are created only once images and secrets exist.
 */
export class ProdStack extends Stack {
  readonly network: Network;
  readonly secrets: Secrets;
  readonly data: Data;
  readonly cluster: Cluster;
  readonly ingress: Ingress;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.network = new Network(this, 'Network');
    this.secrets = new Secrets(this, 'Secrets');
    this.data = new Data(this, 'Data', {
      network: this.network,
      dbPassword: this.secrets.dbPassword,
    });
    this.cluster = new Cluster(this, 'Cluster', { network: this.network });
    // 'Host' is the construct path the EC2-era DNS records lived under; kept so they are updated, not recreated
    const recordScope = new Construct(this, 'Host');
    this.ingress = new Ingress(this, 'Ingress', {
      network: this.network,
      staticApps: discover().filter((a) => a.deploy === 'static'),
      recordScope,
    });
    this.ingress.publishParameters({
      // the subnet(s) of the working AZ only: the one-off migration tasks (scripts/_ecs.ts) run there too
      publicSubnetIds: this.network.vpc.selectSubnets(workSubnets).subnetIds.join(','),
      tasksSecurityGroupId: this.network.tasksSg.securityGroupId,
      distributionId: this.ingress.distribution.distributionId,
      apiTargetGroupArn: this.ingress.apiTargetGroup.targetGroupArn,
      clusterName: this.cluster.cluster.clusterName,
      dbEndpoint: this.data.cluster.clusterEndpoint.hostname,
    });

    const output = (key: string, value: string, description?: string) =>
      new CfnOutput(this, key, { value, description });
    output('MainUrl', config.publicUrls.main);
    output('AdminUrl', config.publicUrls.admin);
    output('ApiUrl', config.publicUrls.api, 'NEXT_PUBLIC_API_URL of the frontends');
    output('DistributionId', this.ingress.distribution.distributionId);
    output('AlbDns', this.ingress.alb.loadBalancerDnsName, 'Answers CloudFront only');
    output('DbEndpoint', this.data.cluster.clusterEndpoint.hostname, `Also ${config.domains.db}`);
    output('DbDevSecurityGroupId', this.network.dbDevSg.securityGroupId, 'pnpm db:allow-me');
    output('BucketName', this.data.bucket.bucketName);
    output('EcrPrefix', `${names.ecrRegistry(Aws.ACCOUNT_ID)}/bf-${config.env}`);
  }

  /** Fixed AZs (lib/config.ts) instead of an account lookup, so synth works without AWS credentials. */
  override get availabilityZones(): string[] {
    return [...config.azs];
  }
}
