import { Module } from '@nestjs/common';
import { CheckLivenessController } from './queries/check-liveness/check-liveness.controller.js';

// A technical module (ADR-080, after ADR-070): no domain, no capability spec, only the probe endpoint a platform asks.
@Module({ controllers: [CheckLivenessController] })
export class HealthModule {}
