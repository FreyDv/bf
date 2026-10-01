import { Catch, HttpException, Inject, Logger, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { SHARED_HTTP_OPTIONS } from './options';
import { baseProblem } from './problem-details.util';

import type { SharedHttpOptions } from './options';
import type { FieldError, ProblemDetails } from '../interfaces';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ValidationErrorItem {
  property: string;
  constraints?: Record<string, string>;
  contexts?: Record<string, { code?: string }>;
}

/**
 * RFC 9457 Problem Details filter for HttpException (lifted from nestjs-boilerplate).
 * Handles class-validator errors (422), business errors with explicit `code`, and fallbacks.
 */
@Catch(HttpException)
export class ProblemDetailsFilter implements ExceptionFilter<HttpException> {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(
    @Inject(SHARED_HTTP_OPTIONS) private readonly options: SharedHttpOptions,
    @Optional() private readonly cls?: ClsService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body = exception.getResponse() as string | Record<string, unknown>;

    const problem: ProblemDetails = {
      ...baseProblem(this.cls, this.options.apiBaseUrl, status, request.url),
      ...this.payload(body, exception, status),
    };

    const msg = `${request.method} ${request.url} ${status}`;
    if (status >= 500) this.logger.error(msg, exception.stack);
    else this.logger.warn(msg);

    response.setHeader('Content-Type', 'application/problem+json');
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(problem);
  }

  private payload(
    body: string | Record<string, unknown>,
    exception: HttpException,
    status: number,
  ): Pick<ProblemDetails, 'code' | 'detail' | 'errors'> {
    if (status === 400 || status === 422) {
      const errors = this.validationErrors(body);
      if (errors?.length)
        return { code: 'VALIDATION_FAILED', detail: 'Request validation failed', errors };
    }
    if (typeof body === 'object' && 'code' in body) {
      const detail = typeof body.message === 'string' ? body.message : exception.message;
      return { code: String(body.code), detail };
    }
    const detail = typeof body === 'string' ? body : exception.message;
    const fallback: Record<number, string> = {
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'RESOURCE_NOT_FOUND',
      408: 'REQUEST_TIMEOUT',
      409: 'RESOURCE_CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
    };
    return {
      code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : (fallback[status] ?? 'BAD_REQUEST'),
      detail,
    };
  }

  private validationErrors(body: string | Record<string, unknown>): FieldError[] | undefined {
    if (typeof body !== 'object' || !Array.isArray(body.message)) return undefined;
    const errors: FieldError[] = [];
    for (const item of body.message as unknown[]) {
      if (typeof item === 'string') {
        const field = item.split(' ')[0] ?? 'unknown';
        errors.push({ field, pointer: `/${field}`, code: 'VALIDATION_ERROR', message: item });
      } else if (isValidationItem(item)) {
        for (const [name, message] of Object.entries(item.constraints ?? {})) {
          errors.push({
            field: item.property,
            pointer: `/${item.property}`,
            code: item.contexts?.[name]?.code ?? 'VALIDATION_ERROR',
            message,
          });
        }
      }
    }
    return errors.length ? errors : undefined;
  }
}

function isValidationItem(item: unknown): item is ValidationErrorItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as ValidationErrorItem).property === 'string'
  );
}
