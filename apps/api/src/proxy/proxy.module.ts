import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { EdgeAuthMiddleware } from './edge-auth.middleware';
import { EdgeRateLimitMiddleware } from './edge-rate-limit.middleware';

import type { Env } from '../app/env.schema';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

/**
 * Route table (edge → upstream), built from UPSTREAMS=`auth=http://auth:3001,order=http://order:3002,…`:
 *   /<name>/{*path}  →  <url>/{*path}
 * e.g. /auth/trpc/users.me → auth:/trpc/users.me, /order/api/orders → order:/api/orders.
 * Per request: strip identity headers → verify JWT (unless public) → check ROUTE_ROLES → rate limit → proxy.
 * Health of the edge itself is served by @bf/server at /health.
 */
@Module({})
export class ProxyModule implements NestModule {
  constructor(private readonly config: ConfigService<Env, true>) {}

  configure(consumer: MiddlewareConsumer): void {
    const upstreams = this.config.get('UPSTREAMS', { infer: true });
    for (const [name, target] of Object.entries(upstreams)) {
      const prefix = `/${name}`;
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        xfwd: true,
        proxyTimeout: 30_000,
        // Nest mounts middleware on the route prefix, so req.url arrives stripped; rebuild from originalUrl.
        pathRewrite: (_path, req) => {
          const original = (req as unknown as { originalUrl: string }).originalUrl;
          const rest = original.slice(prefix.length);
          return rest.startsWith('/') || rest.startsWith('?') || rest === ''
            ? rest || '/'
            : `/${rest}`;
        },
        on: {
          proxyReq: (proxyReq, req) => {
            const correlation = req.headers['x-correlation-id'];
            if (correlation) proxyReq.setHeader('x-correlation-id', String(correlation));
          },
        },
      });
      consumer
        .apply(EdgeAuthMiddleware, EdgeRateLimitMiddleware, proxy)
        .forRoutes(`${prefix}/{*path}`, prefix);
    }
  }
}
