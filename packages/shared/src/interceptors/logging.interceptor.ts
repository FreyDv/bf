import { Injectable, Logger } from '@nestjs/common';
import { tap } from 'rxjs/operators';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

/** Debug-level handler timing (HTTP access logs themselves come from pino-http). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Handler');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const started = Date.now();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.debug(`${req.method} ${req.url} -> ${handler} ${Date.now() - started}ms`),
        error: (e: Error) =>
          this.logger.debug(`${req.method} ${req.url} -> ${handler} failed: ${e.message}`),
      }),
    );
  }
}
