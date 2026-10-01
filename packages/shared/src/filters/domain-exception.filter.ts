import {
  Catch,
  ConflictException,
  HttpException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ConflictDomainException, DomainException, NotFoundDomainException } from '../ddd';
import { ProblemDetailsFilter } from './problem-details.filter';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

/**
 * Maps framework-free DomainException subclasses to HTTP and delegates to ProblemDetailsFilter.
 * Extend the mapping with `registerDomainExceptionMapping` for app-specific exceptions.
 */
type Mapper = (e: DomainException) => HttpException;
const mappings = new Map<string, Mapper>();

export function registerDomainExceptionMapping(code: string, mapper: Mapper): void {
  mappings.set(code, mapper);
}

export function mapDomainException(e: DomainException): HttpException {
  const custom = mappings.get(e.code);
  if (custom) return custom(e);
  const body = { code: e.code, message: e.message, details: e.details };
  if (e instanceof NotFoundDomainException) return new NotFoundException(body);
  if (e instanceof ConflictDomainException) return new ConflictException(body);
  return new UnprocessableEntityException(body);
}

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter<DomainException> {
  constructor(
    @Inject(ProblemDetailsFilter) private readonly problemDetails: ProblemDetailsFilter,
  ) {}

  catch(exception: DomainException, host: ArgumentsHost): void {
    this.problemDetails.catch(mapDomainException(exception), host);
  }
}
