import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { TokensService } from './tokens.service';
import { UsersService } from './users.service';

@Module({
  controllers: [AuthController],
  providers: [UsersService, TokensService],
  exports: [UsersService, TokensService],
})
export class IdentityModule {}
