import { Module } from '@nestjs/common';

import { CoreModule } from '@bf/server';

import { envSchema } from './env.schema';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
  imports: [
    // globalAuth=false: auth is enforced by EdgeAuthMiddleware on proxied routes instead of Nest guards.
    CoreModule.forRoot({ envSchema, globalAuth: false }),
    ProxyModule,
  ],
})
export class AppModule {}
