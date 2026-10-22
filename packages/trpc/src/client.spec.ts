import { createServiceClient } from './client';

import type { AnyRouter } from '@trpc/server';

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/** A fetch that answers the given replies in order (the last one repeats). */
function fakeFetch(replies: Reply[]) {
  const calls: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    const body = reply.body ?? [{ result: { data: 'pong' } }];
    return new Response(JSON.stringify(body), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...reply.headers },
    });
  };
  return { calls, fetch };
}

const ping = (client: ReturnType<typeof createServiceClient<AnyRouter>>) =>
  (
    client as unknown as { health: { ping: { query: () => Promise<unknown> } } }
  ).health.ping.query();

describe('createServiceClient retry', () => {
  it('retries 503 (service starting) and succeeds', async () => {
    const f = fakeFetch([
      {
        status: 503,
        body: { status: 503, code: 'SERVICE_STARTING' },
        headers: { 'retry-after': '1' },
      },
      { status: 503, body: { status: 503, code: 'SERVICE_STARTING' } },
      { status: 200 },
    ]);
    const client = createServiceClient<AnyRouter>('http://order:3002', undefined, {
      fetch: f.fetch,
      retry: { attempts: 3, delaysMs: [1, 1, 1] },
    });
    await expect(ping(client)).resolves.toBe('pong');
    expect(f.calls).toHaveLength(3);
  });

  it('does not retry other HTTP errors', async () => {
    const f = fakeFetch([
      {
        status: 500,
        body: [
          {
            error: {
              message: 'boom',
              code: -32603,
              data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
            },
          },
        ],
      },
    ]);
    const client = createServiceClient<AnyRouter>('http://order:3002', undefined, {
      fetch: f.fetch,
      retry: { attempts: 3, delaysMs: [1] },
    });
    await expect(ping(client)).rejects.toMatchObject({ message: 'boom' });
    expect(f.calls).toHaveLength(1);
  });

  it('gives up after the configured attempts', async () => {
    const f = fakeFetch([{ status: 503, body: { status: 503 } }]);
    const client = createServiceClient<AnyRouter>('http://order:3002', undefined, {
      fetch: f.fetch,
      retry: { attempts: 2, delaysMs: [1] },
    });
    await expect(ping(client)).rejects.toBeDefined();
    expect(f.calls).toHaveLength(3);
  });

  it('retry: false keeps a single attempt', async () => {
    const f = fakeFetch([{ status: 503, body: { status: 503 } }]);
    const client = createServiceClient<AnyRouter>('http://order:3002', undefined, {
      fetch: f.fetch,
      retry: false,
    });
    await expect(ping(client)).rejects.toBeDefined();
    expect(f.calls).toHaveLength(1);
  });
});
