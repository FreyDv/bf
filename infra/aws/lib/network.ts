import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import { config, names } from './config.ts';

/**
 * VPC with two PUBLIC subnets and nothing else: no NAT gateway, no private subnets, no load balancer.
 * "Private" is enforced by security groups — only the host's 80/443 are reachable from the internet.
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc;
  /** The machine: HTTP/HTTPS from anywhere, everything else closed. */
  readonly hostSg: ec2.SecurityGroup;
  /** The database: Postgres from the machine only. */
  readonly dbSg: ec2.SecurityGroup;
  /**
   * The database, developer access: deliberately EMPTY here. `pnpm db:allow-me` puts your current IP in it,
   * and because the stack declares no rules for this group a deploy never wipes them.
   */
  readonly dbDevSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: names.stack,
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      availabilityZones: [...config.azs],
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
      restrictDefaultSecurityGroup: false,
    });

    this.hostSg = new ec2.SecurityGroup(this, 'HostSg', {
      vpc: this.vpc,
      securityGroupName: `${names.stack}-host`,
      description: 'bf host: public HTTP/HTTPS only',
    });
    this.hostSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'http (redirect + ACME)');
    this.hostSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'https');
    this.hostSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(443), 'http/3');

    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `${names.stack}-db`,
      description: 'bf database: postgres from the host',
      allowAllOutbound: false,
    });
    this.dbSg.addIngressRule(this.hostSg, ec2.Port.tcp(5432), 'postgres from the host');

    this.dbDevSg = new ec2.SecurityGroup(this, 'DbDevSg', {
      vpc: this.vpc,
      securityGroupName: names.dbDevSecurityGroup,
      description: 'bf database: developer IPs, managed by scripts/db-allow-me.ts',
      allowAllOutbound: false,
    });
  }
}
