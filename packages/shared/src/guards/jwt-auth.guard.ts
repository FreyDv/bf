import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';

import { CLS_KEYS, METADATA_KEYS } from '../constants';

import type { AuthenticatedUser, JwtPayload } from '../interfaces';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Bearer JWT guard. Verifies the token with the app-provided JwtService
 * (JwtModule.register({ secret })) and attaches `request.user`.
 * Routes decorated with @Public() bypass it.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearer(request.headers.authorization);
    if (!token)
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
    request.user = user;
    this.cls.set(CLS_KEYS.USER, user);
    return true;
  }
}

export function extractBearer(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
