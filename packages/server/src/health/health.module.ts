import { Controller, Get, Inject, Module, Optional } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TerminusModule } from '@nestjs/terminus';

import { Public } from '@bf/shared/decorators';

import type { DynamicModule } from '@nestjs/common';
import type { HealthIndicatorFunction } from '@nestjs/terminus';

export const READINESS_INDICATORS = Symbol.for('bf.READINESS_INDICATORS');

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Optional()
    @Inject(READINESS_INDICATORS)
    private readonly indicators: HealthIndicatorFunction[] = [],
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check(this.indicators);
  }

  @Get('live')
  @Public()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  ready() {
    return this.health.check(this.indicators);
  }
}

/**
 * /health, /health/live, /health/ready via terminus. Apps provide READINESS_INDICATORS
 * (e.g. a pg `SELECT 1`) through `HealthModule.forRoot({ indicators })`.
 */
@Module({})
export class HealthModule {
  static forRoot(
    options: {
      indicators?: {
        provide?: never;
        inject?: unknown[];
        useFactory: (...a: never[]) => HealthIndicatorFunction[];
      };
    } = {},
  ): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule.forRoot({ logger: false })],
      controllers: [HealthController],
      providers: options.indicators
        ? [
            {
              provide: READINESS_INDICATORS,
              inject: (options.indicators.inject ?? []) as never[],
              useFactory: options.indicators.useFactory,
            },
          ]
        : [{ provide: READINESS_INDICATORS, useValue: [] }],
    };
  }
}
