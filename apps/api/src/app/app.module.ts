import { Module } from '@nestjs/common';

import { CoreModule } from '@bf/server';

import { envSchema } from './env.schema';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ProxyModule } from '../proxy/proxy.module';
import { TrpcModule } from '../trpc.module';

@Module({
  imports: [
    // globalAuth=false: auth is enforced by EdgeAuthMiddleware (proxied routes and /_services/trpc) instead of guards.
    CoreModule.forRoot({ envSchema, globalAuth: false }),
    // before ProxyModule: it provides the WakeMiddleware the proxy chain uses
    OrchestratorModule,
    TrpcModule,
    ProxyModule,
  ],
})
export class AppModule {}
