import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream, Logger as PinoLogger } from 'pino';
import { LOG_DESTINATION, PINO } from './infrastructure/pino.tokens.js';
import { readLogLevel } from './infrastructure/log-level.js';
import {
  createPino,
  PinoLoggerAdapter,
  stdoutDestination,
} from './infrastructure/pino-logger.adapter.js';
import { AsyncLocalRequestContext } from './infrastructure/request-context.adapter.js';
import { LOGGER, REQUEST_CONTEXT } from './public/logging.tokens.js';

// The pino instance and what it reads, in a module of their own: nestjs-pino is configured from the same instance the
// Logger port writes through, so one process has one level, one destination and one set of redacted names.
@Module({
  providers: [
    { provide: LOG_DESTINATION, useFactory: stdoutDestination },
    AsyncLocalRequestContext,
    {
      provide: PINO,
      inject: [LOG_DESTINATION, AsyncLocalRequestContext],
      useFactory: (destination: DestinationStream, context: AsyncLocalRequestContext) =>
        createPino({ level: readLogLevel(process.env), context }, destination),
    },
  ],
  exports: [LOG_DESTINATION, AsyncLocalRequestContext, PINO],
})
class LoggingCoreModule {}

// A technical module (ADR-070): infrastructure only, no domain, no capability spec. It gives the rest of the backend
// the Logger port and the read-only request context by token; the library stays here.
@Global()
@Module({
  imports: [
    LoggingCoreModule,
    LoggerModule.forRootAsync({
      imports: [LoggingCoreModule],
      inject: [PINO],
      // useExisting: pino-http is mounted by configureLogging at the Express level, where it also sees tRPC; nestjs-pino
      // only binds the request logger for its Logger and PinoLogger.
      useFactory: (logger: PinoLogger) => ({ pinoHttp: { logger }, useExisting: true as const }),
    }),
  ],
  providers: [
    {
      provide: LOGGER,
      inject: [PINO],
      useFactory: (logger: PinoLogger) => new PinoLoggerAdapter(logger),
    },
    { provide: REQUEST_CONTEXT, useExisting: AsyncLocalRequestContext },
  ],
  exports: [LOGGER, REQUEST_CONTEXT],
})
export class LoggingModule {}
