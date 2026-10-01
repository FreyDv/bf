import { Catch, Inject, Logger, Optional } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';

import { SHARED_HTTP_OPTIONS } from './options';
import { baseProblem } from './problem-details.util';

import type { SharedHttpOptions } from './options';
import type { ProblemDetails } from '../interfaces';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

/** 429 with Retry-After + X-RateLimit-* headers (RFC 6585 §4), RFC 9457 body. */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter<ThrottlerException> {
  private readonly logger = new Logger(ThrottlerExceptionFilter.name);

  constructor(
    @Inject(SHARED_HTTP_OPTIONS) private readonly options: SharedHttpOptions,
    @Optional() private readonly cls?: ClsService,
  ) {}

  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const ttl = Math.max(1, Math.floor((this.options.throttle?.ttlMs ?? 60_000) / 1000));
    const limit = this.options.throttle?.limit ?? 0;
    const reset = Math.floor(Date.now() / 1000) + ttl;

    response.setHeader('Retry-After', String(ttl));
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', String(reset));
    response.setHeader('Content-Type', 'application/problem+json');

    const problem: ProblemDetails = {
      ...baseProblem(this.cls, this.options.apiBaseUrl, 429, request.url),
      code: 'RATE_LIMIT_EXCEEDED',
      detail: `You have sent more than ${limit} requests within ${ttl} seconds.`,
      errors: [
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          constraints: { limit, remaining: 0, reset },
        },
      ],
    };
    this.logger.warn(`Rate limit exceeded: ${request.method} ${request.url} - ${request.ip}`);
    response.status(429).json(problem);
  }
}
