import { Aws, CfnOutput, Stack } from 'aws-cdk-lib';

import { config, names } from './config.ts';
import { Data } from './data.ts';
import { Host } from './host.ts';
import { Network } from './network.ts';
import { Secrets } from './secrets.ts';

import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

/** Everything the platform runs on: network → secrets → database + bucket → the machine + DNS. */
export class ProdStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'Network');
    const secrets = new Secrets(this, 'Secrets');
    const data = new Data(this, 'Data', { network, dbPassword: secrets.dbPassword });
    const host = new Host(this, 'Host', { network, secrets, data });

    const output = (key: string, value: string, description?: string) =>
      new CfnOutput(this, key, { value, description });
    output('MainUrl', `https://${config.domains.main}`);
    output('ApiUrl', `https://${config.domains.api}`, 'Use as NEXT_PUBLIC_API_URL');
    output('AdminUrl', `https://${config.domains.admin}`);
    output('PublicIp', host.publicIp);
    output('HostInstanceId', host.instance.instanceId, 'aws ssm start-session --target <id>');
    output('DbEndpoint', data.cluster.clusterEndpoint.hostname, `Also ${config.domains.db}`);
    output('DbDevSecurityGroupId', network.dbDevSg.securityGroupId, 'pnpm db:allow-me');
    output('BucketName', data.bucket.bucketName);
    output('EcrPrefix', `${names.ecrRegistry(Aws.ACCOUNT_ID)}/bf-${config.env}`);
  }

  /** Fixed AZs (lib/config.ts) instead of an account lookup, so synth works without AWS credentials. */
  override get availabilityZones(): string[] {
    return [...config.azs];
  }
}
