import { generateKeyPairSync } from 'node:crypto';

import { createEnvValidator } from '@bf/server';

import { envSchema } from './env.schema';

const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const base = {
  JWT_PUBLIC_KEY: publicKey,
  UPSTREAMS: 'auth=http://auth:3001,order=http://order:3002',
};

describe('api env schema', () => {
  const validate = createEnvValidator(envSchema);

  it('defaults to ORCHESTRATOR=none with an empty graph', () => {
    const env = validate(base);
    expect(env.ORCHESTRATOR).toBe('none');
    expect(env.SERVICE_GRAPH).toEqual({});
    expect(env.ALWAYS_ON).toEqual([]);
    expect(env.DEFAULT_COOLDOWN_S).toBe(10_800);
    expect(env.UPSTREAMS).toEqual({ auth: 'http://auth:3001', order: 'http://order:3002' });
  });

  it('parses the graph and the per-service maps', () => {
    const env = validate({
      ...base,
      ORCHESTRATOR: 'ecs',
      ECS_CLUSTER: 'bf-prod',
      SERVICE_GRAPH: 'order=auth,admin=auth|order',
      SERVICE_COOLDOWNS: 'ai=600',
      SERVICE_MAX_TASKS: 'admin=2',
      ALWAYS_ON: 'auth',
    });
    expect(env.SERVICE_GRAPH).toEqual({ order: ['auth'], admin: ['auth', 'order'] });
    expect(env.SERVICE_COOLDOWNS).toEqual({ ai: '600' });
    expect(env.SERVICE_MAX_TASKS).toEqual({ admin: '2' });
    expect(env.ALWAYS_ON).toEqual(['auth']);
  });

  it('requires ECS_CLUSTER with ORCHESTRATOR=ecs and rejects a malformed graph', () => {
    expect(() => validate({ ...base, ORCHESTRATOR: 'ecs', ECS_CLUSTER: '' })).toThrow(
      /ECS_CLUSTER/,
    );
    expect(() => validate({ ...base, SERVICE_GRAPH: 'admin' })).toThrow(/SERVICE_GRAPH/);
  });
});
