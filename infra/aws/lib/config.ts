// Single source of truth for WHERE and WHAT we deploy. Imported by the CDK stacks (lib/*), the operational
// scripts (scripts/*) and the GitHub workflows (scripts/gh-env.ts). No AWS imports here on purpose.
//
// One environment ("prod"), one region. Region: us-east-1 (N. Virginia) has the cheapest AWS price list and
// is ~15-25 ms from the Niagara/Toronto audience.

const env = 'prod';
const region = 'us-east-1';

export const config = {
  env,
  region,
  /** Fixed AZs so `cdk synth` never has to look them up with AWS credentials. */
  azs: ['us-east-1a', 'us-east-1b'],
  vpcCidr: '10.42.0.0/16',

  /** GitHub repository allowed to assume the bf-gha-* roles (override: `scripts/bootstrap.ts <owner/repo>`). */
  githubRepo: 'FreyDv/bf',
  /** An account can hold only ONE GitHub OIDC provider. Set false if it already exists. */
  createOidcProvider: true,

  /** Route 53 public hosted zone the records are created in. */
  hostedZoneId: 'Z00065263KHH9FAOK8DE5',
  domains: {
    main: 'malinina.ca',
    api: 'api.malinina.ca',
    admin: 'admin.malinina.ca',
    db: 'db.malinina.ca',
  },

  host: {
    instanceType: 't4g.medium',
    /**
     * Amazon Linux 2023 arm64, pinned: changing it REPLACES the machine (new disk, Caddy re-issues certificates).
     * Latest id: aws ssm get-parameter --region us-east-1 --query Parameter.Value --output text \
     *   --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64
     */
    amiId: 'ami-065b1b834d2a83a7a',
    volumeGb: 30,
    swapGb: 2,
    composeVersion: 'v2.39.2',
  },

  db: {
    engineVersion: '17.9',
    user: 'bf',
    defaultDatabase: 'bf',
    /** 0 = the cluster pauses when idle and compute costs nothing. */
    minAcu: 0,
    maxAcu: 4,
    autoPauseSeconds: 600,
    backupDays: 7,
  },

  snapshotExportRetentionDays: 90,
  logRetentionDays: 30,
} as const;

/** Names derived from the config; the stacks create them, the scripts look them up. */
export const names = {
  stack: `bf-${env}`,
  githubStack: 'bf-github',
  secret: (key: SecretKey) => `bf/${env}/${key}`,
  hostEnvParameter: `/bf/${env}/host-env`,
  logGroup: `/bf/${env}/apps`,
  dbCluster: `bf-${env}`,
  dbDevSecurityGroup: `bf-${env}-db-dev`,
  hostRole: `bf-${env}-host`,
  hostTag: { key: 'bf:env', value: env },
  hostDir: '/opt/bf',
  hostBundlePrefix: `host/${env}/`,
  cfnExecPolicy: 'bf-cfn-exec',
  rdsExportRole: 'bf-rds-export',
  snapshotKeyAlias: 'alias/bf-db-snapshots',
  snapshotPrefix: `bf-${env}-pre-`,
  ecrRepository: (app: string) => `bf-${env}/${app}`,
  ecrRegistry: (account: string) => `${account}.dkr.ecr.${region}.amazonaws.com`,
  artifactsBucket: (account: string) => `bf-artifacts-${account}-${region}`,
  snapshotBucket: (account: string) => `bf-db-snapshots-${account}-${region}`,
  appBucket: (account: string) => `bf-${env}-${account}-api`,
};

/** Secrets Manager entries; each becomes a variable of the same name in the host's .env. */
export const SECRET_KEYS = [
  'POSTGRES_PASSWORD',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'OPENAI_API_KEY',
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

/** Value the stack puts into secrets it cannot generate; scripts/set-secrets.ts replaces it. */
export const SECRET_PLACEHOLDER = 'replace-me';
