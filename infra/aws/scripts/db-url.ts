// Prints a ready-to-use connection string for the production database (password from Secrets Manager).
// Your IP must be allowed first: pnpm db:allow-me
// Usage: pnpm -s db:url [database=bf] [--pg | --jdbc] [--native]      e.g.  psql "$(pnpm -s db:url order --pg)"
//        --pg       postgresql://user:password@host:5432/db?sslmode=require   — psql, pg, drizzle-kit
//        --jdbc     jdbc:postgresql://host:5432/db?user=…&password=…&sslmode=require   — DataGrip / WebStorm / DBeaver
//        (neither)  in a terminal: both, labelled; captured by $(…) or a pipe: the --pg form, so old scripts keep working
//        --native   use the AWS endpoint instead of db.<domain> (needed for sslmode=verify-full)
// Both forms carry host, database, user and password; flags may come in any order.
import { DescribeDBClustersCommand, RDSClient } from '@aws-sdk/client-rds';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { main, sdk } from './_lib.ts';
import { config, names } from '../lib/config.ts';

main(async () => {
  const args = process.argv.slice(2);
  const database = args.find((arg) => !arg.startsWith('--')) ?? config.db.defaultDatabase;
  const { SecretString: password } = await new SecretsManagerClient(sdk).send(
    new GetSecretValueCommand({ SecretId: names.secret('POSTGRES_PASSWORD') }),
  );
  if (!password) throw new Error('database password secret is empty');

  let host: string = config.domains.db;
  if (args.includes('--native')) {
    const { DBClusters = [] } = await new RDSClient(sdk).send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: names.dbCluster }),
    );
    host = DBClusters[0]?.Endpoint ?? host;
  }
  const user = encodeURIComponent(config.db.user);
  const secret = encodeURIComponent(password);
  const pg = `postgresql://${user}:${secret}@${host}:5432/${database}?sslmode=require`;
  const jdbc = `jdbc:postgresql://${host}:5432/${database}?user=${user}&password=${secret}&sslmode=require`;
  if (args.includes('--jdbc')) console.log(jdbc);
  else if (args.includes('--pg') || !process.stdout.isTTY) console.log(pg);
  else
    console.log(`pg / drizzle-kit / psql:\n${pg}\n\nJDBC (DataGrip, WebStorm, DBeaver):\n${jdbc}`);
});
