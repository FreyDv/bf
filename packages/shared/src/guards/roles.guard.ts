import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { METADATA_KEYS } from '../constants';

import type { AuthenticatedUser } from '../interfaces';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(METADATA_KEYS.ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No authenticated user' });
    const allowed = required.some((r) => user.roles.includes(r));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires one of roles: ${required.join(', ')}`,
      });
    }
    return true;
  }
}
