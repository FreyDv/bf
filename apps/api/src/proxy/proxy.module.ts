import { Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { EdgeAuthMiddleware } from './edge-auth.middleware';
import { EdgeRateLimitMiddleware } from './edge-rate-limit.middleware';
import { ORCHESTRATOR } from '../orchestrator/orchestrator';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { RETRY_AFTER_S, WakeMiddleware } from '../orchestrator/wake.middleware';

import type { Env } from '../app/env.schema';
import type { Orchestrator } from '../orchestrator/orchestrator';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

/** Upstream not reachable: with the orchestrator on, the service is probably (re)starting → 503, else 502. */
const TRANSIENT = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
]);

export function upstreamErrorResponse(
  service: string,
  err: NodeJS.ErrnoException,
  orchestrated: boolean,
  apiBaseUrl: string,
  instance: string,
) {
  const transient = TRANSIENT.has(err.code ?? '');
  const status = orchestrated && transient ? 503 : 502;
  return {
    status,
    body: {
      type: `${apiBaseUrl}/errors/${status === 503 ? 'service-unavailable' : 'bad-gateway'}`,
      title: status === 503 ? 'Service Unavailable' : 'Bad Gateway',
      status,
      code: status === 503 ? 'SERVICE_STARTING' : 'UPSTREAM_UNAVAILABLE',
      detail: `${service} did not answer (${err.code ?? err.message})`,
      instance,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Route table (edge → upstream), built from UPSTREAMS=`auth=http://auth:3001,order=http://order:3002,…`:
 *   /<name>/{*path}  →  <url>/{*path}
 * e.g. /auth/trpc/users.me → auth:/trpc/users.me, /order/api/orders → order:/api/orders.
 * Per request: strip identity headers → verify JWT (unless public) → check ROUTE_ROLES → rate limit →
 * wake the service if it sleeps (ORCHESTRATOR=ecs) → proxy. Health of the edge itself: @bf/server at /health.
 */
@Module({ imports: [OrchestratorModule] })
export class ProxyModule implements NestModule {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(ORCHESTRATOR) private readonly orchestrator: Orchestrator,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const upstreams = this.config.get('UPSTREAMS', { infer: true });
    const apiBaseUrl = this.config.get('API_BASE_URL', { infer: true });
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
          error: (err, req, res) => {
            const orchestrated = this.orchestrator.enabled;
            if (orchestrated) this.orchestrator.invalidate(name);
            if (!('writeHead' in res)) {
              res.end(); // websocket upgrade: nothing to answer
              return;
            }
            const response = res;
            if (response.headersSent) {
              response.end();
              return;
            }
            const { status, body } = upstreamErrorResponse(
              name,
              err,
              orchestrated,
              apiBaseUrl,
              req.url ?? prefix,
            );
            if (status === 503) response.setHeader('Retry-After', String(RETRY_AFTER_S));
            response.setHeader('Content-Type', 'application/problem+json');
            response.setHeader('Cache-Control', 'no-store');
            response.statusCode = status;
            response.end(JSON.stringify(body));
          },
        },
      });
      consumer
        .apply(EdgeAuthMiddleware, EdgeRateLimitMiddleware, WakeMiddleware, proxy)
        .forRoutes(`${prefix}/{*path}`, prefix);
    }
  }
}
