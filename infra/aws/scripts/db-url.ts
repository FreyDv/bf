// Prints a ready-to-use connection string for the production database (password from Secrets Manager).
// Your IP must be allowed first: pnpm db:allow-me
// Usage: pnpm -s db:url [database=bf]        e.g.  psql "$(pnpm -s db:url order)"
//        --native   use the AWS endpoint instead of db.<domain> (needed for sslmode=verify-full)
import { DescribeDBClustersCommand, RDSClient } from '@aws-sdk/client-rds';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { main, positionals, sdk } from './_lib.ts';
import { config, names } from '../lib/config.ts';

main(async () => {
  const database = positionals()[0] ?? config.db.defaultDatabase;
  const { SecretString: password } = await new SecretsManagerClient(sdk).send(
    new GetSecretValueCommand({ SecretId: names.secret('POSTGRES_PASSWORD') }),
  );
  if (!password) throw new Error('database password secret is empty');

  let host: string = config.domains.db;
  if (process.argv.includes('--native')) {
    const { DBClusters = [] } = await new RDSClient(sdk).send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: names.dbCluster }),
    );
    host = DBClusters[0]?.Endpoint ?? host;
  }
  const user = encodeURIComponent(config.db.user);
  console.log(
    `postgresql://${user}:${encodeURIComponent(password)}@${host}:5432/${database}?sslmode=require`,
  );
});
