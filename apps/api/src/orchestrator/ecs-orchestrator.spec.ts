import { FakeEcsApi } from './ecs-api.fake';
import { EcsOrchestrator, TAGS } from './orchestrator';
import { parseGraph } from './service-graph';
import { ServiceStateCache } from './state-cache';

import type { OrchestratorOptions } from './orchestrator';

const NAMES = ['auth', 'order', 'course', 'billing', 'admin', 'ai'];
const PORTS = Object.fromEntries(NAMES.map((n, i) => [n, 3001 + i]));

function setup(overrides: Partial<OrchestratorOptions> = {}, startNow = 1_000_000_000_000) {
  let now = startNow;
  const clock = { now: () => now, tick: (ms: number) => (now += ms) };
  const api = new FakeEcsApi(NAMES, Math.floor(now / 1000));
  const cache = new ServiceStateCache(api, clock.now);
  const probeOk = new Set<string>(NAMES);
  const probe = jest.fn((url: string) => Promise.resolve(probeOk.has(new URL(url).hostname)));
  const logs: string[] = [];
  const logger = {
    log: (m: string) => logs.push(m),
    warn: (m: string) => logs.push(m),
    error: (m: string) => logs.push(m),
  };
  const sleeps: number[] = [];
  const sleep = (ms: number) => {
    sleeps.push(ms);
    clock.tick(ms);
    return Promise.resolve();
  };
  const orch = new EcsOrchestrator(
    api,
    cache,
    {
      graph: parseGraph('admin=auth|order|course|billing|ai,billing=order,order=auth'),
      ports: PORTS,
      alwaysOn: [],
      defaultCooldownS: 3600,
      cooldowns: { ai: 600 },
      maxTasks: { admin: 2 },
      defaultMaxTasks: 4,
      wakeTimeoutMs: 50_000,
      failAfterMs: 180_000,
      ...overrides,
    },
    probe,
    logger,
    clock.now,
    sleep,
  );
  const flush = () => new Promise((r) => setImmediate(r));
  return { api, cache, orch, clock, probe, probeOk, logs, sleeps, flush };
}

const awake = (api: FakeEcsApi, name: string, nowS: number) =>
  api.advance(name, {
    desiredCount: 1,
    runningCount: 1,
    min: 1,
    max: 4,
    deploymentUpdatedAt: nowS,
    tags: { [TAGS.lastActivity]: String(nowS) },
  });

describe('EcsOrchestrator — wake', () => {
  it('sets the scalable target bounds before desiredCount and holds until running + probe ok', async () => {
    const { api, orch, flush } = setup();
    // the fake comes up on the first poll
    const origDescribe = api.describeServices.bind(api);
    let polls = 0;
    api.describeServices = (names) => {
      polls++;
      if (polls === 2) api.advance('course', { runningCount: 1 });
      return origDescribe(names);
    };
    const result = await orch.ensureAwake('course');
    await flush();
    expect(result.ready).toBe(true);
    const ops = api.calls.filter(
      (c) => c.name === 'course' && ['bounds', 'desired'].includes(c.op),
    );
    expect(ops.map((c) => c.op)).toEqual(['bounds', 'desired']);
    expect(ops[0]!.args).toEqual({ min: 1, max: 4 });
    expect(api.get('course').desiredCount).toBe(1);
  });

  it('wakes the whole closure: admin wakes its five dependencies, respecting per-service max', async () => {
    const { api, orch } = setup();
    for (const n of NAMES) api.advance(n, {}); // all asleep
    const origDescribe = api.describeServices.bind(api);
    api.describeServices = (names) => {
      for (const n of names) if (api.get(n).desiredCount >= 1) api.advance(n, { runningCount: 1 });
      return origDescribe(names);
    };
    const result = await orch.ensureAwake('admin');
    expect(result.ready).toBe(true);
    expect(api.count('desired')).toBe(6);
    expect(api.calls.find((c) => c.op === 'bounds' && c.name === 'admin')!.args).toEqual({
      min: 1,
      max: 2,
    });
    expect(api.calls.find((c) => c.op === 'bounds' && c.name === 'auth')!.args).toEqual({
      min: 1,
      max: 4,
    });
  });

  it('returns not-ready after the hold timeout and reports the pending services', async () => {
    const { api, orch, clock } = setup();
    const result = await orch.ensureAwake('course');
    expect(result.ready).toBe(false);
    expect(result.pending).toEqual(['course']);
    expect(result.waitedMs).toBeGreaterThanOrEqual(50_000);
    expect(api.get('course').desiredCount).toBe(1); // still starting, not given up
    void clock;
  });

  it('is a fast no-op for a service that already runs (no probe, no writes)', async () => {
    const { api, orch, probe, clock } = setup();
    awake(api, 'course', Math.floor(clock.now() / 1000));
    const result = await orch.ensureAwake('course');
    expect(result).toEqual({ ready: true, waitedMs: 0, pending: [] });
    expect(probe).not.toHaveBeenCalled();
    expect(api.count('desired')).toBe(0);
  });

  it('dedupes concurrent wakes of the same service into one UpdateService', async () => {
    const { api, orch } = setup();
    const origDescribe = api.describeServices.bind(api);
    api.describeServices = (names) => {
      for (const n of names) if (api.get(n).desiredCount >= 1) api.advance(n, { runningCount: 1 });
      return origDescribe(names);
    };
    const results = await Promise.all([
      orch.ensureAwake('course'),
      orch.ensureAwake('course'),
      orch.ensureAwake('course'),
    ]);
    expect(results.every((r) => r.ready)).toBe(true);
    expect(api.count('desired', 'course')).toBe(1);
    expect(api.count('bounds', 'course')).toBe(1);
  });

  it('records activity at most once per 30 s per service', async () => {
    const { api, orch, clock, flush } = setup();
    awake(api, 'course', 0);
    await orch.ensureAwake('course');
    await flush();
    clock.tick(10_000);
    await orch.ensureAwake('course');
    await flush();
    expect(api.count('tag', 'course')).toBe(1);
    clock.tick(25_000);
    await orch.ensureAwake('course');
    await flush();
    expect(api.count('tag', 'course')).toBe(2);
    expect(api.get('course').tags[TAGS.lastActivity]).toBe(String(Math.floor(clock.now() / 1000)));
  });

  it('gives up on a service that never starts (failure rule) and logs wake_failed', async () => {
    const { api, orch, clock, logs } = setup();
    // another task asked for it 4 minutes ago; still nothing running
    api.advance('course', {
      desiredCount: 1,
      runningCount: 0,
      deploymentUpdatedAt: Math.floor(clock.now() / 1000) - 240,
    });
    const result = await orch.ensureAwake('course');
    expect(result.ready).toBe(false);
    expect(api.get('course').desiredCount).toBe(0);
    expect(api.calls.find((c) => c.op === 'bounds' && c.name === 'course')!.args).toEqual({
      min: 0,
      max: 0,
    });
    expect(logs.some((l) => l.includes('wake_failed'))).toBe(true);
  });

  it('isAsleep reflects desiredCount', async () => {
    const { api, orch, cache } = setup();
    expect(await orch.isAsleep('course')).toBe(true);
    awake(api, 'course', 0);
    cache.invalidate('course');
    expect(await orch.isAsleep('course')).toBe(false);
    expect(await orch.isAsleep('nope')).toBe(false);
  });
});

describe('EcsOrchestrator — sweep', () => {
  it('puts an idle service to sleep only when no awake dependent needs it', async () => {
    const { api, orch, clock } = setup();
    const nowS = Math.floor(clock.now() / 1000);
    awake(api, 'auth', nowS - 7200); // idle for 2 h (> 1 h cooldown)
    awake(api, 'order', nowS - 10); // active, depends on auth
    await orch.sweep();
    expect(api.get('auth').desiredCount).toBe(1); // kept: order is awake
    expect(api.get('order').desiredCount).toBe(1);

    api.advance('order', { tags: { [TAGS.lastActivity]: String(nowS - 7200) } });
    orch.invalidate();
    await orch.sweep();
    // order idles → sleeps; auth now has no awake dependent → sleeps too (same pass or the next one)
    orch.invalidate();
    await orch.sweep();
    expect(api.get('order').desiredCount).toBe(0);
    expect(api.get('auth').desiredCount).toBe(0);
    expect(
      api.calls.filter((c) => c.op === 'bounds' && c.args && (c.args as { min: number }).min === 0)
        .length,
    ).toBe(2);
  });

  it('never sleeps an always-on service and re-raises its minimum', async () => {
    const { api, orch, clock } = setup({ alwaysOn: ['auth'] });
    const nowS = Math.floor(clock.now() / 1000);
    awake(api, 'auth', nowS - 100_000);
    api.advance('auth', { min: 0 });
    await orch.sweep();
    expect(api.get('auth').desiredCount).toBe(1);
    expect(api.get('auth').min).toBe(1);
  });

  it('honours the bf:cooldown tag over the configured cooldown', async () => {
    const { api, orch, clock } = setup();
    const nowS = Math.floor(clock.now() / 1000);
    awake(api, 'course', nowS - 1800); // idle 30 min, default cooldown 1 h
    api.advance('course', {
      tags: { [TAGS.lastActivity]: String(nowS - 1800), [TAGS.cooldown]: '600' },
    });
    await orch.sweep();
    expect(api.get('course').desiredCount).toBe(0);
  });

  it('uses the per-service cooldown from config', async () => {
    const { api, orch, clock } = setup();
    const nowS = Math.floor(clock.now() / 1000);
    awake(api, 'ai', nowS - 900); // ai cooldown 600
    awake(api, 'course', nowS - 900); // default 3600
    await orch.sweep();
    expect(api.get('ai').desiredCount).toBe(0);
    expect(api.get('course').desiredCount).toBe(1);
  });

  it('applies the failure rule (3 min / rollout FAILED) during the sweep', async () => {
    const { api, orch, clock, logs } = setup();
    const nowS = Math.floor(clock.now() / 1000);
    api.advance('course', { desiredCount: 1, runningCount: 0, deploymentUpdatedAt: nowS - 60 });
    api.advance('billing', {
      desiredCount: 1,
      runningCount: 0,
      deploymentUpdatedAt: nowS - 60,
      rolloutState: 'FAILED',
    });
    api.advance('ai', { desiredCount: 1, runningCount: 0, deploymentUpdatedAt: nowS - 400 });
    await orch.sweep();
    expect(api.get('course').desiredCount).toBe(1); // still within 3 min
    expect(api.get('billing').desiredCount).toBe(0);
    expect(api.get('ai').desiredCount).toBe(0);
    expect(logs.filter((l) => l.includes('wake_failed')).length).toBe(2);
  });

  it('reconciles bounds: an awake service with min 0 gets min 1 back', async () => {
    const { api, orch, clock } = setup();
    awake(api, 'course', Math.floor(clock.now() / 1000));
    api.advance('course', { min: 0 });
    await orch.sweep();
    expect(api.get('course').min).toBe(1);
    expect(api.get('course').desiredCount).toBe(1);
  });
});

describe('EcsOrchestrator — admin surface', () => {
  it('lists every service with its status', async () => {
    const { api, orch, clock } = setup();
    const nowS = Math.floor(clock.now() / 1000);
    awake(api, 'auth', nowS);
    api.advance('order', { desiredCount: 1, runningCount: 0, deploymentUpdatedAt: nowS });
    const list = await orch.list();
    const by = Object.fromEntries(list.map((v) => [v.name, v]));
    expect(by.auth!.status).toBe('awake');
    expect(by.order!.status).toBe('starting');
    expect(by.course!.status).toBe('asleep');
    expect(by.ai!.cooldownS).toBe(600);
    expect(by.auth!.bounds).toEqual({ min: 1, max: 4 });
  });

  it('wake / sleep / cooldown / bounds / redeploy map to the ECS calls', async () => {
    const { api, orch } = setup();
    await orch.wake('billing'); // closure auth, order, billing
    expect(api.count('desired')).toBe(3);
    await orch.sleep('billing');
    expect(api.get('billing').desiredCount).toBe(0);
    await orch.setCooldown('order', 1200);
    expect(api.get('order').tags[TAGS.cooldown]).toBe('1200');
    await orch.setBounds('order', 2, 3);
    expect(api.get('order')).toMatchObject({ min: 2, max: 3 });
    await orch.redeploy('order');
    expect(api.count('redeploy', 'order')).toBe(1);
    await expect(orch.wake('nope')).rejects.toThrow(/unknown service/);
  });
});
