/**
 * Path every service mounts tRPC on; the edge proxies `/<svc>/trpc/*` here.
 *
 * Each service declares `TRPCModule.forRoot({ basePath: TRPC_BASE_PATH, context: TrpcRequestContext })`
 * as a *literal* in `src/trpc.module.ts` — the nestjs-trpc CLI extracts options by parsing that
 * call, so it cannot live behind a helper function or a shared dynamic module.
 */
export const TRPC_BASE_PATH = '/trpc';
