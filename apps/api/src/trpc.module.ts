import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';

import { TrpcCoreModule } from '@bf/trpc';

import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { EdgeTrpcContext } from './proxy/edge-trpc.context';

/** Where the edge's own procedures live; `_services` can never be an upstream name, so the proxy never sees it. */
export const SERVICES_TRPC_PATH = '/_services/trpc';

/**
 * The edge's own tRPC surface (`@bf/contracts/api`): orchestrator state and knobs, database status. Entry point
 * for the nestjs-trpc CLI (`pnpm --filter api contracts:generate`): it needs a literal `TRPCModule.forRoot({...})`
 * and globs `**\/*.router.ts` relative to this file's directory. The bearer JWT is verified by EdgeTrpcContext
 * (not by EdgeAuthMiddleware: nestjs-trpc mounts before route middleware); every router requires the admin role.
 */
@Module({
  imports: [
    TrpcCoreModule,
    TRPCModule.forRoot({ basePath: '/_services/trpc', context: EdgeTrpcContext }),
    OrchestratorModule,
  ],
  providers: [EdgeTrpcContext],
})
export class TrpcModule {}
