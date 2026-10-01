import { Injectable } from '@nestjs/common';

import { HEADERS } from '@bf/shared/constants';

import type { AuthenticatedUser } from '@bf/shared/interfaces';
import type { ContextOptions, TRPCContext } from 'nestjs-trpc';

/** Context available to every procedure via `@Ctx()`. */
// Type aliases (not interfaces) so they satisfy nestjs-trpc's `Record<string, unknown>` context.
export type TrpcContext = {
  /** Present when the edge (`api`) verified a JWT and forwarded X-User-Id / X-User-Roles. */
  user?: AuthenticatedUser;
  correlationId?: string;
};

/** Context after `AuthedMiddleware`: `user` is guaranteed. */
export type AuthedTrpcContext = TrpcContext & { user: AuthenticatedUser };

type HeaderBag = Record<string, string | string[] | undefined>;

function header(headers: HeaderBag, name: string): string | undefined {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Headers the edge sets after verifying the bearer token. */
export const IDENTITY_HEADERS = {
  USER_ID: 'x-user-id',
  USER_ROLES: 'x-user-roles',
  USER_EMAIL: 'x-user-email',
} as const;

/**
 * Trusted-header identity. Services run on a private network behind `api`, which is the only
 * component that verifies bearer tokens; downstream services trust the headers it sets.
 */
export function userFromHeaders(headers: HeaderBag): AuthenticatedUser | undefined {
  const id = header(headers, IDENTITY_HEADERS.USER_ID);
  if (!id) return undefined;
  const roles = (header(headers, IDENTITY_HEADERS.USER_ROLES) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { id, roles, email: header(headers, IDENTITY_HEADERS.USER_EMAIL) };
}

/** Inverse of `userFromHeaders`: what a client sends to propagate the caller's identity. */
export function identityHeaders(user?: AuthenticatedUser): Record<string, string> {
  if (!user) return {};
  const out: Record<string, string> = {
    [IDENTITY_HEADERS.USER_ID]: user.id,
    [IDENTITY_HEADERS.USER_ROLES]: user.roles.join(','),
  };
  if (user.email) out[IDENTITY_HEADERS.USER_EMAIL] = user.email;
  return out;
}

@Injectable()
export class TrpcRequestContext implements TRPCContext {
  create(opts: ContextOptions): TrpcContext {
    // `opts.req` is Express or Fastify; both expose `headers` but the union can't be resolved without fastify types.
    const headers = (opts.req as unknown as { headers: HeaderBag }).headers;
    return {
      user: userFromHeaders(headers),
      correlationId: header(headers, HEADERS.CORRELATION_ID),
    };
  }
}
