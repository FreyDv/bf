import { Module } from '@nestjs/common';

import { CoreModule } from '@bf/server';

import { envSchema } from './env.schema';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
  imports: [
    // globalAuth=false: auth is enforced by EdgeAuthMiddleware on proxied routes instead of Nest guards.
    CoreModule.forRoot({ envSchema, globalAuth: false }),
    // before ProxyModule: it provides the WakeMiddleware the proxy chain uses
    OrchestratorModule,
    ProxyModule,
  ],
})
export class AppModule {}
