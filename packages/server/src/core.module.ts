import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import {
  AllExceptionsFilter,
  DomainExceptionFilter,
  ProblemDetailsFilter,
  SHARED_HTTP_OPTIONS,
  ThrottlerExceptionFilter,
} from '@bf/shared/filters';
import { JwtAuthGuard, RolesGuard } from '@bf/shared/guards';
import { CorrelationIdInterceptor, TransformInterceptor } from '@bf/shared/interceptors';
import { LoggerModule } from '@bf/shared/logger';
import { createClsConfig } from '@bf/shared/middleware';

import { createEnvValidator } from './env';
import { HealthModule } from './health/health.module';

import type { BaseEnv } from './env';
import type { DynamicModule } from '@nestjs/common';
import type { HealthIndicatorFunction } from '@nestjs/terminus';
import type { z } from 'zod';

export interface CoreModuleOptions<S extends z.ZodTypeAny> {
  envSchema: S;
  /** Extra dotenv files (relative to cwd). `.env` is always loaded first. */
  envFilePaths?: string[];
  /** Register JwtAuthGuard + RolesGuard globally (default true). Use @Public() to opt out per route. */
  globalAuth?: boolean;
  /** Readiness indicators factory (e.g. DB ping). */
  readiness?: { inject?: unknown[]; useFactory: (...a: never[]) => HealthIndicatorFunction[] };
}

/**
 * Everything an app needs before its own modules: validated env, CLS, pino, throttler, JWT,
 * shared filters/interceptors (as providers so bootstrapApp can `app.get` them), health.
 */
@Module({})
export class CoreModule {
  static forRoot<S extends z.ZodTypeAny>(options: CoreModuleOptions<S>): DynamicModule {
    const globalAuth = options.globalAuth ?? true;
    return {
      module: CoreModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: ['.env', ...(options.envFilePaths ?? [])],
          validate: createEnvValidator(options.envSchema),
        }),
        ClsModule.forRoot(createClsConfig()),
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<BaseEnv, true>) => ({
            nodeEnv: config.get('NODE_ENV', { infer: true }),
            level: config.get('LOG_LEVEL', { infer: true }),
            serviceName: config.get('SERVICE_NAME', { infer: true }),
          }),
        }),
        ThrottlerModule.forRootAsync({
          imports: [],
          inject: [ConfigService],
          useFactory: (config: ConfigService<BaseEnv, true>) => ({
            throttlers: [
              {
                ttl: config.get('THROTTLE_TTL', { infer: true }),
                limit: config.get('THROTTLE_LIMIT', { infer: true }),
              },
            ],
          }),
        }),
        // RS256: every service verifies with the public key; only `auth` (JWT_PRIVATE_KEY set) can sign.
        JwtModule.registerAsync({
          global: true,
          inject: [ConfigService],
          useFactory: (config: ConfigService<BaseEnv, true>) => ({
            publicKey: config.get('JWT_PUBLIC_KEY', { infer: true }),
            privateKey: config.get('JWT_PRIVATE_KEY', { infer: true }),
            signOptions: {
              algorithm: 'RS256',
              expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
              issuer: config.get('JWT_ISSUER', { infer: true }),
            },
            verifyOptions: {
              algorithms: ['RS256'],
              issuer: config.get('JWT_ISSUER', { infer: true }),
            },
          }),
        }),
        HealthModule.forRoot({ indicators: options.readiness }),
      ],
      providers: [
        {
          provide: SHARED_HTTP_OPTIONS,
          inject: [ConfigService],
          useFactory: (config: ConfigService<BaseEnv, true>) => ({
            apiBaseUrl: config.get('API_BASE_URL', { infer: true }),
            isProduction: config.get('NODE_ENV', { infer: true }) === 'production',
            throttle: {
              ttlMs: config.get('THROTTLE_TTL', { infer: true }),
              limit: config.get('THROTTLE_LIMIT', { infer: true }),
            },
          }),
        },
        ProblemDetailsFilter,
        DomainExceptionFilter,
        AllExceptionsFilter,
        ThrottlerExceptionFilter,
        CorrelationIdInterceptor,
        TransformInterceptor,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        ...(globalAuth
          ? [
              { provide: APP_GUARD, useClass: JwtAuthGuard },
              { provide: APP_GUARD, useClass: RolesGuard },
            ]
          : []),
      ],
      exports: [
        SHARED_HTTP_OPTIONS,
        ProblemDetailsFilter,
        DomainExceptionFilter,
        AllExceptionsFilter,
        ThrottlerExceptionFilter,
        CorrelationIdInterceptor,
        TransformInterceptor,
      ],
    };
  }
}
