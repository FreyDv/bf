import { createPublicKey } from 'node:crypto';

import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsArray, IsOptional, IsString } from 'class-validator';

import { ROLES } from '@bf/shared/constants';
import { CurrentUser, Public } from '@bf/shared/decorators';

import { TokensService } from './tokens.service';
import { UsersService } from './users.service';

import type { Env } from '../../app/env.schema';
import type { TokenPair } from '@bf/contracts/auth';
import type { AuthenticatedUser } from '@bf/shared/interfaces';

export class DevTokenDto {
  @IsString() sub!: string;
  @IsOptional() @IsArray() roles?: string[];
}
export class RefreshDto {
  @IsString() refreshToken!: string;
}

/**
 * Token endpoints (plain HTTP). Login providers and user-facing tRPC procedures are not implemented yet.
 */
@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly tokens: TokensService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua?: string): Promise<TokenPair> {
    return this.tokens.refresh(dto.refreshToken, ua);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<RefreshDto>,
  ): Promise<void> {
    if (dto.refreshToken) await this.tokens.revoke(dto.refreshToken);
    else await this.tokens.revokeAll(user.id);
  }

  @Post('dev-token')
  @Public()
  async devToken(@Body() dto: DevTokenDto, @Headers('user-agent') ua?: string): Promise<TokenPair> {
    if (this.isProd)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not available in production' });
    const user = await this.users.upsertDevUser(dto.sub, dto.roles ?? [ROLES.USER]);
    return this.tokens.issue(user, ua);
  }

  @Get('jwks')
  @Public()
  jwks(): { keys: Record<string, unknown>[] } {
    const jwk = createPublicKey(this.config.get('JWT_PUBLIC_KEY', { infer: true })).export({
      format: 'jwk',
    });
    return { keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'bf-auth-1' }] };
  }
}
