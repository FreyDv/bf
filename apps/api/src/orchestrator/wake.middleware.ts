import { Inject, Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';

import { ORCHESTRATOR } from './orchestrator';
import { ALWAYS_PUBLIC } from '../proxy/edge-auth.middleware';

import type { Orchestrator } from './orchestrator';
import type { NextFunction, Request, Response } from 'express';

export const RETRY_AFTER_S = 10;

/**
 * Before the proxy: makes sure the target service (and what it calls) is running. Holds the request while a
 * sleeping service starts; when that takes longer than the hold, answers 503 + Retry-After so the client retries.
 * Health probes never wake a service (they would keep everything awake) and are answered 503 while it sleeps.
 */
@Injectable()
export class WakeMiddleware implements NestMiddleware {
  constructor(@Inject(ORCHESTRATOR) private readonly orchestrator: Orchestrator) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.orchestrator.enabled) return next();
    const path = req.originalUrl.split('?')[0] ?? '';
    const service = path.split('/')[1] ?? '';
    if (!this.orchestrator.has(service)) return next();

    if (ALWAYS_PUBLIC.test(path)) {
      if (!(await this.orchestrator.isAsleep(service))) return next();
      res.setHeader('Retry-After', String(RETRY_AFTER_S));
      throw new ServiceUnavailableException({
        code: 'SERVICE_ASLEEP',
        message: `${service} is asleep`,
      });
    }

    const result = await this.orchestrator.ensureAwake(service);
    if (result.ready) return next();
    res.setHeader('Retry-After', String(RETRY_AFTER_S));
    throw new ServiceUnavailableException({
      code: 'SERVICE_STARTING',
      message: `${service} is starting up (waiting for ${result.pending.join(', ')})`,
    });
  }
}
