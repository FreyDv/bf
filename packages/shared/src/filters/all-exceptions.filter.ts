import { Catch, HttpException, HttpStatus, Inject, Logger, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { DomainException } from '../ddd';
import { mapDomainException } from './domain-exception.filter';
import { SHARED_HTTP_OPTIONS } from './options';
import { ProblemDetailsFilter } from './problem-details.filter';
import { baseProblem, tracePrefix } from './problem-details.util';

import type { SharedHttpOptions } from './options';
import type { ProblemDetails } from '../interfaces';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Catch-all filter. HttpException / DomainException / pg errors are re-routed to
 * ProblemDetailsFilter; everything else becomes a sanitized 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Inject(SHARED_HTTP_OPTIONS) private readonly options: SharedHttpOptions,
    @Inject(ProblemDetailsFilter) private readonly problemDetails: ProblemDetailsFilter,
    @Optional() private readonly cls?: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) return this.problemDetails.catch(exception, host);
    if (exception instanceof DomainException) {
      return this.problemDetails.catch(mapDomainException(exception), host);
    }
    const pgMapped = mapPgError(exception);
    if (pgMapped) {
      this.logger.warn(
        `[DB] ${pgMapped.getStatus()} ${String((exception as { code?: string }).code)}`,
      );
      return this.problemDetails.catch(pgMapped, host);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof Error
        ? this.options.isProduction
          ? 'The server encountered an unexpected error'
          : exception.message
        : 'Internal server error';

    const problem: ProblemDetails = {
      ...baseProblem(this.cls, this.options.apiBaseUrl, status, request.url),
      code: 'INTERNAL_SERVER_ERROR',
      detail: message,
    };

    const log = `${tracePrefix(this.cls)}${request.method} ${request.url} ${status}`;
    if (exception instanceof Error) this.logger.error(log, exception.stack);
    else this.logger.error(log, JSON.stringify(exception));

    response.setHeader('Content-Type', 'application/problem+json');
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(problem);
  }
}

/** Maps pg DatabaseError (possibly wrapped in DrizzleQueryError.cause) to HttpException. Duck-typed to avoid hard deps. */
export function mapPgError(exception: unknown): HttpException | undefined {
  const candidate =
    (exception as { cause?: unknown })?.cause && isPgError((exception as { cause?: unknown }).cause)
      ? (exception as { cause: PgLike }).cause
      : isPgError(exception)
        ? exception
        : undefined;
  if (!candidate) return undefined;
  const body = (code: string, message: string) => ({ code, message });
  switch (candidate.code) {
    case '23505':
      return new HttpException(
        body('RESOURCE_CONFLICT', 'A resource with the same unique field already exists'),
        409,
      );
    case '23503':
      return new HttpException(
        body('RESOURCE_CONFLICT', 'Referenced resource does not exist'),
        422,
      );
    case '23502':
      return new HttpException(body('VALIDATION_FAILED', 'A required field is missing'), 422);
    case '23514':
      return new HttpException(
        body('VALIDATION_FAILED', 'Data failed a database constraint check'),
        422,
      );
    case '08000':
    case '08001':
    case '08003':
    case '08004':
    case '08006':
      return new HttpException(body('SERVICE_UNAVAILABLE', 'Database connection error'), 503);
    case '57014':
      return new HttpException(body('SERVICE_UNAVAILABLE', 'Database query timed out'), 503);
    default:
      return new HttpException(
        body('INTERNAL_SERVER_ERROR', 'An unexpected database error occurred'),
        500,
      );
  }
}

interface PgLike {
  code?: string;
  severity?: string;
}
function isPgError(e: unknown): e is PgLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as PgLike).code === 'string' &&
    typeof (e as PgLike).severity === 'string' &&
    (e as Error).name === 'error'
  );
}
