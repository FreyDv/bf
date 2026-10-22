import { TRPCError } from '@trpc/server';

import { NoopOrchestrator } from './orchestrator';
import { ServicesRouter } from './services.router';

describe('ServicesRouter', () => {
  it('rejects an unknown service with NOT_FOUND before touching the orchestrator', async () => {
    const orchestrator = new NoopOrchestrator();
    const wake = jest.spyOn(orchestrator, 'wake');
    const router = new ServicesRouter(orchestrator);
    await expect(router.wake({ name: 'nope' })).rejects.toMatchObject(
      new TRPCError({ code: 'NOT_FOUND', message: 'unknown service nope' }),
    );
    expect(wake).not.toHaveBeenCalled();
  });

  it('wakeAll and list delegate to the orchestrator', async () => {
    const orchestrator = new NoopOrchestrator();
    const wakeAll = jest.spyOn(orchestrator, 'wakeAll');
    const router = new ServicesRouter(orchestrator);
    await expect(router.wakeAll()).resolves.toMatchObject({ action: 'wake-all' });
    expect(wakeAll).toHaveBeenCalledTimes(1);
    await expect(router.list()).resolves.toEqual([]);
  });
});
