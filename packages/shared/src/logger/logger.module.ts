import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { createLoggerConfig } from './logger.config';

import type { LoggerConfigInput } from './logger.config';
import type { DynamicModule, InjectionToken, ModuleMetadata } from '@nestjs/common';

export interface LoggerAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => LoggerConfigInput | Promise<LoggerConfigInput>;
}

/** Pino logger module with redaction + request context (nestjs-pino). */
@Module({})
export class LoggerModule {
  static forRoot(input: LoggerConfigInput): DynamicModule {
    return {
      module: LoggerModule,
      imports: [PinoLoggerModule.forRoot(createLoggerConfig(input))],
      exports: [PinoLoggerModule],
    };
  }

  static forRootAsync(options: LoggerAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          imports: options.imports ?? [],
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) =>
            createLoggerConfig(await options.useFactory(...args)),
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
