// The only shell in this package: the machine has no Node, so what runs ON it is a flat list of commands.
// They are built here (typed, in one place) and delivered two ways:
//   - hostSetupCommands  → EC2 user data, once, at first boot (lib/host.ts)
//   - hostDeployCommands → SSM Run Command on every release (scripts/host-deploy.ts)
import { config, names, SECRET_KEYS } from './config.ts';

const dir = names.hostDir;

/** First lines of the script SSM runs: stop at the first failing command. (User data sets its own.) */
export const HOST_SCRIPT_HEADER = ['#!/bin/bash', 'set -euo pipefail'];

/** First boot: docker + compose, ECR login helper, swap, RDS CA bundle. `registry`/`bucket` may be CDK tokens. */
export function hostSetupCommands(registry: string, bucket: string): string[] {
  const plugins = '/usr/local/lib/docker/cli-plugins';
  return [
    'set -euo pipefail',
    'dnf install -y docker amazon-ecr-credential-helper',
    `mkdir -p ${plugins} /root/.docker ${dir}`,
    `curl -fsSL https://github.com/docker/compose/releases/download/${config.host.composeVersion}/docker-compose-linux-aarch64 -o ${plugins}/docker-compose`,
    `chmod +x ${plugins}/docker-compose`,
    // pull from our ECR registry with the instance role, no `docker login`
    `echo '{"credHelpers":{"${registry}":"ecr-login"}}' > /root/.docker/config.json`,
    'systemctl enable --now docker',
    `fallocate -l ${config.host.swapGb}G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`,
    "echo '/swapfile none swap sw 0 0' >> /etc/fstab",
    // Node's trust store has no RDS CA; the containers get it through NODE_EXTRA_CA_CERTS
    `curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o ${dir}/rds-ca.pem`,
    // a REPLACED machine comes back by itself: if a bundle was ever uploaded, start the apps from it
    `if aws s3 ls s3://${bucket}/${names.hostBundlePrefix}compose.yml; then`,
    ...hostDeployCommands({ bucket, databases: [], migrate: [] }).map((c) => `  ${c}`),
    'fi',
  ];
}

export interface HostDeployOptions {
  /** Artifacts bucket holding the bundle (infra/aws/host/*). */
  bucket: string;
  /** Databases to create if missing (one per DB-backed app). */
  databases: string[];
  /** Apps whose `drizzle-kit migrate` runs before the containers are replaced. */
  migrate: string[];
}

/** .env = non-secret values rendered by the stack + the secrets, read here so they never travel through SSM. */
function hostEnvCommands(): string[] {
  return [
    'umask 077',
    `aws ssm get-parameter --name ${names.hostEnvParameter} --query Parameter.Value --output text > .env`,
    ...SECRET_KEYS.map(
      (key) =>
        `echo "${key}=$(aws secretsmanager get-secret-value --secret-id ${names.secret(key)} --query SecretString --output text)" >> .env`,
    ),
  ];
}

/**
 * New secret values, no release: rewrite .env, then `up -d` recreates exactly the containers whose environment
 * changed (for a DB password: the DB-backed apps). Images are not pulled, nothing is migrated.
 */
export function hostRefreshSecretsCommands(): string[] {
  return [
    `export HOME=/root AWS_DEFAULT_REGION=${config.region}`,
    `cd ${dir}`,
    ...hostEnvCommands(),
    'docker compose up -d --remove-orphans',
    'docker compose ps',
  ];
}

/** One release: fetch bundle → write .env → pull images → create databases → migrate → (re)start containers. */
export function hostDeployCommands({ bucket, databases, migrate }: HostDeployOptions): string[] {
  return [
    `export HOME=/root AWS_DEFAULT_REGION=${config.region}`,
    `cd ${dir}`,
    `aws s3 cp s3://${bucket}/${names.hostBundlePrefix} . --recursive --only-show-errors`,
    ...hostEnvCommands(),
    // keep what runs now as `:previous` so a failed release can go back (images are pulled under the floating tag)
    'previous=$(docker compose ps --format "{{.Image}}" | sort -u || true)',
    'for ref in $previous; do docker tag "$ref" "${ref%:*}:previous" || true; done',
    'docker compose pull --quiet',
    ...(databases.length
      ? [`docker compose run --rm -T -e DATABASES="${databases.join(' ')}" db-init`]
      : []),
    ...migrate.map((app) => `docker compose run --rm --no-deps -T ${app} npx drizzle-kit migrate`),
    // `--wait` blocks until every container with a healthcheck is healthy; otherwise restore the previous images.
    // Migrations are NOT undone: keep them backwards compatible (expand, then contract).
    'if ! docker compose up -d --wait --wait-timeout 180 --remove-orphans; then',
    '  echo "release unhealthy, rolling back to the previous images" >&2',
    '  docker compose ps',
    '  for ref in $previous; do docker tag "${ref%:*}:previous" "$ref" || true; done',
    '  docker compose up -d --remove-orphans',
    '  docker compose ps',
    '  exit 1',
    'fi',
    // compose does not notice an edited Caddyfile (bind mount): reload it, or restart if Caddy is still booting
    'docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || docker compose restart caddy',
    'docker image prune -f',
    'docker compose ps',
  ];
}
