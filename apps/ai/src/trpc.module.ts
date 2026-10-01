import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';

import { TRPC_BASE_PATH, TrpcCoreModule, TrpcRequestContext } from '@bf/trpc';

import { HealthRouterModule } from './modules/health/health.module';

/**
 * Entry point for the nestjs-trpc CLI (`pnpm contracts:generate`): it needs a literal
 * `TRPCModule.forRoot({...})` and globs `**\/*.router.ts` relative to this file's directory.
 * Keep this file at `src/trpc.module.ts` in every service.
 */
@Module({
  imports: [
    TrpcCoreModule,
    TRPCModule.forRoot({ basePath: TRPC_BASE_PATH, context: TrpcRequestContext }),
    HealthRouterModule,
  ],
})
export class TrpcModule {}
