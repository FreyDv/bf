import {
  HttpStatus,
  RequestMethod,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import {
  AllExceptionsFilter,
  DomainExceptionFilter,
  ProblemDetailsFilter,
  ThrottlerExceptionFilter,
} from '@bf/shared/filters';
import {
  CorrelationIdInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
} from '@bf/shared/interceptors';

import type { BaseEnv } from './env';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export interface BootstrapOptions {
  /** Global prefix (default 'api'); health is always excluded. */
  globalPrefix?: string | false;
  /** Called after the app is created and before listen (extra middleware, static assets…). */
  configure?: (app: NestExpressApplication) => void | Promise<void>;
  /** Skip `app.listen` (useful for tests / workers that own their listen). */
  listen?: boolean;
  helmet?: boolean;
  /** Pass false for proxies that must stream raw bodies (gateway). Default true. */
  bodyParser?: boolean;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    exceptionFactory: (errors) => new UnprocessableEntityException(errors),
  });
}

/**
 * Standard main.ts sequence for every NestJS app in the monorepo. The AppModule must import
 * `CoreModule.forRoot({...})` so the filters/interceptors below are resolvable.
 */
export async function bootstrapApp(
  appModule: Type<unknown>,
  options: BootstrapOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(appModule, {
    bufferLogs: true,
    bodyParser: options.bodyParser ?? true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.set('trust proxy', 1);

  const config = app.get<ConfigService<BaseEnv, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const origins = config.get('CORS_ORIGINS', { infer: true });

  if (options.helmet ?? true)
    app.use(helmet({ contentSecurityPolicy: nodeEnv === 'production' ? undefined : false }));
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Correlation-Id',
      'X-Request-Id',
      'Traceparent',
      'Tracestate',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-Correlation-Id',
      'Location',
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 3600,
  });

  const prefix = options.globalPrefix === undefined ? 'api' : options.globalPrefix;
  if (prefix) {
    app.setGlobalPrefix(prefix, {
      exclude: [
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/{*path}', method: RequestMethod.ALL },
      ],
    });
  }

  app.useGlobalFilters(
    app.get(ThrottlerExceptionFilter),
    app.get(DomainExceptionFilter),
    app.get(ProblemDetailsFilter),
    app.get(AllExceptionsFilter),
  );
  app.useGlobalInterceptors(
    app.get(CorrelationIdInterceptor),
    new TimeoutInterceptor(config.get('REQUEST_TIMEOUT_MS', { infer: true })),
    new TransformInterceptor(app.get(Reflector)),
  );
  app.useGlobalPipes(createValidationPipe());

  await options.configure?.(app);

  if (options.listen ?? true) {
    const port = config.get('PORT', { infer: true });
    await app.listen(port);
    const logger = app.get(Logger);
    const base = `http://localhost:${port}`;
    logger.log(
      `${config.get('SERVICE_NAME', { infer: true })} listening on ${base} (${nodeEnv}) trpc=${base}/trpc health=${base}/health`,
    );
  }
  return app;
}
