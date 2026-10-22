import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TRPCError } from '@trpc/server';

import { HEADERS } from '@bf/shared/constants';
import { extractBearer } from '@bf/shared/guards';

import type { AuthenticatedUser, JwtPayload } from '@bf/shared/interfaces';
import type { TrpcContext } from '@bf/trpc';
import type { ContextOptions, TRPCContext } from 'nestjs-trpc';

type HeaderBag = Record<string, string | string[] | undefined>;

/**
 * Context of the edge's own tRPC procedures (`/_services/trpc`). Unlike the services behind the edge, which trust
 * the X-User-* headers the edge sets, the edge is the one verifying the bearer token (RS256, public key) — so this
 * context ignores identity headers entirely and derives `user` from the JWT. nestjs-trpc mounts its handler
 * during module configuration, before any `MiddlewareConsumer` middleware, which is why EdgeAuthMiddleware cannot
 * cover this path and the check lives here. `AdminMiddleware` on every router then requires the admin role.
 */
@Injectable()
export class EdgeTrpcContext implements TRPCContext {
  constructor(private readonly jwt: JwtService) {}

  async create(opts: ContextOptions): Promise<TrpcContext> {
    const headers = (opts.req as unknown as { headers: HeaderBag }).headers;
    const token = extractBearer(first(headers.authorization));
    if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
    return { user, correlationId: first(headers[HEADERS.CORRELATION_ID]) };
  }
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
