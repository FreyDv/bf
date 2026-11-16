import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';
import { API_PREFIX } from './configure-app.js';
import { LoggingModule } from './logging/logging.module.js';

@Module({
  // nestjs-trpc mounts with `app.use(basePath)` and ignores the global prefix, so the prefix is repeated here (ADR-038).
  imports: [LoggingModule, TRPCModule.forRoot({ basePath: `/${API_PREFIX}/trpc` })],
})
export class AppModule {}
