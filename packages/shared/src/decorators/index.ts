import { createParamDecorator, SetMetadata } from '@nestjs/common';

import { METADATA_KEYS } from '../constants';

import type { AuthenticatedUser } from '../interfaces';
import type { ExecutionContext } from '@nestjs/common';

/** Marks a route as accessible without authentication. */
export const Public = () => SetMetadata(METADATA_KEYS.IS_PUBLIC, true);

/** Restricts a route to the given roles (checked by RolesGuard). */
export const Roles = (...roles: string[]) => SetMetadata(METADATA_KEYS.ROLES, roles);

/** Keeps list responses untouched by TransformInterceptor. */
export const UseEnvelope = () => SetMetadata(METADATA_KEYS.USE_ENVELOPE, true);

/** Injects the authenticated user (set by JwtAuthGuard) or one of its fields. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
