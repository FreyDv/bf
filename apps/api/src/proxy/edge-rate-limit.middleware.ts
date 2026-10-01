import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

import { IDENTITY_HEADERS } from '@bf/trpc';

import type { Env } from '../app/env.schema';
import type { NextFunction, Request, Response } from 'express';

/**
 * Edge rate limit. Nest guards never run for proxied routes (the proxy middleware ends the
 * response), so throttling lives here. Key = user id when authenticated (set by EdgeAuthMiddleware),
 * otherwise the client IP. Storage is the ThrottlerModule one from CoreModule (in-memory by default).
 */
@Injectable()
export class EdgeRateLimitMiddleware implements NestMiddleware {
  private readonly limit: number;
  private readonly ttl: number;

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    config: ConfigService<Env, true>,
  ) {
    this.limit = config.get('EDGE_RATE_LIMIT', { infer: true });
    this.ttl = config.get('EDGE_RATE_TTL_MS', { infer: true });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.headers[IDENTITY_HEADERS.USER_ID];
    const key = `edge:${typeof user === 'string' && user ? `u:${user}` : `ip:${req.ip ?? 'unknown'}`}`;
    // blockDuration = ttl: once the limit is exceeded the key stays blocked for the rest of the
    // window (with 0 the storage resets the counter immediately and nothing is ever blocked).
    const rec = await this.storage.increment(key, this.ttl, this.limit, this.ttl, 'edge');
    res.setHeader('X-RateLimit-Limit', String(this.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.limit - rec.totalHits)));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + rec.timeToExpire));
    if (rec.isBlocked || rec.totalHits > this.limit) throw new ThrottlerException();
    next();
  }
}
