import { Global, Module } from '@nestjs/common';

import { TrpcRequestContext } from './context';
import { AdminMiddleware, AuthedMiddleware } from './middlewares';

/**
 * Registers the context factory and shared middlewares so nestjs-trpc can resolve them from the
 * module ref. Import once next to `TRPCModule.forRoot(...)` in each service's `src/trpc.module.ts`.
 */
@Global()
@Module({
  providers: [TrpcRequestContext, AuthedMiddleware, AdminMiddleware],
  exports: [TrpcRequestContext, AuthedMiddleware, AdminMiddleware],
})
export class TrpcCoreModule {}
