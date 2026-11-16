import type { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { Logger as PinoLogger } from 'pino';
import { pinoHttp } from 'pino-http';
import { httpLoggingOptions } from './http-logging.config.js';
import { PINO } from './pino.tokens.js';
import { AsyncLocalRequestContext } from './request-context.adapter.js';
import { requestContextMiddleware } from './request-context.middleware.js';

// Called from configureApp. Both middlewares go on the Express app with `app.use`, before what Nest and nestjs-trpc
// mount (ADR-070): nestjs-trpc mounts in onModuleInit, which runs after Nest registers its own middleware, so the
// middleware of nestjs-pino never sees a tRPC call. Opening the context and the access log here covers every route.
// A test through /api/trpc proves the order.
export function configureLogging(app: INestApplication): void {
  app.use(requestContextMiddleware(app.get(AsyncLocalRequestContext)));
  app.use(pinoHttp(httpLoggingOptions(app.get<PinoLogger>(PINO))));
  // Nest's own messages (startup, route mapping) go through the same pino instance.
  app.useLogger(app.get(Logger));
}
