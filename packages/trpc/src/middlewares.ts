import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';

import { ROLES } from '@bf/shared/constants';

import type { TrpcContext } from './context';
import type { MiddlewareOptions, MiddlewareResponse, TRPCMiddleware } from 'nestjs-trpc';

/** Rejects procedures called without a forwarded identity. Use with `@UseMiddlewares(AuthedMiddleware)`. */
@Injectable()
export class AuthedMiddleware implements TRPCMiddleware {
  use(opts: MiddlewareOptions<TrpcContext>): MiddlewareResponse {
    if (!opts.ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing identity' });
    return opts.next({ ctx: { user: opts.ctx.user } });
  }
}

/** Same as `AuthedMiddleware` but also requires the `admin` role. */
@Injectable()
export class AdminMiddleware implements TRPCMiddleware {
  use(opts: MiddlewareOptions<TrpcContext>): MiddlewareResponse {
    const user = opts.ctx.user;
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing identity' });
    if (!user.roles.includes(ROLES.ADMIN))
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
    return opts.next({ ctx: { user } });
  }
}
