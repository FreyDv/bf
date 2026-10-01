import { Injectable, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { CLS_KEYS, HEADERS } from '../constants';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/** Echoes X-Request-Id / X-Correlation-Id on the response (values are set up by ClsModule). */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly cls?: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = this.cls?.getId();
    const correlationId = this.cls?.get<string>(CLS_KEYS.CORRELATION_ID);
    if (requestId) response.setHeader(HEADERS.REQUEST_ID, requestId);
    if (correlationId) response.setHeader(HEADERS.CORRELATION_ID, correlationId);
    return next.handle();
  }
}
