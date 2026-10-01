import { Module } from '@nestjs/common';

import { HealthRouter } from './health.router';

@Module({ providers: [HealthRouter] })
export class HealthRouterModule {}
