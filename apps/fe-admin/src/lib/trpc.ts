import { createTRPCClient, httpBatchLink } from '@trpc/client';

import { env } from '@/config/env';

import { getToken, resetToken } from './auth-token';

import type { ApiRouter } from '@bf/contracts/api';

/** tRPC base path of the edge's own procedures (`apps/api/src/trpc.module.ts`). */
const SERVICES_TRPC_PATH = '/_services/trpc';

/**
 * Sends the bearer token with every batch; a 401 (expired or stale token) drops it and replays the batch once with
 * a fresh one. The token is attached here rather than through the link's `headers` so the replay can swap it.
 */
async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const send = async (token: string) =>
    fetch(input, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${token}` },
    });
  const first = await send(await getToken());
  if (first.status !== 401) return first;
  resetToken();
  return send(await getToken());
}

/** Typed client for `@bf/contracts/api`: `trpc.services.list.query()`, `trpc.services.wake.mutate({ name })`, … */
export const trpc = createTRPCClient<ApiRouter>({
  links: [
    httpBatchLink({
      url: `${env.NEXT_PUBLIC_API_URL}${SERVICES_TRPC_PATH}`,
      fetch: authedFetch,
    }),
  ],
});
