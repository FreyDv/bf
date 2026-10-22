// What each app needs in production, derived from the repo (scripts/apps.mjs + .env.example) plus the few
// per-app overrides below. Pure functions: CDK (lib/services.ts), the scripts and the tests all use the same answer,
// so adding a service is still "add a folder under apps/".
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, names, SECRET_KEYS } from './config.ts';
import { discoverApps } from '../../../scripts/apps.mjs';

import type { SecretKey } from './config.ts';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** One entry of scripts/apps.mjs (plain JS, so its shape is declared here). */
export interface App {
  name: string;
  path: string;
  kind: 'nest' | 'next' | 'other';
  /** `ecs` = Fargate service, `static` = S3 + CloudFront, null = not deployed. */
  deploy: 'ecs' | 'static' | null;
  dockerfile: string | null;
  migrations: boolean;
  e2e: boolean;
  unit: boolean;
  seed: boolean;
  envSchema: boolean;
  port: number | null;
  /** Every KEY= of the app's .env.example. */
  envKeys: string[];
  /** Next `basePath` ('' when none). */
  basePath: string;
  /** Other apps this one calls (`<NAME>_URL` keys). */
  deps: string[];
}

/** Apps from scripts/apps.mjs (the single source of truth), optionally narrowed to the given names. */
export function discover(only: string[] = []): App[] {
  const cwd = process.cwd();
  process.chdir(repoRoot); // apps.mjs scans ./apps
  try {
    const all = discoverApps() as App[];
    const unknown = only.filter((name) => !all.some((a) => a.name === name));
    if (unknown.length) throw new Error(`unknown app(s): ${unknown.join(', ')}`);
    return only.length ? all.filter((a) => only.includes(a.name)) : all;
  } finally {
    process.chdir(cwd);
  }
}

export interface AppOverride {
  cpu?: number;
  memory?: number;
  /** Tasks kept while awake (always-on services); default 1. */
  minTasks?: number;
  maxTasks?: number;
  alwaysOn?: boolean;
  cooldownS?: number;
  /** Extra non-secret environment (values that are not derivable from the repo). */
  env?: Record<string, string>;
}

/** Per-app deviations from config.ecs. Everything else is derived. */
export const appOverrides: Partial<Record<string, AppOverride>> = {
  api: { env: { PUBLIC_PATHS: '/auth/api/auth/', ROUTE_ROLES: 'admin=admin' } },
  ai: { env: { OPENAI_MODEL: 'gpt-4o-mini' } },
};

export interface ServiceSpec {
  name: string;
  port: number;
  cpu: number;
  memory: number;
  minTasks: number;
  maxTasks: number;
  alwaysOn: boolean;
  cooldownS: number;
  migrations: boolean;
  /** Declares POSTGRES_DB → gets the DB block and its own database. */
  hasDb: boolean;
  deps: string[];
  /** Secrets Manager keys injected as env (SECRET_KEYS ∩ .env.example). */
  secrets: SecretKey[];
  /** Extra env from appOverrides. */
  env: Record<string, string>;
}

export function resolveService(app: App): ServiceSpec {
  if (app.deploy !== 'ecs') throw new Error(`${app.name} is not an ECS app`);
  if (!app.port) throw new Error(`${app.name}: PORT missing in .env.example`);
  const o = appOverrides[app.name] ?? {};
  const alwaysOn = o.alwaysOn ?? (config.ecs.alwaysOn as readonly string[]).includes(app.name);
  return {
    name: app.name,
    port: app.port,
    cpu: o.cpu ?? config.ecs.cpu,
    memory: o.memory ?? config.ecs.memory,
    minTasks: o.minTasks ?? 1,
    maxTasks: o.maxTasks ?? config.ecs.maxTasks,
    alwaysOn,
    cooldownS: o.cooldownS ?? config.ecs.cooldownS,
    migrations: app.migrations,
    hasDb: app.envKeys.includes('POSTGRES_DB'),
    deps: app.deps,
    secrets: SECRET_KEYS.filter((key) => app.envKeys.includes(key)),
    env: o.env ?? {},
  };
}

/** Every ECS service, from discovery. */
export function services(apps: App[] = discover()): ServiceSpec[] {
  return apps.filter((a) => a.deploy === 'ecs').map(resolveService);
}

/** How one service reaches another: Service Connect registers each app under its name. */
export const serviceUrl = (name: string, port: number) => `http://${name}:${port}`;

/** `admin=auth|order|course|billing|ai,billing=order,order=auth` — the wake graph for the orchestrator. */
export function serviceGraph(specs: ServiceSpec[]): string {
  return specs
    .filter((s) => s.deps.length)
    .map((s) => `${s.name}=${s.deps.join('|')}`)
    .join(',');
}

/** `name=value,…` for the services whose value differs from the default (empty string when none). */
const pairs = (entries: [string, number][]) => entries.map(([k, v]) => `${k}=${v}`).join(',');

export interface PlatformEnv {
  /** Aurora cluster writer endpoint. */
  dbHost: string;
  /** The app bucket (`order`). */
  appBucket: string;
  clusterName: string;
}

/**
 * The container environment of one service — the same values infra/aws/host/compose.yml used to carry, now
 * rendered from discovery. Secrets are NOT here (task definition `secrets:`), see ServiceSpec.secrets.
 */
export function renderEnv(
  spec: ServiceSpec,
  all: ServiceSpec[],
  platform: PlatformEnv,
): Record<string, string> {
  const isEdge = spec.name === 'api';
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    PORT: String(spec.port),
    SERVICE_NAME: spec.name,
    API_BASE_URL: isEdge ? config.publicUrls.api : serviceUrl(spec.name, spec.port),
    CORS_ORIGINS: config.publicUrls.main,
  };
  if (spec.hasDb) {
    Object.assign(env, {
      POSTGRES_HOST: platform.dbHost,
      POSTGRES_PORT: '5432',
      POSTGRES_USER: config.db.user,
      POSTGRES_DB: spec.name,
      POSTGRES_SSL: 'true',
      DB_POOL_MIN: '0',
      DB_CONNECT_TIMEOUT_MS: '30000',
      NODE_EXTRA_CA_CERTS: '/etc/ssl/rds-ca.pem',
    });
  }
  for (const dep of spec.deps) {
    const target = all.find((s) => s.name === dep);
    if (!target) throw new Error(`${spec.name} depends on unknown service ${dep}`);
    env[`${dep.toUpperCase()}_URL`] = serviceUrl(target.name, target.port);
  }
  if (spec.name === 'order') {
    env.S3_REGION = config.region;
    env.S3_BUCKET = platform.appBucket;
  }
  if (isEdge) {
    const others = all.filter((s) => s.name !== 'api');
    Object.assign(env, {
      UPSTREAMS: others.map((s) => `${s.name}=${serviceUrl(s.name, s.port)}`).join(','),
      TRUST_PROXY_HOPS: String(config.ecs.trustProxyHops),
      ORCHESTRATOR: 'ecs',
      ECS_CLUSTER: platform.clusterName,
      ECS_SERVICE_PREFIX: names.service(''),
      SERVICE_GRAPH: serviceGraph(others),
      ALWAYS_ON: others
        .filter((s) => s.alwaysOn)
        .map((s) => s.name)
        .join(','),
      DEFAULT_COOLDOWN_S: String(config.ecs.cooldownS),
      SERVICE_COOLDOWNS: pairs(
        others
          .filter((s) => s.cooldownS !== config.ecs.cooldownS)
          .map((s) => [s.name, s.cooldownS]),
      ),
      SERVICE_MAX_TASKS: pairs(
        others.filter((s) => s.maxTasks !== config.ecs.maxTasks).map((s) => [s.name, s.maxTasks]),
      ),
      WAKE_TIMEOUT_MS: String(config.ecs.wakeTimeoutMs),
      WAKE_FAIL_AFTER_MS: String(config.ecs.wakeFailAfterMs),
    });
  }
  Object.assign(env, spec.env);
  return env;
}
