import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { extractBearer } from '@bf/shared/guards';
import { IDENTITY_HEADERS } from '@bf/trpc';

import type { Env } from '../app/env.schema';
import type { JwtPayload } from '@bf/shared/interfaces';
import type { NextFunction, Request, Response } from 'express';

const ALWAYS_PUBLIC = /^\/[a-z][a-z0-9-]*\/(health)(\/|$|\?)/;

/**
 * Edge authentication. Verifies the bearer JWT (RS256, public key) and forwards the identity as
 * trusted headers (X-User-Id / X-User-Roles / X-User-Email). Client-supplied identity headers are
 * always stripped first, so downstream services can trust them blindly.
 *
 * Per-service role requirements come from ROUTE_ROLES (e.g. `admin=admin`).
 */
@Injectable()
export class EdgeAuthMiddleware implements NestMiddleware {
  private readonly publicPaths: string[];
  private readonly routeRoles: Record<string, string>;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.publicPaths = config.get('PUBLIC_PATHS', { infer: true });
    this.routeRoles = config.get('ROUTE_ROLES', { infer: true });
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    for (const h of Object.values(IDENTITY_HEADERS)) delete req.headers[h];

    const url = req.originalUrl;
    const path = url.split('?')[0] ?? '';
    const service = path.split('/')[1] ?? '';
    const token = extractBearer(req.headers.authorization);

    const isPublic =
      req.method === 'OPTIONS' ||
      ALWAYS_PUBLIC.test(path) ||
      this.publicPaths.some((p) => path.startsWith(p));
    if (isPublic && !token) return next();
    if (!token)
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      if (isPublic) return next();
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
    const roles = payload.roles ?? [];
    const required = this.routeRoles[service];
    if (required && !roles.includes(required))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Route /${service} requires role '${required}'`,
      });

    req.headers[IDENTITY_HEADERS.USER_ID] = payload.sub;
    req.headers[IDENTITY_HEADERS.USER_ROLES] = roles.join(',');
    if (payload.email) req.headers[IDENTITY_HEADERS.USER_EMAIL] = payload.email;
    next();
  }
}
