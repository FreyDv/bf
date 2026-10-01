import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';

import { METADATA_KEYS } from '../constants';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Response shaping: single resources are returned as-is; list responses
 * (`{ object: 'list', data: [] }`) and @UseEnvelope() handlers are left untouched.
 * Plain arrays are wrapped into the list envelope for consistency.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const useEnvelope = this.reflector.get<boolean>(
      METADATA_KEYS.USE_ENVELOPE,
      context.getHandler(),
    );
    return next.handle().pipe(
      map((data: unknown) => {
        if (data === null || data === undefined || useEnvelope) return data;
        if (Array.isArray(data)) return { object: 'list', data, hasMore: false };
        return data;
      }),
    );
  }
}
