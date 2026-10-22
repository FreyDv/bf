import { NoopOrchestrator } from './orchestrator';
import { WakeMiddleware } from './wake.middleware';

import type { Orchestrator, WakeResult } from './orchestrator';

const res = () => {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => (headers[k] = v) };
};
const req = (originalUrl: string) => ({ originalUrl }) as never;

function fakeOrchestrator(over: Partial<Orchestrator> = {}): Orchestrator & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    enabled: true,
    has: (s) => ['order', 'auth'].includes(s),
    ensureAwake: (s): Promise<WakeResult> => {
      calls.push(`wake:${s}`);
      return Promise.resolve({ ready: true, waitedMs: 0, pending: [] });
    },
    isAsleep: () => Promise.resolve(false),
    recordActivity: (s) => calls.push(`activity:${s}`),
    invalidate: () => undefined,
    list: () => Promise.resolve([]),
    wake: () => Promise.resolve(),
    wakeAll: () => Promise.resolve(),
    sleep: () => Promise.resolve(),
    setCooldown: () => Promise.resolve(),
    setBounds: () => Promise.resolve(),
    redeploy: () => Promise.resolve(),
    sweep: () => Promise.resolve(),
    ...over,
  };
}

describe('WakeMiddleware', () => {
  it('is a pass-through when the orchestrator is off', async () => {
    const mw = new WakeMiddleware(new NoopOrchestrator());
    const next = jest.fn();
    await mw.use(req('/order/trpc/orders.list'), res() as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('wakes the target service and continues when ready', async () => {
    const orch = fakeOrchestrator();
    const next = jest.fn();
    await new WakeMiddleware(orch).use(req('/order/trpc/orders.list?x=1'), res() as never, next);
    expect(orch.calls).toEqual(['wake:order']);
    expect(next).toHaveBeenCalled();
  });

  it('ignores paths that are not an orchestrated service', async () => {
    const orch = fakeOrchestrator();
    const next = jest.fn();
    await new WakeMiddleware(orch).use(req('/health/live'), res() as never, next);
    expect(orch.calls).toEqual([]);
    expect(next).toHaveBeenCalled();
  });

  it('answers 503 + Retry-After with code SERVICE_STARTING when the hold times out', async () => {
    const orch = fakeOrchestrator({
      ensureAwake: () =>
        Promise.resolve({ ready: false, waitedMs: 50_000, pending: ['auth', 'order'] }),
    });
    const r = res();
    await expect(
      new WakeMiddleware(orch).use(req('/order/trpc/orders.list'), r as never, jest.fn()),
    ).rejects.toMatchObject({ status: 503, response: { code: 'SERVICE_STARTING' } });
    expect(r.headers['Retry-After']).toBe('10');
  });

  it('never wakes a service for a health probe: 503 SERVICE_ASLEEP while it sleeps, pass-through when awake', async () => {
    const asleep = fakeOrchestrator({ isAsleep: () => Promise.resolve(true) });
    const r = res();
    await expect(
      new WakeMiddleware(asleep).use(req('/order/health/live'), r as never, jest.fn()),
    ).rejects.toMatchObject({ status: 503, response: { code: 'SERVICE_ASLEEP' } });
    expect(asleep.calls).toEqual([]);
    expect(r.headers['Retry-After']).toBe('10');

    const up = fakeOrchestrator({ isAsleep: () => Promise.resolve(false) });
    const next = jest.fn();
    await new WakeMiddleware(up).use(req('/order/health/ready'), res() as never, next);
    expect(up.calls).toEqual([]);
    expect(next).toHaveBeenCalled();
  });
});
