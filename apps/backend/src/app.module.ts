import { Logger, Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';
import { API_PREFIX } from './configure-app.js';
import { LoggingModule } from './logging/logging.module.js';

@Module({
  // nestjs-trpc mounts with `app.use(basePath)` and ignores the global prefix, so the prefix is repeated here (ADR-038).
  // Without `logger` it writes its start lines through its own ConsoleLogger as plain text; Nest's Logger forwards to
  // the logger installed by `app.useLogger`, which is pino (ADR-070, LOG-3), and buffers until then.
  imports: [
    LoggingModule,
    TRPCModule.forRoot({ basePath: `/${API_PREFIX}/trpc`, logger: new Logger() }),
  ],
})
export class AppModule {}
