import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';

import { DRIZZLE } from '@bf/db';

import { refreshTokens, users } from './identity.schema';
import { toUser } from './users.service';

import type { Env } from '../../app/env.schema';
import type { AuthDatabase } from '../../db/database.type';
import type { TokenPair, User } from '@bf/contracts/auth';
import type { JwtPayload } from '@bf/shared/interfaces';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Access JWT (RS256, short-lived) + opaque refresh token (hashed at rest, rotated on use). */
@Injectable()
export class TokensService {
  private readonly refreshTtlMs: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: AuthDatabase,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000;
  }

  async issue(user: User, userAgent?: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email ?? undefined,
      roles: user.roles,
    } satisfies JwtPayload);
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(accessToken);

    const refreshToken = randomBytes(48).toString('base64url');
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: userAgent ?? null,
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: exp - iat };
  }

  /** Rotation: the presented token is revoked and a fresh pair is issued. */
  async refresh(refreshToken: string, userAgent?: string): Promise<TokenPair> {
    const hash = sha256(refreshToken);
    const row = await this.db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)),
    });
    if (!row || row.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    const user = await this.db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user)
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User no longer exists' });

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    return this.issue(toUser(user), userAgent);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.tokenHash, sha256(refreshToken)), isNull(refreshTokens.revokedAt)),
      );
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}
