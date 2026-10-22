import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

import { ROLES } from '@bf/shared/constants';
import { Roles } from '@bf/shared/decorators';
import { JwtAuthGuard, RolesGuard } from '@bf/shared/guards';

import { ORCHESTRATOR } from './orchestrator';

import type { Orchestrator, ServiceView } from './orchestrator';

export class CooldownDto {
  @IsInt()
  @Min(0)
  @Max(7 * 24 * 3600)
  seconds!: number;
}

export class BoundsDto {
  @IsInt()
  @Min(0)
  @Max(20)
  min!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  max!: number;
}

/**
 * Runtime control of the orchestrated services (role `admin`): who is awake, wake/sleep by hand, idle lifetime,
 * scale bounds, forced redeploy. Reached as `/api/_services/*` (CloudFront strips `/api`). `_services` can never
 * be an upstream name (UPSTREAMS names start with a letter), so the proxy never sees these paths.
 */
@Controller('_services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN)
export class ServicesController {
  constructor(@Inject(ORCHESTRATOR) private readonly orchestrator: Orchestrator) {}

  @Get()
  list(): Promise<ServiceView[]> {
    return this.orchestrator.list();
  }

  @Post(':name/wake')
  @HttpCode(202)
  async wake(@Param('name') name: string) {
    this.check(name);
    await this.orchestrator.wake(name);
    return { service: name, action: 'wake' };
  }

  @Post(':name/sleep')
  @HttpCode(202)
  async sleep(@Param('name') name: string) {
    this.check(name);
    await this.orchestrator.sleep(name);
    return { service: name, action: 'sleep' };
  }

  @Post(':name/redeploy')
  @HttpCode(202)
  async redeploy(@Param('name') name: string) {
    this.check(name);
    await this.orchestrator.redeploy(name);
    return { service: name, action: 'redeploy' };
  }

  @Post(':name/cooldown')
  async cooldown(@Param('name') name: string, @Body() body: CooldownDto) {
    this.check(name);
    await this.orchestrator.setCooldown(name, body.seconds);
    return { service: name, cooldownS: body.seconds };
  }

  @Post(':name/bounds')
  async bounds(@Param('name') name: string, @Body() body: BoundsDto) {
    this.check(name);
    if (body.min > body.max)
      throw new NotFoundException({ code: 'INVALID_BOUNDS', message: 'min > max' });
    await this.orchestrator.setBounds(name, body.min, body.max);
    return { service: name, bounds: { min: body.min, max: body.max } };
  }

  private check(name: string) {
    if (!this.orchestrator.has(name))
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: `unknown service ${name}`,
      });
  }
}
