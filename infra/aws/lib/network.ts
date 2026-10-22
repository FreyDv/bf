import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import { config, names } from './config.ts';

/** Where Fargate tasks run: the public subnet of the one working AZ (the subnet in the other AZ stays empty). */
export const workSubnets: ec2.SubnetSelection = {
  subnetType: ec2.SubnetType.PUBLIC,
  availabilityZones: [config.workAz],
};

/**
 * VPC with two PUBLIC subnets (one per AZ: the ALB and the database subnet group need two) and nothing else:
 * no NAT gateway, no private subnets, no VPC endpoints. Only the subnet of `config.workAz` is ever used for tasks.
 * Every Fargate task gets a public IP for outbound traffic (ECR, logs, OpenAI…); who may talk to whom is decided
 * entirely by the security groups below. Nothing on the internet can open a connection to a task: the only
 * inbound rules are "CloudFront → ALB", "ALB → api" and "task → task".
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc;
  /** The load balancer: HTTPS from CloudFront's origin-facing addresses only. */
  readonly albSg: ec2.SecurityGroup;
  /** Every Fargate task: the api port from the ALB, everything from other tasks (Service Connect). */
  readonly tasksSg: ec2.SecurityGroup;
  /** The database: Postgres from the tasks only. */
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

    this.albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: names.albSecurityGroup,
      description: 'bf load balancer: HTTPS from CloudFront only',
    });
    this.albSg.addIngressRule(
      ec2.Peer.prefixList(config.cloudfront.originPrefixListId),
      ec2.Port.tcp(443),
      'https from CloudFront (origin-facing prefix list)',
    );

    this.tasksSg = new ec2.SecurityGroup(this, 'TasksSg', {
      vpc: this.vpc,
      securityGroupName: names.tasksSecurityGroup,
      description: 'bf fargate tasks: api from the ALB, everything from other tasks',
    });
    this.tasksSg.addIngressRule(this.albSg, ec2.Port.tcp(3000), 'api from the load balancer');
    this.tasksSg.addIngressRule(this.tasksSg, ec2.Port.allTcp(), 'service to service');

    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `${names.stack}-db`,
      // do not edit: a changed description replaces the group, and its fixed name makes the replacement fail
      description: 'bf database: postgres from the host',
      allowAllOutbound: false,
    });
    this.dbSg.addIngressRule(this.tasksSg, ec2.Port.tcp(5432), 'postgres from the tasks');

    this.dbDevSg = new ec2.SecurityGroup(this, 'DbDevSg', {
      vpc: this.vpc,
      securityGroupName: names.dbDevSecurityGroup,
      description: 'bf database: developer IPs, managed by scripts/db-allow-me.ts',
      allowAllOutbound: false,
    });
  }
}
