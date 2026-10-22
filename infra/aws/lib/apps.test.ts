import assert from 'node:assert/strict';
import { test } from 'node:test';

import { discover, renderEnv, resolveService, serviceGraph, services } from './apps.ts';

const platform = { dbHost: 'db.example', appBucket: 'bucket', clusterName: 'bf-prod' };

void test('discovery: every nest app is an ECS service with a port, next apps are static', () => {
  const apps = discover();
  for (const app of apps) {
    if (app.kind === 'nest') {
      assert.equal(app.deploy, 'ecs');
      assert.ok(app.port, `${app.name} has a PORT`);
    }
    if (app.kind === 'next') assert.equal(app.deploy, 'static');
  }
  assert.equal(apps.find((a) => a.name === 'fe-admin')?.basePath, '/admin');
});

void test('resolveService: api is always on, order has a DB and S3, ai has neither DB nor migrations', () => {
  const specs = services();
  const api = specs.find((s) => s.name === 'api')!;
  const order = specs.find((s) => s.name === 'order')!;
  const ai = specs.find((s) => s.name === 'ai')!;
  assert.equal(api.alwaysOn, true);
  assert.equal(api.hasDb, false);
  assert.deepEqual(api.secrets, ['JWT_PUBLIC_KEY']);
  assert.equal(order.hasDb, true);
  assert.deepEqual(order.deps, ['auth']);
  assert.deepEqual(order.secrets, ['POSTGRES_PASSWORD', 'JWT_PUBLIC_KEY']);
  assert.equal(ai.hasDb, false);
  assert.equal(ai.migrations, false);
  assert.deepEqual(ai.secrets, ['JWT_PUBLIC_KEY', 'OPENAI_API_KEY']);
  assert.equal(specs.find((s) => s.name === 'auth')!.secrets.includes('JWT_PRIVATE_KEY'), true);
});

void test('serviceGraph lists only services with dependencies', () => {
  assert.equal(
    serviceGraph(services()),
    'admin=auth|order|course|billing|ai,billing=order,order=auth',
  );
});

void test('renderEnv: order gets the DB block, AUTH_URL and the bucket', () => {
  const specs = services();
  const env = renderEnv(
    specs.find((s) => s.name === 'order')!,
    specs,
    platform,
  );
  assert.equal(env.POSTGRES_DB, 'order');
  assert.equal(env.POSTGRES_HOST, 'db.example');
  assert.equal(env.POSTGRES_SSL, 'true');
  assert.equal(env.DB_POOL_MIN, '0');
  assert.equal(env.NODE_EXTRA_CA_CERTS, '/etc/ssl/rds-ca.pem');
  assert.equal(env.AUTH_URL, 'http://auth:3001');
  assert.equal(env.S3_BUCKET, 'bucket');
  assert.equal(env.API_BASE_URL, 'http://order:3002');
  assert.equal('POSTGRES_PASSWORD' in env, false);
});

void test('renderEnv: api gets the route table and the orchestrator settings', () => {
  const specs = services();
  const env = renderEnv(
    specs.find((s) => s.name === 'api')!,
    specs,
    platform,
  );
  assert.equal(
    env.UPSTREAMS,
    'admin=http://admin:3005,ai=http://ai:3006,auth=http://auth:3001,billing=http://billing:3004,course=http://course:3003,order=http://order:3002',
  );
  assert.equal(env.ORCHESTRATOR, 'ecs');
  assert.equal(env.ECS_CLUSTER, 'bf-prod');
  assert.equal(env.ECS_SERVICE_PREFIX, 'bf-prod-');
  assert.equal(env.SERVICE_GRAPH, 'admin=auth|order|course|billing|ai,billing=order,order=auth');
  assert.equal(env.ALWAYS_ON, '');
  assert.equal(env.ROUTE_ROLES, 'admin=admin');
  assert.equal(env.TRUST_PROXY_HOPS, '2');
  assert.equal(env.API_BASE_URL, 'https://malinina.ca/api');
  assert.equal('POSTGRES_DB' in env, false);
});

void test('resolveService rejects non-ECS apps', () => {
  const fe = discover().find((a) => a.name === 'fe-main')!;
  assert.throws(() => resolveService(fe), /not an ECS app/);
});
