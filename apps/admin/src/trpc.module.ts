import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';

import { TRPC_BASE_PATH, TrpcClientModule, TrpcCoreModule, TrpcRequestContext } from '@bf/trpc';

import { HealthRouterModule } from './modules/health/health.module';

import type { AiRouter } from '@bf/contracts/ai';
import type { AuthRouter } from '@bf/contracts/auth';
import type { BillingRouter } from '@bf/contracts/billing';
import type { CourseRouter } from '@bf/contracts/course';
import type { OrderRouter } from '@bf/contracts/order';

/**
 * Entry point for the nestjs-trpc CLI (`pnpm contracts:generate`): it needs a literal
 * `TRPCModule.forRoot({...})` and globs `**\/*.router.ts` relative to this file's directory.
 * Keep this file at `src/trpc.module.ts` in every service.
 */
@Module({
  imports: [
    TrpcCoreModule,
    TRPCModule.forRoot({ basePath: TRPC_BASE_PATH, context: TrpcRequestContext }),
    TrpcClientModule.register<AuthRouter>({ name: 'auth' }),
    TrpcClientModule.register<OrderRouter>({ name: 'order' }),
    TrpcClientModule.register<CourseRouter>({ name: 'course' }),
    TrpcClientModule.register<BillingRouter>({ name: 'billing' }),
    TrpcClientModule.register<AiRouter>({ name: 'ai' }),
    HealthRouterModule,
  ],
  exports: [TrpcClientModule],
})
export class TrpcModule {}
