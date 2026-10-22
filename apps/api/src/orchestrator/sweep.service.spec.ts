import { NoopOrchestrator } from './orchestrator';
import { SWEEP_INTERVAL_MS, SweepService } from './sweep.service';

import type { Orchestrator } from './orchestrator';

describe('SweepService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does nothing when the orchestrator is off', () => {
    const svc = new SweepService(new NoopOrchestrator());
    svc.onModuleInit();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('sweeps after a jitter and then every minute, swallowing errors', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 15 s jitter
    const sweep = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const orch = { enabled: true, sweep } as unknown as Orchestrator;
    const svc = new SweepService(orch);
    svc.onModuleInit();
    await jest.advanceTimersByTimeAsync(14_999);
    expect(sweep).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(sweep).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(2); // the rejected one was logged, not thrown
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(3);
    svc.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 2);
    expect(sweep).toHaveBeenCalledTimes(3);
  });

  it('skips a run while the previous one is still going', async () => {
    let release!: () => void;
    const first = new Promise<void>((r) => (release = r));
    const sweep = jest.fn().mockReturnValueOnce(first).mockResolvedValue(undefined);
    const svc = new SweepService({ enabled: true, sweep } as unknown as Orchestrator);
    const running = svc.run();
    void svc.run();
    expect(sweep).toHaveBeenCalledTimes(1);
    release();
    await running;
    await svc.run();
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});
